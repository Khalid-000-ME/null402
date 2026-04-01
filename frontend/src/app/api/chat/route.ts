import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { message } = await req.json();

    const API_KEY = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY_1 || process.env.GEMINI_API_KEY_2;
    
    if (!API_KEY) {
      return NextResponse.json({ error: "No Gemini API Key found" }, { status: 500 });
    }

    const payload = {
      contents: [
        {
          role: "user",
          parts: [{ text: message }]
        }
      ],
      systemInstruction: {
        parts: [{
          text: `You are null402, an agentic AI chatbot for null402 (a confidential borrowing/lending protocol using FHE). 
Your ONLY job is to interpret the user's intent and output a JSON object indicating the action they want to take. 
Do not output markdown, just raw JSON.
The JSON must follow this exact format:
{
  "action": "deposit" | "withdraw" | "borrow" | "repay" | "balances" | "unknown",
  "amount": "string value representing the amount (e.g. '100'), if applicable. Omit if balances or unknown.",
  "target": "collateral" | "debt" | "neth" | "nusdc" | "all",
  "response": "A short, friendly confirmation message from null402 explaining what will happen next (e.g., 'Fetching your encrypted balances...' or 'Preparing your deposit of 5 nETH. Please sign the transaction.')."
}
*Note*: The "target" field is ONLY used if action is "balances". It indicates whether the user wants to see their collateral, debt, nETH wallet balance, nUSDC wallet balance, or all.

Examples:
User: "Deposit 50 nETH" -> { "action": "deposit", "amount": "50", "response": "Preparing your deposit of 50 nETH. Please confirm the transaction in your wallet." }
User: "I want to borrow 5 USDC" -> { "action": "borrow", "amount": "5", "response": "Initiating a borrow of 5 nUSDC against your collateral. Awaiting wallet signature." }
User: "What's my balance?" -> { "action": "balances", "target": "all", "response": "Fetching your encrypted balances from the Sepolia network..." }
User: "What is my current collateral?" -> { "action": "balances", "target": "collateral", "response": "Fetching your encrypted collateral from the null402 protocol. Please sign to decrypt." }`
        }]
      },
      generationConfig: {
        temperature: 0,
        responseMimeType: "application/json",
      }
    };

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("Gemini API error:", err);
      return NextResponse.json({ error: "AI generation failed" }, { status: response.status });
    }

    const data = await response.json();
    let resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    
    // Clean any markdown "slop" or conversational padding
    resultText = resultText.replace(/^```json\s*/, "").replace(/\s*```$/, "").trim();
    if (resultText.startsWith("`") || resultText.endsWith("`")) {
      resultText = resultText.replace(/^`+|`+$/g, "").trim();
    }
    
    let resultJson;
    try {
      resultJson = JSON.parse(resultText);
    } catch (parseError) {
      console.error("Failed to parse JSON:", resultText);
      throw new Error("AI returned unparseable text.");
    }

    return NextResponse.json({ result: resultJson });
  } catch (error: any) {
    console.error("Chat API error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
