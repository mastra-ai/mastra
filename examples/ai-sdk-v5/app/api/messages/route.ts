import { toAISdkV5Messages } from "@mastra/ai-sdk/ui";
import { NextResponse } from "next/server";

import { mastra } from "@/src/mastra";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const threadId = searchParams.get("threadId");

  if (!threadId) {
    return NextResponse.json([]);
  }

  const agent = mastra.getAgent("weatherAgent");
  const memory = await agent.getMemory();

  if (!memory) {
    return NextResponse.json([]);
  }

  const result = await memory.recall({ threadId });
  const messages = toAISdkV5Messages(result?.messages || []);

  return NextResponse.json(messages);
}
