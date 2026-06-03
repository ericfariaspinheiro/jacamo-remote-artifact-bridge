!start.

+!start <-
    .print("Starting JaCaMagic manifest-based operation test...");
    joinWorkspace("main", WspId);
    lookupArtifact("magic", MagicId);
    focus(MagicId);
    echo("hello from manifest").

+echo_result(Message) <-
    .print("JaCaMagic echo result: ", Message).

+magic_ready(ArtifactName) <-
    .print("JaCaMagic artifact ready: ", ArtifactName).

+magic_error(Message) <-
    .print("JaCaMagic error: ", Message).

+magic_operation_called(Operation, Args) <-
    .print("JaCaMagic operation called: ", Operation, " args: ", Args).