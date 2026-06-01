package env;

import org.json.JSONObject;

import cartago.OPERATION;

public class TwitterProxyArtifact extends RemoteArtifact {

    @OPERATION
    public void collectTweets(String username) {
        JSONObject args = new JSONObject();
        args.put("username", username);

        invokeRemote("TwitterArtifact", "collectTweets", args);
    }
}