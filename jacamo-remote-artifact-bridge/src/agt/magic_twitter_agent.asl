!start.

+!start <-
    .print("Starting JaCaMagic TwitterArtifact test...");
    joinWorkspace("main", WspId);
    lookupArtifact("twitter", TwitterId);
    focus(TwitterId);

    collectTweets("openai").

+tweet(Id, Text, Author, CreatedAt, Likes) <-
    .print("Tweet found:");
    .print("Id: ", Id);
    .print("Author: ", Author);
    .print("Created at: ", CreatedAt);
    .print("Likes: ", Likes);
    .print("Text: ", Text).

+reply(Index, Text, Author, CreatedAt, Likes) <-
    .print("Reply ", Index, ": ", Text);
    .print("Author: ", Author, " / Likes: ", Likes).

+replies_done <-
    .print("Replies collection finished.").

+magic_ready(ArtifactName) <-
    .print("JaCaMagic artifact ready: ", ArtifactName).

+magic_error(Message) <-
    .print("JaCaMagic error: ", Message).

+remote_started(CallId, Operation) <-
    .print("Remote operation started: ", Operation, " / callId: ", CallId).

+remote_done(CallId) <-
    .print("Remote operation finished. callId: ", CallId).

+remote_error(CallId, Code, Message) <-
    .print("Remote error: ", Code, " - ", Message, " / callId: ", CallId).