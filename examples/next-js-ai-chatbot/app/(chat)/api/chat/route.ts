import type { Message } from '@ai-sdk/react';

import { mastra } from '@/src/mastra';

import { auth } from '@/app/(auth)/auth';
import { getMostRecentUserMessage } from '@/lib/utils';

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const { id, messages }: { id: string; messages: Array<Message> } = await request.json();

    const session = await auth();

    if (!session || !session.user || !session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    const userMessage = getMostRecentUserMessage(messages);

    if (!userMessage) {
      return new Response('No user message found', { status: 400 });
    }
    const agent = mastra.getAgent('weatherAgent');

    if (!agent) {
      return Response.json('Agent not found', { status: 404 });
    }

    const result = await agent.stream([userMessage], {
      threadId: id,
      resourceId: session.user.id,
    });

    return result.toDataStreamResponse();
  } catch (error: any) {
    console.log('error in chat===', error);
    return new Response(`An error occurred while processing your request: ${error.message}`, {
      status: 500,
    });
  }
}
