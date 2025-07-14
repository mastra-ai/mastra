import { mastra } from "@/src/mastra";
import { NextResponse } from "next/server";

const myAgent = mastra.getAgent("weatherAgent");
export async function GET() {
  const result = await myAgent.getMemory()?.query({
    threadId: "2",
  });

  return NextResponse.json(result?.uiMessages || []);
}
