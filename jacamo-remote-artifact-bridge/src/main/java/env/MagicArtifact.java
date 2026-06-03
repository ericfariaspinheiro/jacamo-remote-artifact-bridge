package env;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import org.json.JSONArray;
import org.json.JSONObject;

import cartago.Artifact;
import cartago.IArtifactOp;
import cartago.INTERNAL_OPERATION;

public class MagicArtifact extends Artifact {

    private WebSocket webSocket;
    private String remoteArtifactName;
    private final AtomicInteger callCounter = new AtomicInteger(0);
    private CompletableFuture<JSONObject> manifestFuture;

    void init(String host, int port) {
        System.out.println("JaCaMagic: MagicArtifact initialized");
        System.out.println("JaCaMagic: connecting to ws://" + host + ":" + port);

        JSONObject manifest = connectAndLoadManifest(host, port);

        remoteArtifactName = manifest.getString("artifact");

        JSONArray operations = manifest.optJSONArray("operations");

        if (operations == null) {
            throw new RuntimeException("Manifest does not contain operations");
        }

        for (int i = 0; i < operations.length(); i++) {
            JSONObject operationSpec = operations.getJSONObject(i);
            registerDynamicOperation(operationSpec);
        }

        System.out.println(
                "JaCaMagic: manifest loaded for artifact "
                        + remoteArtifactName
                        + " with "
                        + operations.length()
                        + " operation(s)"
        );

        signal("magic_ready", remoteArtifactName);
    }

    private JSONObject connectAndLoadManifest(String host, int port) {
        try {
            manifestFuture = new CompletableFuture<>();

            HttpClient client = HttpClient.newHttpClient();

            String url = "ws://" + host + ":" + port;

            webSocket = client.newWebSocketBuilder()
                    .buildAsync(URI.create(url), new WebSocket.Listener() {

                        private final StringBuilder partialMessage = new StringBuilder();

                        @Override
                        public CompletionStage<?> onText(
                                WebSocket webSocket,
                                CharSequence data,
                                boolean last
                        ) {
                            partialMessage.append(data);

                            if (last) {
                                String completeMessage = partialMessage.toString();
                                partialMessage.setLength(0);

                                handleRawWebSocketMessage(completeMessage);
                            }

                            webSocket.request(1);
                            return null;
                        }

                        @Override
                        public void onError(WebSocket webSocket, Throwable error) {
                            if (manifestFuture != null && !manifestFuture.isDone()) {
                                manifestFuture.completeExceptionally(error);
                            } else {
                                execInternalOp(
                                        "processRemoteMessage",
                                        createErrorMessage(
                                                "unknown",
                                                "websocket_error",
                                                error.getMessage() != null
                                                        ? error.getMessage()
                                                        : "Unknown WebSocket error"
                                        ).toString()
                                );
                            }
                        }

                        @Override
                        public CompletionStage<?> onClose(
                                WebSocket webSocket,
                                int statusCode,
                                String reason
                        ) {
                            execInternalOp(
                                    "processRemoteMessage",
                                    createErrorMessage(
                                            "unknown",
                                            "websocket_closed",
                                            "WebSocket closed: " + statusCode + " " + reason
                                    ).toString()
                            );

                            return null;
                        }
                    })
                    .join();

            webSocket.request(1);

            sendRuntimeHello();

            JSONObject manifest = manifestFuture.get(10, TimeUnit.SECONDS);

            System.out.println("JaCaMagic: artifact manifest received");

            return manifest;

        } catch (Exception error) {
            throw new RuntimeException("Failed to initialize MagicArtifact", error);
        }
    }

    private void sendRuntimeHello() {
        JSONObject hello = new JSONObject();
        hello.put("type", "runtime_hello");
        hello.put("protocolVersion", "1.0");

        webSocket.sendText(hello.toString(), true);

        System.out.println("JaCaMagic: runtime_hello sent");
    }

    private void handleRawWebSocketMessage(String rawMessage) {
        try {
            JSONObject message = new JSONObject(rawMessage);
            String type = message.getString("type");

            if ("artifact_manifest".equals(type)) {
                if (manifestFuture != null && !manifestFuture.isDone()) {
                    manifestFuture.complete(message);
                    return;
                }
            }

            execInternalOp("processRemoteMessage", rawMessage);

        } catch (Exception error) {
            execInternalOp(
                    "processRemoteMessage",
                    createErrorMessage(
                            "unknown",
                            "invalid_message",
                            error.getMessage() != null
                                    ? error.getMessage()
                                    : "Invalid remote message"
                    ).toString()
            );
        }
    }

    private void registerDynamicOperation(JSONObject operationSpec) {
        String operationName = operationSpec.getString("name");
        JSONArray args = operationSpec.optJSONArray("args");

        int arity = args == null ? 0 : args.length();

        defineOp(new RemoteDynamicOperation(operationSpec), null);

        System.out.println(
                "JaCaMagic: dynamic operation registered from remote manifest: "
                        + operationName
                        + "/"
                        + arity
        );
    }

    private void invokeRemote(String operationName, JSONObject args) {
        if (webSocket == null) {
            signal("magic_error", "WebSocket is not connected");
            return;
        }

        String callId = String.valueOf(callCounter.incrementAndGet());

        JSONObject request = new JSONObject();
        request.put("type", "operation_request");
        request.put("callId", callId);
        request.put("artifact", remoteArtifactName);
        request.put("operation", operationName);
        request.put("args", args);

        webSocket.sendText(request.toString(), true);

        signal("remote_started", callId, operationName);
    }

    @INTERNAL_OPERATION
    void processRemoteMessage(String rawMessage) {
        handleRemoteMessage(rawMessage);
    }

    private void handleRemoteMessage(String rawMessage) {
        try {
            JSONObject message = new JSONObject(rawMessage);
            String type = message.getString("type");

            switch (type) {
                case "signal" -> emitSignal(message);

                case "observable_property" -> defineObservableProperty(message);

                case "clear_observable_properties" -> clearObservableProperties(message);

                case "done" -> signal(
                        "remote_done",
                        message.optString("callId", "unknown")
                );

                case "error" -> signal(
                        "remote_error",
                        message.optString("callId", "unknown"),
                        message.optString("code", "runtime_error"),
                        message.optString("message", "Unknown error")
                );

                default -> signal(
                        "magic_error",
                        "unknown remote message type: " + type
                );
            }

        } catch (Exception error) {
            signal(
                    "magic_error",
                    error.getMessage() != null
                            ? error.getMessage()
                            : "Invalid remote message"
            );
        }
    }

    private void emitSignal(JSONObject message) {
        String name = message.getString("name");
        JSONArray args = message.optJSONArray("args");

        if (args == null || args.length() == 0) {
            signal(name);
            return;
        }

        Object[] signalArgs = new Object[args.length()];

        for (int i = 0; i < args.length(); i++) {
            signalArgs[i] = args.get(i);
        }

        signal(name, signalArgs);
    }

    private void defineObservableProperty(JSONObject message) {
        String name = message.getString("name");
        JSONArray args = message.optJSONArray("args");

        if (args == null || args.length() == 0) {
            defineObsProperty(name);
            return;
        }

        Object[] propertyArgs = new Object[args.length()];

        for (int i = 0; i < args.length(); i++) {
            propertyArgs[i] = args.get(i);
        }

        defineObsProperty(name, propertyArgs);
    }

    private void clearObservableProperties(JSONObject message) {
        String name = message.getString("name");

        while (getObsProperty(name) != null) {
            removeObsProperty(name);
        }
    }

    private JSONObject createErrorMessage(String callId, String code, String errorMessage) {
        JSONObject error = new JSONObject();
        error.put("type", "error");
        error.put("callId", callId);
        error.put("code", code);
        error.put("message", errorMessage);
        return error;
    }

    private class RemoteDynamicOperation implements IArtifactOp {

        private final String operationName;
        private final JSONArray args;

        RemoteDynamicOperation(JSONObject operationSpec) {
            this.operationName = operationSpec.getString("name");
            this.args = operationSpec.optJSONArray("args");
        }

        @Override
        public String getName() {
            return operationName;
        }

        @Override
        public int getNumParameters() {
            return args == null ? 0 : args.length();
        }

        @Override
        public boolean isVarArgs() {
            return false;
        }

        @Override
        public void exec(Object[] actualParams) throws Exception {
            int expected = getNumParameters();

            if (actualParams.length != expected) {
                signal(
                        "magic_error",
                        operationName + " expects " + expected + " parameter(s)"
                );
                return;
            }

            JSONObject namedArgs = mapArguments(actualParams);

            System.out.println(
                    "JaCaMagic: remote dynamic operation "
                            + operationName
                            + " called with "
                            + namedArgs
            );

            invokeRemote(operationName, namedArgs);
        }

        private JSONObject mapArguments(Object[] actualParams) {
            JSONObject namedArgs = new JSONObject();

            if (args == null) {
                return namedArgs;
            }

            for (int i = 0; i < args.length(); i++) {
                JSONObject argSpec = args.getJSONObject(i);

                String argName = argSpec.getString("name");
                String argType = argSpec.optString("type", "object");

                Object value = actualParams[i];

                if (!isValidType(value, argType)) {
                    signal(
                            "magic_error",
                            "invalid argument type for "
                                    + operationName
                                    + "."
                                    + argName
                                    + ": expected "
                                    + argType
                                    + ", got "
                                    + value.getClass().getSimpleName()
                    );
                    continue;
                }

                namedArgs.put(argName, value);
            }

            return namedArgs;
        }

        private boolean isValidType(Object value, String expectedType) {
            return switch (expectedType) {
                case "string" -> value instanceof String;
                case "number" -> value instanceof Number;
                case "boolean" -> value instanceof Boolean;
                case "object" -> true;
                default -> true;
            };
        }
    }
}