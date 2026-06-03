!start.

+!start <-
    .print("Starting JaCaMagic dynamic operation test...");
    joinWorkspace("main", WspId);
    lookupArtifact("magic", MagicId);
    focus(MagicId);
    echo("hello from JaCaMagic").

+echo_result(Message) <-
    .print("JaCaMagic echo result: ", Message).

+magic_error(Message) <-
    .print("JaCaMagic error: ", Message).