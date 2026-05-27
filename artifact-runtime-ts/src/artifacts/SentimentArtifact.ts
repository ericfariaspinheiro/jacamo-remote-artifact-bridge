import type {
  ClearObservablePropertiesMessage,
  DoneMessage,
  ObservablePropertyMessage,
  SignalMessage,
} from "../protocol.js"

import { SentimentAnalysisService } from "../services/SentimentAnalysisService.js"

export class SentimentArtifact {
  private replies: string[] = []
  private analyzer = new SentimentAnalysisService()

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
    const sentiments = await this.analyzer.reason(limitedReplies)

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
        args: [sentiments.length],
      },
    ]

    sentiments.forEach((sentiment, index) => {
      responses.push({
        type: "observable_property",
        callId,
        name: "sentiment_result",
        args: [index + 1, sentiment],
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
}