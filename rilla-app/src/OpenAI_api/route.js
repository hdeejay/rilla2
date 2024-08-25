import { NextResponse } from "next/server"
import OpenAI from "openai"

const systemPrompt = `
   Analyze the following sales call transcript and provide actionable feedback:

1. **Evaluate the Salesperson's Performance:**
   - Identify areas where the salesperson could improve, such as:
     - Questioning techniques
     - Handling objections
     - Closing strategies
     - Relationship-building
     - Tone and delivery

2. **Assess Customer Engagement:**
   - Determine if the customer was receptive, neutral, or disinterested.
   - Note if the customer provided clear feedback or remained silent.
   - Indicate any points where the customer showed strong interest or disengagement.

3. **Score the Sales Call:**
   - Based on your analysis, assign the call a score out of 100.
   - Include a brief justification for the score, considering both the salesperson's efforts and the customer's responses.

**Output Example:**

- **Salesperson Feedback:**
  - The salesperson asked relevant questions but could improve on addressing the customer’s objections about price more effectively.
  - Closing strategy was weak; the salesperson didn’t directly ask for the sale.
  - Good use of open-ended questions to build rapport.

- **Customer Engagement:**
  - The customer was receptive initially but became disengaged when discussing pricing. They provided little feedback toward the end of the call.
  - Strong interest was shown when discussing the product’s features but concerns about cost were not addressed fully.

- **Call Score:** 75/100
  - **Justification:** The salesperson showed strong product knowledge and rapport-building but missed opportunities to close the deal. Customer engagement dropped after the price discussion, indicating a need for better objection handling.

    `
    
export async function POST(req) {
    const openai = new OpenAI()
    const data = await req.json()

    const completion = await openai.chat.completions.create({
        messages: [{role: "system", content: systemPrompt}, ...data],
        model: "gpt-4o-mini",
    });

    console.log()

    return NextResponse.json(
        { message: completion.choices[0].message.content },
        {status: 200}
    )
}