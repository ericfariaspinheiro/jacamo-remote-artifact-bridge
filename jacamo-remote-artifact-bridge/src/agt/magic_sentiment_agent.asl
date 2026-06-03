!start.

+!start <-
    .print("Starting JaCaMagic SentimentArtifact test...");
    joinWorkspace("main", WspId);
    lookupArtifact("sentiment", SentimentId);
    focus(SentimentId);

    clearReplies;
    clearResults;

    addReply("I love this product");
    addReply("This is terrible");
    addReply("This is a factual comment");

    .wait(1000);
    analyze.

+analysis_count(Count) <-
    .print("Analysis count: ", Count).

+sentiment_result(Index, Sentiment) <-
    .print("Sentiment result ", Index, ": ", Sentiment).

+analysis_done <-
    .print("Sentiment analysis finished.").

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