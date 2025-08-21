import { mastra } from "@/src/mastra";
import { createV4CompatibleResponse } from "@mastra/core/agent";

const myAgent = mastra.getAgent("weatherAgent");
export async function POST(req: Request) {
  const { messages } = await req.json();

  const stream = await myAgent.stream(messages, {
    threadId: "2",
    resourceId: "1",
  });

  return createV4CompatibleResponse(stream.toUIMessageStreamResponse().body!);
}
