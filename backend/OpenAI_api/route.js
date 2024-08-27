import { NextResponse } from "next/server"
import OpenAI from "openai"

const systemPrompt = `
You are an AI assistant tasked with summarizing and scoring transcripts. Analyze the following transcript and provide a summary and score:

1. **Summarize the Transcript:**
   - Provide a concise summary of the main points discussed.
   - Highlight any key decisions or actions agreed upon.

2. **Score the Transcript:**
   - Based on your analysis, assign the transcript a score out of 100.
   - Include a brief justification for the score.

**Output Format:**
- Summary: [Your summary here]
- Score: [Score]/100
- Justification: [Your justification here]
`

export async function POST(req) {
    const openai = new OpenAI(process.env.OPENAI_API_KEY)
    const data = await req.json()
    const { transcript } = data

    const completion = await openai.chat.completions.create({
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Summarize and score this transcript: ${transcript}` }
        ],
        model: "gpt-4",
    });

    console.log('OpenAI response:', completion.choices[0].message.content)

    return NextResponse.json(
        { summary: completion.choices[0].message.content },
        { status: 200 }
    )
}