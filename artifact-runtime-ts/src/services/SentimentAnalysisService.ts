import { GoogleGenAI } from "@google/genai"
import type { Tweet } from "../types/Tweet.js"

export type Sentiment = "positive" | "negative" | "neutral"

type ReasonInput = Tweet[] | string[]

export class SentimentAnalysisService {
  private ai: GoogleGenAI
  private model: string

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY

    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined")
    }

    this.ai = new GoogleGenAI({ apiKey })
    this.model = process.env.GEMINI_MODEL || "gemini-2.5-flash"
  }

  async reason(input: ReasonInput): Promise<Sentiment[]> {
    const replyTexts = this.extractReplyTexts(input)

    if (!replyTexts.length) return []

    const limitedReplies = replyTexts.slice(0, 20)

    const formattedReplies = limitedReplies
      .map((text, index) => `${index + 1}. ${text}`)
      .join("\n")

    const prompt = `
Classify each reply as: positive, negative, or neutral.

Rules:
- Positive: praise, support, enthusiasm
- Negative: criticism, insults, disagreement, hostility
- Neutral: factual or unclear tone

Return ONLY JSON:

{
  "sentiments": ["positive", "negative", "neutral"]
}

Replies:
${formattedReplies}
`

    try {
      const response = await this.ai.models.generateContent({
        model: this.model,
        contents: prompt,
      })

      const raw = response.text || ""
      const cleaned = this.cleanLLMResponse(raw)
      const parsed = JSON.parse(cleaned)

      if (!Array.isArray(parsed.sentiments)) {
        throw new Error("Invalid LLM response: missing sentiments array")
      }

      const sentiments = parsed.sentiments
        .slice(0, limitedReplies.length)
        .map((sentiment: string) => this.normalize(sentiment))

      return this.ensureSameLength(sentiments, limitedReplies.length)
    } catch (error) {
      console.log("LLM sentiment analysis failed:", error)

      return limitedReplies.map(() => "neutral")
    }
  }

  private extractReplyTexts(input: ReasonInput): string[] {
    return input
      .map(item => {
        if (typeof item === "string") {
          return item
        }

        return item.text
      })
      .map(text => text.trim())
      .filter(Boolean)
  }

  private cleanLLMResponse(raw: string): string {
    return raw
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim()
  }

  private normalize(value: string): Sentiment {
    const normalized = value.toLowerCase().replace(/[^a-z]/g, "")

    if (normalized === "positive") return "positive"
    if (normalized === "negative") return "negative"

    return "neutral"
  }

  private ensureSameLength(
    sentiments: Sentiment[],
    expectedLength: number
  ): Sentiment[] {
    if (sentiments.length >= expectedLength) {
      return sentiments.slice(0, expectedLength)
    }

    const missingCount = expectedLength - sentiments.length

    return [
      ...sentiments,
      ...Array.from({ length: missingCount }, () => "neutral" as const),
    ]
  }
}