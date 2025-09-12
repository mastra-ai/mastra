import { mastra } from "@/src/mastra";
import { NextResponse } from "next/server";

const myAgent = mastra.getAgent("weatherAgent");
export async function GET() {
  const memory = await myAgent.getMemory();
  const result = await memory?.query({
    threadId: "2",
  });

  return NextResponse.json(result?.uiMessages || []);
}
