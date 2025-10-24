import { mastra } from "@/src/mastra";
import { toAISdkMessages } from "@mastra/ai-sdk/v5";
import { NextResponse } from "next/server";

const myAgent = mastra.getAgent("weatherAgent");
export async function GET() {
  const memory = await myAgent.getMemory();
  const result = await memory?.query({
    threadId: "2",
  });

  const messages = toAISdkMessages(result?.messages || []);
  return NextResponse.json(messages);
}
