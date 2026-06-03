/* ========= BELIEFS ========= */

currentUser("LulaOficial").

positiveCount(0).
negativeCount(0).
neutralCount(0).

/* ========= GOALS ========= */

!start.

/* ========= START ========= */

+!start
   <- .print("Iniciando Agente de Social Media Sentiment");
      !enter_workspace;
      !init_artifacts;
      !reset_state;
      ?currentUser(User);
      !collect(User).

/* ========= ENTER WORKSPACE ========= */

+!enter_workspace
   <- joinWorkspace("main", _);
      .print("Estou no workspace main").

/* ========= INIT ARTIFACTS ========= */

+!init_artifacts
   <- !focus_art("twitter");
      !focus_art("sentiment").

+!focus_art(Name)
   <- lookupArtifact(Name, Id);
      focus(Id).

-!focus_art(Name)
   <- .print("Esperando pelo artefato ", Name);
      .wait(500);
      !focus_art(Name).

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

/* ========= COLLECT ========= */

+!collect(User)
   <- .print("Coletando tweets de ", User);
      collectTweets(User).

/* ========= PERCEPTION FROM TWITTER ========= */

+tweet(Id, Text, Author, Time, Likes)
   <- +lastTweet(Id, Text, Author, Time, Likes);
      .print("Tweet analisado: ", Text).

+reply(Id, Text, Author, Time, Likes)
   <- +replyData(Id, Text, Author, Time, Likes);
      addReply(Text).

+replies_done
   : replyData(_,_,_,_,_)
   <- .print("Replies coletadas.");
      !analyze.

+replies_done
   : not replyData(_,_,_,_,_)
   <- .print("Nenhuma reply encontrada para análise.").

/* ========= ANALYZE ========= */

+!analyze
   <- .print("Enviando lote de replies para análise...");
      .wait(2000);
      analyze.

/* ========= PROCESS RESULTS ========= */

+analysis_done
   <- !process_results(1);
      !print_summary.

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
      .print("⚠️ Resposta negativa detectada.").

+!act("neutral")
   <- ?neutralCount(N);
      -neutralCount(N);
      +neutralCount(N+1).

/* ========= REMOTE STATUS ========= */

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