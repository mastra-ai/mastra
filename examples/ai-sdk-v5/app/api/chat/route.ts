import { mastra } from "@/src/mastra";

const myAgent = mastra.getAgent("weatherAgent");
export async function POST(req: Request) {
  const { messages } = await req.json();

  const stream = await myAgent.stream(messages, {
    format: "aisdk",
    memory: {
      thread: "2",
      resource: "1",
    },
  });

  return stream.toUIMessageStreamResponse();
}
