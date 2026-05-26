import { WebSocketServer } from "ws"
import { EchoArtifact } from "./artifacts/EchoArtifact.js"
import type { IncomingMessage, OutgoingMessage } from "./protocol.js"

const PORT = 8080

const server = new WebSocketServer({ port: PORT })
const echoArtifact = new EchoArtifact()

console.log(`Artifact runtime listening on ws://localhost:${PORT}`)

server.on("connection", socket => {
  console.log("JaCaMo proxy connected")

  socket.on("message", async raw => {
    try {
      const message = JSON.parse(raw.toString()) as IncomingMessage

      if (message.type !== "operation_request") {
        throw new Error(`Unsupported message type: ${(message as any).type}`)
      }

      if (message.artifact !== "EchoArtifact") {
        throw new Error(`Unknown artifact: ${message.artifact}`)
      }

      if (message.operation !== "echo") {
        throw new Error(`Unknown operation: ${message.operation}`)
      }

      const text = message.args.message

      if (typeof text !== "string") {
        throw new Error("Argument 'message' must be a string")
      }

      const responses = await echoArtifact.echo(message.callId, text)

      for (const response of responses) {
        socket.send(JSON.stringify(response))
      }
    } catch (error) {
      const response: OutgoingMessage = {
        type: "error",
        callId: "unknown",
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