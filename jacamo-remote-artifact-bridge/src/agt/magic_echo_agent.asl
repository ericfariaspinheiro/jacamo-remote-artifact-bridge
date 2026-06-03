!start.

+!start <-
    .print("Starting JaCaMagic WebSocket manifest test...");
    joinWorkspace("main", WspId);
    lookupArtifact("magic", MagicId);
    focus(MagicId);
    echo("hello from remote manifest").

+echo_result(Message) <-
    .print("JaCaMagic echo result: ", Message).

+magic_ready(ArtifactName) <-
    .print("JaCaMagic artifact ready: ", ArtifactName).

+magic_error(Message) <-
    .print("JaCaMagic error: ", Message).

+remote_started(CallId, Operation) <-
    .print("Remote operation started: ", Operation, " / callId: ", CallId).

+remote_done(CallId) <-
    .print("Remote operation finished. callId: ", CallId).