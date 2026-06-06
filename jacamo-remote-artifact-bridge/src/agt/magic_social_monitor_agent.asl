/* ========= BELIEFS ========= */

currentUser("lulaoficial").

positiveCount(0).
negativeCount(0).
neutralCount(0).

/* ========= GOALS ========= */

!start.

/* ========= START ========= */

+!start
   <- .print("Starting JaCaMagic social monitor...");
      joinWorkspace("main", WspId);

      lookupArtifact("twitter", TwitterId);
      focus(TwitterId);

      lookupArtifact("sentiment", SentimentId);
      focus(SentimentId);

      !reset_state;
      ?currentUser(User);
      .print("Coletando replies de: ", User);
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
      .print("Tweet analisado: ", Text).

+reply(Id, Text, Author, Time, Likes)
   <- +replyData(Id, Text, Author, Time, Likes);
      addReply(Text).

+replies_done
   : replyData(_,_,_,_,_)
   <- .print("Replies coletadas. Iniciando análise...");
      .wait(2000);
      analyze.

+replies_done
   : not replyData(_,_,_,_,_)
   <- .print("Nenhuma reply encontrada para análise.").

/* ========= ANALYSIS RESULTS ========= */

+analysis_count(Count)
   <- .print("Total analisado: ", Count).

+sentiment_result(Index, Sentiment)
   <- true.

+analysis_done
   <- .print("");
      .print("RESULTADO INDIVIDUAL DAS REPLIES");
      !process_results(1);
      !print_summary.

/* ========= PROCESS RESULTS ========= */

+!process_results(Index)
   : sentiment_result(Index, Sentiment) & replyData(Index, Text, Author, Time, Likes)
   <- .print("");
      .print("Reply ", Index, ": ", Text);
      .print("Autor: ", Author);
      .print("Likes: ", Likes);
      .print("Sentimento: ", Sentiment);
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
      +negativeCount(N+1).

+!act("neutral")
   <- ?neutralCount(N);
      -neutralCount(N);
      +neutralCount(N+1).

/* ========= REMOTE STATUS ========= */

+magic_ready(ArtifactName)
   <- true.

+magic_error(Message)
   <- .print("JaCaMagic error: ", Message).

+remote_started(CallId, Operation)
   <- true.

+remote_done(CallId)
   <- true.

+remote_error(CallId, Code, Message)
   <- .print("Remote error: ", Code, " - ", Message, " / callId: ", CallId).

/* ========= SUMMARY ========= */

+!print_summary
   <- .print("");
      .print("RESUMO FINAL");
      ?positiveCount(P);
      ?negativeCount(N);
      ?neutralCount(U);
      .print("Positivos: ", P);
      .print("Negativos: ", N);
      .print("Neutros: ", U).