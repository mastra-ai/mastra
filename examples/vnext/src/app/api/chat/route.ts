import { mastra } from '@/mastra';

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages } = await req.json();

  console.log({ messages });

  const agent = mastra.getAgent('agentOne');

  const streamResult = await agent?.stream(messages, {
    onStepFinish: step => {
      console.log({ step });
    },
  });

  console.log({ streamResult });

  return streamResult?.toDataStreamResponse();
}
