package env;

import cartago.OPERATION;
import org.json.JSONObject;

public class EchoProxyArtifact extends RemoteArtifact {

    @OPERATION
    public void echo(String message) {
        JSONObject args = new JSONObject();
        args.put("message", message);

        invokeRemote("EchoArtifact", "echo", args);
    }
}