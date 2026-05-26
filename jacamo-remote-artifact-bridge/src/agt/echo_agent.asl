!start.

+!start <-
    .print("Starting remote echo test...");
    joinWorkspace("main", WspId);
    lookupArtifact("echo", EchoId);
    focus(EchoId);
    echo("hello from Jason").

+echo_result(Message) <-
    .print("Resposta recebida do artefato remoto: ", Message).

+remote_started(CallId, Operation) <-
    .print("Remote operation started: ", Operation, " / callId: ", CallId).

+remote_done(CallId) <-
    .print("Remote operation finished. callId: ", CallId).

+remote_error(CallId, Code, Message) <-
    .print("Remote error: ", Code, " - ", Message, " / callId: ", CallId).