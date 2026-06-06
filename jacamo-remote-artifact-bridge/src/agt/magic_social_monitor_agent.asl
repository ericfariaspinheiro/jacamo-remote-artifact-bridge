/* ========= BELIEFS ========= */

currentUser("lulaoficial").

positiveCount(0).
negativeCount(0).
neutralCount(0).

/* ========= GOALS ========= */

!start.

/* ========= START ========= */

+!start
   <- .print("Starting JaCaMagic integrated social monitor...");
      joinWorkspace("main", WspId);

      lookupArtifact("twitter", TwitterId);
      focus(TwitterId);

      lookupArtifact("sentiment", SentimentId);
      focus(SentimentId);

      !reset_state;
      ?currentUser(User);
      collectTweets(User).

/* ========= RESET ========= */

+!reset_state
   <- .abolish(positiveCount(_));
      .abolish(negativeCount(_));
      .abolish(neutralCount(_));
      +positiveCount(0);
      +negativeCount(0);
      +neutralCount(0);

      .abolish(replyData(_,_,_,_,_));
      .abolish(lastTweet(_,_,_,_,_));

      clearReplies;
      clearResults.

/* ========= PERCEPTION FROM TWITTER ========= */

+tweet(Id, Text, Author, Time, Likes)
   <- +lastTweet(Id, Text, Author, Time, Likes);
      .print("Tweet analyzed: ", Text).

+reply(Id, Text, Author, Time, Likes)
   <- +replyData(Id, Text, Author, Time, Likes);
      .print("Reply ", Id, ": ", Text);
      addReply(Text).

+replies_done
   : replyData(_,_,_,_,_)
   <- .print("Replies collected.");
      .print("Starting sentiment analysis...");
      .wait(2000);
      analyze.

+replies_done
   : not replyData(_,_,_,_,_)
   <- .print("No replies found for analysis.").

/* ========= PROCESS RESULTS ========= */

+analysis_count(Count)
   <- .print("Analysis count: ", Count).

+analysis_done
   <- !process_results(1);
      !print_summary.

+sentiment_result(Index, Sentiment)
   <- .print("Sentiment result ", Index, ": ", Sentiment).

+!process_results(Index)
   : sentiment_result(Index, Sentiment) & replyData(Index, Text, _, _, _)
   <- .print("\n--- Agent Cycle ---");
      .print("Reply: ", Text);
      .print("Sentiment: ", Sentiment);
      !act(Sentiment);
      !process_results(Index+1).

+!process_results(_).

/* ========= ACTION ========= */

+!act("positive")
   <- ?positiveCount(N);
      -positiveCount(N);
      +positiveCount(N+1).

+!act("negative")
   <- ?negativeCount(N);
      -negativeCount(N);
      +negativeCount(N+1);
      .print("⚠️ Negative reply detected.").

+!act("neutral")
   <- ?neutralCount(N);
      -neutralCount(N);
      +neutralCount(N+1).

/* ========= REMOTE STATUS ========= */

+magic_ready(ArtifactName)
   <- .print("JaCaMagic artifact ready: ", ArtifactName).

+magic_error(Message)
   <- .print("JaCaMagic error: ", Message).

+remote_started(CallId, Operation)
   <- .print("Remote operation started: ", Operation, " / callId: ", CallId).

+remote_done(CallId)
   <- .print("Remote operation finished. callId: ", CallId).

+remote_error(CallId, Code, Message)
   <- .print("Remote error: ", Code, " - ", Message, " / callId: ", CallId).

/* ========= SUMMARY ========= */

+!print_summary
   <- .print("\nRESUMO FINAL");
      ?positiveCount(P);
      ?negativeCount(N);
      ?neutralCount(U);
      .print("Positivos: ", P);
      .print("Negativos: ", N);
      .print("Neutros: ", U).