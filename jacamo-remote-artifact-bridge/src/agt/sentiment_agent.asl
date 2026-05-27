!start.

+!start <-
    .print("Starting remote sentiment test...");
    joinWorkspace("main", WspId);
    lookupArtifact("sentiment", SentimentId);
    focus(SentimentId);

    clearReplies;
    addReply("I love this product");
    addReply("This is terrible");
    addReply("This is a factual comment");
    analyze.

+sentiment_result(Index, Sentiment) <-
    .print("Sentiment result ", Index, ": ", Sentiment).

+analysis_count(Count) <-
    .print("Analysis count: ", Count).

+analysis_done <-
    .print("Sentiment analysis finished.").

+remote_started(CallId, Operation) <-
    .print("Remote operation started: ", Operation, " / callId: ", CallId).

+remote_done(CallId) <-
    .print("Remote operation finished. callId: ", CallId).

+remote_error(CallId, Code, Message) <-
    .print("Remote error: ", Code, " - ", Message, " / callId: ", CallId).