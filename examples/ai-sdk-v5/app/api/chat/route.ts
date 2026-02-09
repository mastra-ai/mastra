import { handleChatStream } from "@mastra/ai-sdk";
import { createUIMessageStreamResponse } from "ai";

import { mastra } from "@/src/mastra";

export async function POST(req: Request) {
  const params = await req.json();

  const stream = await handleChatStream({
    mastra,
    agentId: "weatherAgent",
    params,
  });

  return createUIMessageStreamResponse({ stream });
}
