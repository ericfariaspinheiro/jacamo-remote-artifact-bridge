import "dotenv/config"

import { WebSocketServer } from "ws"

import { EchoArtifact } from "./artifacts/EchoArtifact.js"
import { SentimentArtifact } from "./artifacts/SentimentArtifact.js"
import { TwitterArtifact } from "./artifacts/TwitterArtifact.js"

import type {
  ArtifactManifestMessage,
  IncomingMessage,
  OperationRequest,
  OutgoingMessage,
} from "./protocol.js"

const PORT = 8080

const server = new WebSocketServer({ port: PORT })

const echoArtifact = new EchoArtifact()
const sentimentArtifact = new SentimentArtifact()
const twitterArtifact = new TwitterArtifact()

console.log(`Artifact runtime listening on ws://localhost:${PORT}`)

server.on("connection", socket => {
  console.log("JaCaMagic artifact connected")

  socket.on("message", async raw => {
    let callId = "unknown"

    try {
      const message = JSON.parse(raw.toString()) as IncomingMessage

      if (message.type === "runtime_hello") {
        const manifest = createEchoManifest()
        socket.send(JSON.stringify(manifest))
        return
      }

      if (message.type !== "operation_request") {
        throw new Error(`Unsupported message type: ${(message as any).type}`)
      }

      callId = message.callId

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
    console.log("JaCaMagic artifact disconnected")
  })
})

function createEchoManifest(): ArtifactManifestMessage {
  return {
    type: "artifact_manifest",
    artifact: "EchoArtifact",
    operations: [
      {
        name: "echo",
        args: [
          {
            name: "message",
            type: "string",
          },
        ],
      },
    ],
    signals: [
      {
        name: "echo_result",
        args: ["string"],
      },
    ],
    observableProperties: [],
  }
}

async function dispatch(message: OperationRequest): Promise<OutgoingMessage[]> {
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

    if (message.operation === "clearResults") {
      return sentimentArtifact.clearResults(message.callId)
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

  if (message.artifact === "TwitterArtifact") {
    if (message.operation !== "collectTweets") {
      throw new Error(`Unknown TwitterArtifact operation: ${message.operation}`)
    }

    const username = message.args.username

    if (typeof username !== "string") {
      throw new Error("Argument 'username' must be a string")
    }

    return twitterArtifact.collectTweets(message.callId, username)
  }

  throw new Error(`Unknown artifact: ${message.artifact}`)
}