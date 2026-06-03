package env;

import java.io.BufferedReader;
import java.io.FileInputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;

import org.json.JSONArray;
import org.json.JSONObject;

import cartago.Artifact;
import cartago.IArtifactOp;

public class MagicArtifact extends Artifact {

    private String remoteArtifactName;

    void init() {
        init("manifests/echo.manifest.json");
    }

    void init(String manifestPath) {
        System.out.println("JaCaMagic: MagicArtifact initialized");
        System.out.println("JaCaMagic: loading local manifest: " + manifestPath);

        JSONObject manifest = loadManifest(manifestPath);

        remoteArtifactName = manifest.optString("artifact", "UnknownArtifact");

        JSONArray operations = manifest.optJSONArray("operations");

        if (operations == null) {
            signal("magic_error", "manifest does not contain operations");
            return;
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

    private JSONObject loadManifest(String manifestPath) {
        try {
            InputStream inputStream = getClass()
                    .getClassLoader()
                    .getResourceAsStream(manifestPath);

            if (inputStream == null) {
                inputStream = new FileInputStream(manifestPath);
            }

            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(inputStream, StandardCharsets.UTF_8)
            )) {
                StringBuilder content = new StringBuilder();
                String line;

                while ((line = reader.readLine()) != null) {
                    content.append(line);
                }

                return new JSONObject(content.toString());
            }
        } catch (Exception error) {
            throw new RuntimeException(
                    "Failed to load manifest: " + manifestPath,
                    error
            );
        }
    }

    private void registerDynamicOperation(JSONObject operationSpec) {
        String operationName = operationSpec.getString("name");
        JSONArray args = operationSpec.optJSONArray("args");

        int arity = args == null ? 0 : args.length();

        defineOp(new ManifestDynamicOperation(operationSpec), null);

        System.out.println(
                "JaCaMagic: dynamic operation registered from manifest: "
                        + operationName
                        + "/"
                        + arity
        );
    }

    private class ManifestDynamicOperation implements IArtifactOp {

        private final JSONObject operationSpec;
        private final String operationName;
        private final JSONArray args;
        private final JSONObject mockResponse;

        ManifestDynamicOperation(JSONObject operationSpec) {
            this.operationSpec = operationSpec;
            this.operationName = operationSpec.getString("name");
            this.args = operationSpec.optJSONArray("args");
            this.mockResponse = operationSpec.optJSONObject("mockResponse");
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
                    "JaCaMagic: dynamic operation "
                            + operationName
                            + " called with "
                            + namedArgs
            );

            emitMockResponse(namedArgs);
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

        private void emitMockResponse(JSONObject namedArgs) {
            if (mockResponse == null) {
                signal("magic_operation_called", operationName, namedArgs.toString());
                return;
            }

            String responseType = mockResponse.optString("type", "signal");

            if (!"signal".equals(responseType)) {
                signal(
                        "magic_error",
                        "unsupported mock response type: " + responseType
                );
                return;
            }

            String signalName = mockResponse.getString("name");
            JSONArray argsFrom = mockResponse.optJSONArray("argsFrom");

            if (argsFrom == null || argsFrom.length() == 0) {
                signal(signalName);
                return;
            }

            Object[] signalArgs = new Object[argsFrom.length()];

            for (int i = 0; i < argsFrom.length(); i++) {
                String argName = argsFrom.getString(i);
                signalArgs[i] = namedArgs.opt(argName);
            }

            signal(signalName, signalArgs);
        }
    }
}