!start.

+!start <-
    .print("Starting integrated social monitor test...");

    joinWorkspace("main", WspId);

    lookupArtifact("twitter", TwitterId);
    focus(TwitterId);

    lookupArtifact("sentiment", SentimentId);
    focus(SentimentId);

    clearReplies;
    .wait(500);

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
    .print("Author: ", Author, " / Likes: ", Likes);
    addReply(Text).

+replies_done <-
    .print("Replies collection finished.");
    .print("Starting sentiment analysis...");
    .wait(1000);
    analyze.

+analysis_count(Count) <-
    .print("Analysis count: ", Count).

+sentiment_result(Index, Sentiment) <-
    .print("Sentiment result ", Index, ": ", Sentiment).

+analysis_done <-
    .print("Sentiment analysis finished.").

+remote_started(CallId, Operation) <-
    .print("Remote operation started: ", Operation, " / callId: ", CallId).

+remote_done(CallId) <-
    .print("Remote operation finished. callId: ", CallId).

+remote_error(CallId, Code, Message) <-
    .print("Remote error: ", Code, " - ", Message, " / callId: ", CallId).