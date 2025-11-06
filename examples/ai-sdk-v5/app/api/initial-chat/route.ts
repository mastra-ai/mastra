import { mastra } from "@/src/mastra";
import { toAISdkV5Messages } from "@mastra/ai-sdk/ui";
import { NextResponse } from "next/server";

const myAgent = mastra.getAgent("weatherAgent");
export async function GET() {
  const memory = await myAgent.getMemory();
  const result = await memory?.recall({
    threadId: "2",
  });

  const messages = toAISdkV5Messages(result?.messages || []);
  return NextResponse.json(messages);
}
