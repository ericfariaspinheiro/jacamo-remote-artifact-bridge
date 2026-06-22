import "dotenv/config"

import { WebSocketServer } from "ws"

import { SentimentArtifact } from "./artifacts/SentimentArtifact.js"
import { TwitterArtifact } from "./artifacts/TwitterArtifact.js"
import { getManifestForArtifact } from "./manifestRegistry.js"

import type {
  IncomingMessage,
  OperationRequest,
  OutgoingMessage,
} from "./protocol.js"

const PORT = 8080

const server = new WebSocketServer({ port: PORT })

const sentimentArtifact = new SentimentArtifact()
const twitterArtifact = new TwitterArtifact()

let connectionCounter = 0

console.log(`[runtime] Artifact runtime listening on ws://localhost:${PORT}`)

server.on("connection", socket => {
  const connectionId = ++connectionCounter

  console.log(`[runtime][connection:${connectionId}] MagicArtifact connected`)

  socket.on("message", async raw => {
    let callId = "unknown"
    let requestLabel = "unidentified request"

    try {
      const message = parseIncomingMessage(raw.toString())

      if (message.type === "runtime_hello") {
        requestLabel = `manifest for ${message.artifact}`

        console.log(
          `[runtime][connection:${connectionId}] Manifest requested: ${message.artifact}`
        )

        const manifest = getManifestForArtifact(message.artifact)

        socket.send(JSON.stringify(manifest))

        console.log(
          `[runtime][connection:${connectionId}] Manifest sent: ${manifest.artifact} ` +
            `(${manifest.operations.length} operation(s))`
        )

        return
      }

      callId = message.callId
      requestLabel = `${message.artifact}.${message.operation}`

      console.log(
        `[runtime][connection:${connectionId}] Operation received: ` +
          `${requestLabel} (callId=${callId})`
      )

      const responses = await dispatch(message)

      for (const response of responses) {
        socket.send(JSON.stringify(response))
      }

      console.log(
        `[runtime][connection:${connectionId}] Operation completed: ` +
          `${requestLabel} (callId=${callId}; ${summarizeResponses(responses)})`
      )
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown runtime error"

      console.error(
        `[runtime][connection:${connectionId}] Request failed: ` +
          `${requestLabel} (callId=${callId}): ${errorMessage}`
      )

      const response: OutgoingMessage = {
        type: "error",
        callId,
        code: "runtime_error",
        message: errorMessage,
      }

      socket.send(JSON.stringify(response))
    }
  })

  socket.on("close", () => {
    console.log(
      `[runtime][connection:${connectionId}] MagicArtifact disconnected`
    )
  })

  socket.on("error", error => {
    console.error(
      `[runtime][connection:${connectionId}] WebSocket error: ${error.message}`
    )
  })
})

async function dispatch(message: OperationRequest): Promise<OutgoingMessage[]> {
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

function parseIncomingMessage(rawMessage: string): IncomingMessage {
  const parsed = JSON.parse(rawMessage) as unknown

  if (!isRecord(parsed) || typeof parsed.type !== "string") {
    throw new Error("Invalid message: missing message type")
  }

  if (parsed.type === "runtime_hello") {
    if (
      typeof parsed.protocolVersion !== "string" ||
      typeof parsed.artifact !== "string"
    ) {
      throw new Error("Invalid runtime_hello message")
    }

    return parsed as IncomingMessage
  }

  if (parsed.type === "operation_request") {
    if (
      typeof parsed.callId !== "string" ||
      typeof parsed.artifact !== "string" ||
      typeof parsed.operation !== "string" ||
      !isRecord(parsed.args)
    ) {
      throw new Error("Invalid operation_request message")
    }

    return parsed as IncomingMessage
  }

  throw new Error(`Unsupported message type: ${parsed.type}`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function summarizeResponses(responses: OutgoingMessage[]): string {
  if (responses.length === 0) {
    return "no response messages"
  }

  const responseCounts = new Map<string, number>()

  for (const response of responses) {
    responseCounts.set(
      response.type,
      (responseCounts.get(response.type) ?? 0) + 1
    )
  }

  const summary = [...responseCounts.entries()]
    .map(([type, count]) => `${type}=${count}`)
    .join(", ")

  return `${responses.length} message(s): ${summary}`
}
