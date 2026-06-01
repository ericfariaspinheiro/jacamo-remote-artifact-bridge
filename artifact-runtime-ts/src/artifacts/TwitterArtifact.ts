import type { DoneMessage, SignalMessage } from "../protocol.js"
import { TweetCollectorService } from "../services/TweetCollectorService.js"

export class TwitterArtifact {
  private collector = new TweetCollectorService()

  async collectTweets(
    callId: string,
    username: string
  ): Promise<(SignalMessage | DoneMessage)[]> {
    const { tweet, replies } = await this.collector.perceive(username)

    const responses: (SignalMessage | DoneMessage)[] = []

    if (!tweet) {
      responses.push({
        type: "signal",
        callId,
        name: "replies_done",
        args: [],
      })

      responses.push({
        type: "done",
        callId,
      })

      return responses
    }

    responses.push({
      type: "signal",
      callId,
      name: "tweet",
      args: [
        tweet.id,
        tweet.text,
        tweet.author,
        tweet.createdAt,
        tweet.likes,
      ],
    })

    replies.forEach((reply, index) => {
      responses.push({
        type: "signal",
        callId,
        name: "reply",
        args: [
          index + 1,
          reply.text,
          reply.author,
          reply.createdAt,
          reply.likes,
        ],
      })
    })

    responses.push({
      type: "signal",
      callId,
      name: "replies_done",
      args: [],
    })

    responses.push({
      type: "done",
      callId,
    })

    return responses
  }
}