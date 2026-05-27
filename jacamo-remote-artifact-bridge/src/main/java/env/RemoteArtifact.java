package env;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.atomic.AtomicInteger;

import org.json.JSONArray;
import org.json.JSONObject;

import cartago.Artifact;
import cartago.INTERNAL_OPERATION;

public class RemoteArtifact extends Artifact {

    private WebSocket webSocket;
    private final AtomicInteger callCounter = new AtomicInteger(0);

    void init() {
        connect("ws://localhost:8080");
        System.out.println("RemoteArtifact initialized");
    }

    protected void invokeRemote(String artifact, String operation, JSONObject args) {
        if (webSocket == null) {
            execInternalOp(
                    "processRemoteMessage",
                    createErrorMessage(
                            "unknown",
                            "not_connected",
                            "WebSocket is not connected"
                    ).toString()
            );
            return;
        }

        String callId = String.valueOf(callCounter.incrementAndGet());

        JSONObject request = new JSONObject();
        request.put("type", "operation_request");
        request.put("callId", callId);
        request.put("artifact", artifact);
        request.put("operation", operation);
        request.put("args", args);

        webSocket.sendText(request.toString(), true);

        signal("remote_started", callId, operation);
    }

    private void connect(String url) {
        try {
            HttpClient client = HttpClient.newHttpClient();

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

                                execInternalOp("processRemoteMessage", completeMessage);
                            }

                            webSocket.request(1);
                            return null;
                        }

                        @Override
                        public void onError(WebSocket webSocket, Throwable error) {
                            String message = error.getMessage() != null
                                    ? error.getMessage()
                                    : "Unknown WebSocket error";

                            execInternalOp(
                                    "processRemoteMessage",
                                    createErrorMessage(
                                            "unknown",
                                            "websocket_error",
                                            message
                                    ).toString()
                            );
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
            System.out.println("Connected to remote artifact runtime");

        } catch (Exception error) {
            String message = error.getMessage() != null
                    ? error.getMessage()
                    : "Unknown connection error";

            System.out.println("Failed to connect to remote artifact runtime: " + message);

            signal("remote_error", "unknown", "connection_failed", message);
        }
    }

    @INTERNAL_OPERATION
    void processRemoteMessage(String rawMessage) {
        handleMessage(rawMessage);
    }

    private void handleMessage(String rawMessage) {
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
                        "remote_error",
                        "unknown",
                        "unknown_message_type",
                        type
                );
            }

        } catch (Exception error) {
            String message = error.getMessage() != null
                    ? error.getMessage()
                    : "Invalid remote message";

            signal("remote_error", "unknown", "invalid_message", message);
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
}