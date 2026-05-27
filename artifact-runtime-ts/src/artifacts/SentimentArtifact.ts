import type {
  ClearObservablePropertiesMessage,
  DoneMessage,
  ObservablePropertyMessage,
  SignalMessage,
} from "../protocol.js"

type Sentiment = "positive" | "negative" | "neutral"

export class SentimentArtifact {
  private replies: string[] = []

  async clearReplies(callId: string): Promise<DoneMessage[]> {
    this.replies = []

    return [
      {
        type: "done",
        callId,
      },
    ]
  }

  async addReply(callId: string, text: string): Promise<DoneMessage[]> {
    if (text.trim()) {
      this.replies.push(text.trim())
    }

    return [
      {
        type: "done",
        callId,
      },
    ]
  }

  async analyze(
    callId: string
  ): Promise<
    (
      | ClearObservablePropertiesMessage
      | ObservablePropertyMessage
      | SignalMessage
      | DoneMessage
    )[]
  > {
    const limitedReplies = this.replies.slice(0, 20)

    const responses: (
      | ClearObservablePropertiesMessage
      | ObservablePropertyMessage
      | SignalMessage
      | DoneMessage
    )[] = [
      {
        type: "clear_observable_properties",
        callId,
        name: "analysis_count",
      },
      {
        type: "clear_observable_properties",
        callId,
        name: "sentiment_result",
      },
      {
        type: "observable_property",
        callId,
        name: "analysis_count",
        args: [limitedReplies.length],
      },
    ]

    limitedReplies.forEach((reply, index) => {
      responses.push({
        type: "observable_property",
        callId,
        name: "sentiment_result",
        args: [index + 1, this.classify(reply)],
      })
    })

    responses.push({
      type: "signal",
      callId,
      name: "analysis_done",
      args: [],
    })

    responses.push({
      type: "done",
      callId,
    })

    return responses
  }

  private classify(text: string): Sentiment {
    const normalized = text.toLowerCase()

    const negativeWords = [
      "bad",
      "terrible",
      "hate",
      "awful",
      "horrible",
      "worst",
      "ruim",
      "péssimo",
      "odeio",
      "horrível",
    ]

    const positiveWords = [
      "good",
      "great",
      "love",
      "excellent",
      "amazing",
      "best",
      "bom",
      "ótimo",
      "amo",
      "excelente",
      "incrível",
    ]

    if (negativeWords.some(word => normalized.includes(word))) {
      return "negative"
    }

    if (positiveWords.some(word => normalized.includes(word))) {
      return "positive"
    }

    return "neutral"
  }
}