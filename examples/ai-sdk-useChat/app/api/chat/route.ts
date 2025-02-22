import { mastra } from '@/src/mastra';

export async function POST(req: Request) {
  const { messages } = await req.json();
  const myAgent = mastra.getAgent('weatherAgent');
  const stream = await myAgent.stream(messages);

  return stream.toDataStreamResponse();
}
