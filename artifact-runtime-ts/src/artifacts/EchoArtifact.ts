import type { SignalMessage, DoneMessage } from "../protocol.js"

export class EchoArtifact {
  async echo(callId: string, message: string): Promise<(SignalMessage | DoneMessage)[]> {
    return [
      {
        type: "signal",
        callId,
        name: "echo_result",
        args: [message],
      },
      {
        type: "done",
        callId,
      },
    ]
  }
}