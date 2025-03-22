import { mastra } from '@/src/mastra';

export async function POST(req: Request) {
  const { messages } = await req.json();
  const noteTakerAgent = mastra.getAgent('noteTakerAgent');
  const response = await noteTakerAgent.generate(messages);

  return new Response(JSON.stringify({ summary: response.text }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    },
  });
}
