import { mastra } from "@/src/mastra";
import { convertMessages } from "@mastra/core/agent";
import { NextResponse } from "next/server";

const myAgent = mastra.getAgent("weatherAgent");
export async function GET() {
  const memory = await myAgent.getMemory();
  const result = await memory?.query({
    threadId: "2",
  });

  const messages = convertMessages(result?.uiMessages || []).to("AIV5.UI");
  return NextResponse.json(messages);
}
