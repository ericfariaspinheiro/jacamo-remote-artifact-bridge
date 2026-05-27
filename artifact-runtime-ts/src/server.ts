import { WebSocketServer } from "ws"
import { EchoArtifact } from "./artifacts/EchoArtifact.js"
import { SentimentArtifact } from "./artifacts/SentimentArtifact.js"
import type { IncomingMessage, OutgoingMessage } from "./protocol.js"

const PORT = 8080

const server = new WebSocketServer({ port: PORT })

const echoArtifact = new EchoArtifact()
const sentimentArtifact = new SentimentArtifact()

console.log(`Artifact runtime listening on ws://localhost:${PORT}`)

server.on("connection", socket => {
  console.log("JaCaMo proxy connected")

  socket.on("message", async raw => {
    let callId = "unknown"

    try {
      const message = JSON.parse(raw.toString()) as IncomingMessage
      callId = message.callId

      if (message.type !== "operation_request") {
        throw new Error(`Unsupported message type: ${(message as any).type}`)
      }

      const responses = await dispatch(message)

      for (const response of responses) {
        socket.send(JSON.stringify(response))
      }
    } catch (error) {
      const response: OutgoingMessage = {
        type: "error",
        callId,
        code: "runtime_error",
        message: error instanceof Error ? error.message : "Unknown error",
      }

      socket.send(JSON.stringify(response))
    }
  })

  socket.on("close", () => {
    console.log("JaCaMo proxy disconnected")
  })
})

async function dispatch(message: IncomingMessage): Promise<OutgoingMessage[]> {
  if (message.artifact === "EchoArtifact") {
    if (message.operation !== "echo") {
      throw new Error(`Unknown EchoArtifact operation: ${message.operation}`)
    }

    const text = message.args.message

    if (typeof text !== "string") {
      throw new Error("Argument 'message' must be a string")
    }

    return echoArtifact.echo(message.callId, text)
  }

  if (message.artifact === "SentimentArtifact") {
    if (message.operation === "clearReplies") {
      return sentimentArtifact.clearReplies(message.callId)
    }

    if (message.operation === "addReply") {
      const text = message.args.text

      if (typeof text !== "string") {
        throw new Error("Argument 'text' must be a string")
      }

      return sentimentArtifact.addReply(message.callId, text)
    }

    if (message.operation === "analyze") {
      return sentimentArtifact.analyze(message.callId)
    }

    throw new Error(`Unknown SentimentArtifact operation: ${message.operation}`)
  }

  throw new Error(`Unknown artifact: ${message.artifact}`)
}