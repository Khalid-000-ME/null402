import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || "https://rpc2.sepolia.org";
    
    const response = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    
    try {
      const data = JSON.parse(text);
      return NextResponse.json(data);
    } catch {
      // Non-JSON response — likely an error from the RPC provider
      console.error("RPC proxy non-JSON response:", text);
      return NextResponse.json(
        { jsonrpc: "2.0", id: body.id, error: { code: -32000, message: text.trim() } },
        { status: 502 }
      );
    }
  } catch (err: any) {
    console.error("RPC proxy error:", err.message);
    return NextResponse.json({ error: "RPC proxy error" }, { status: 500 });
  }
}
