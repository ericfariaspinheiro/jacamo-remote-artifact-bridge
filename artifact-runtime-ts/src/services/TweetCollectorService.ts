import axios from "axios"
import type { Tweet } from "../types/Tweet.js"

const USER_TWEETS_URL = "https://api.twitterapi.io/twitter/user/last_tweets"
const TWEET_REPLIES_URL_V2 = "https://api.twitterapi.io/twitter/tweet/replies/v2"

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

type CollectionResult = {
  tweet: Tweet | null
  replies: Tweet[]
}

let cache: {
  username: string
  data: CollectionResult
} | null = null

export class TweetCollectorService {
  private apiKey: string

  constructor() {
    const apiKey = process.env.TWITTER_API_KEY

    if (!apiKey) {
      throw new Error("TWITTER_API_KEY is not defined")
    }

    this.apiKey = apiKey
  }

  async perceive(username: string): Promise<CollectionResult> {
    if (cache && cache.username === username) {
      console.log(`Using cached Twitter data for ${username}`)
      return cache.data
    }

    try {
      const tweetResponse = await axios.get(USER_TWEETS_URL, {
        headers: {
          "X-API-Key": this.apiKey,
        },
        params: {
          userName: username,
          limit: 3,
        },
      })

      const tweets = tweetResponse.data?.data?.tweets ?? []

      if (!tweets.length) {
        return { tweet: null, replies: [] }
      }

      for (const rawTweet of tweets) {
        const tweet: Tweet = {
          id: String(rawTweet.id ?? ""),
          text: this.cleanTweetText(rawTweet.text ?? ""),
          author:
            rawTweet.author?.username ??
            rawTweet.author?.userName ??
            username,
          createdAt: String(rawTweet.createdAt ?? ""),
          likes: Number(rawTweet.likeCount ?? 0),
        }

        if (!tweet.id || !tweet.text) {
          continue
        }

        await sleep(6000)

        const repliesResponse = await axios.get(TWEET_REPLIES_URL_V2, {
          headers: {
            "X-API-Key": this.apiKey,
          },
          params: {
            tweetId: tweet.id,
            cursor: "",
            queryType: "Latest",
          },
        })

        const repliesRaw =
          repliesResponse.data?.replies ??
          repliesResponse.data?.tweets ??
          []

        const replies: Tweet[] = repliesRaw
          .filter((reply: any) => reply.text && reply.text.length > 3)
          .map((reply: any, index: number) => ({
            id: String(reply.id ?? index + 1),
            text: this.cleanTweetText(reply.text ?? ""),
            author:
              reply.author?.userName ??
              reply.author?.username ??
              "unknown",
            createdAt: String(reply.createdAt ?? ""),
            likes: Number(reply.likeCount ?? 0),
          }))
          .filter((reply: Tweet) => reply.text.length > 3)

        if (replies.length > 0) {
          const result = { tweet, replies }

          cache = {
            username,
            data: result,
          }

          return result
        }
      }

      return { tweet: null, replies: [] }
    } catch (error: unknown) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 429) {
          console.log("Twitter API rate limit reached")
        }

        console.log(
          "Twitter API error:",
          error.response?.data ?? error.message
        )
      } else {
        console.log("Unknown Twitter collector error:", error)
      }

      return { tweet: null, replies: [] }
    }
  }

  private cleanTweetText(text: string): string {
    return text
      .replace(/http\S+/g, "")
      .replace(/@\w+/g, "")
      .replace(/\s+/g, " ")
      .trim()
  }
}