package env;

import org.json.JSONObject;

import cartago.OPERATION;

public class SentimentProxyArtifact extends RemoteArtifact {

    @OPERATION
    public void clearReplies() {
        invokeRemote("SentimentArtifact", "clearReplies", new JSONObject());
    }

    @OPERATION
    public void addReply(String text) {
        JSONObject args = new JSONObject();
        args.put("text", text);

        invokeRemote("SentimentArtifact", "addReply", args);
    }

    @OPERATION
    public void analyze() {
        invokeRemote("SentimentArtifact", "analyze", new JSONObject());
    }
}