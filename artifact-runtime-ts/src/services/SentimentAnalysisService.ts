import { GoogleGenAI } from "@google/genai"

export type Sentiment = "positive" | "negative" | "neutral"

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

  async reason(replyTexts: string[]): Promise<Sentiment[]> {
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

      const cleaned = raw
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim()

      const parsed = JSON.parse(cleaned)

      if (!Array.isArray(parsed.sentiments)) {
        throw new Error("Invalid LLM response: missing sentiments array")
      }

      return parsed.sentiments
        .slice(0, limitedReplies.length)
        .map((sentiment: string) => this.normalize(sentiment))
    } catch (error) {
      console.log("LLM sentiment analysis failed:", error)

      return limitedReplies.map(() => "neutral")
    }
  }

  private normalize(value: string): Sentiment {
    const normalized = value.toLowerCase().replace(/[^a-z]/g, "")

    if (normalized === "positive") return "positive"
    if (normalized === "negative") return "negative"

    return "neutral"
  }
}