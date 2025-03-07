import { convertToCoreMessages, Message, StreamData } from 'ai';

import { models } from '@/ai/models';
import { auth } from '@/app/(auth)/auth';
import { getMostRecentUserMessage } from '@/lib/utils';

import { createMastra } from '@/mastra';

export const maxDuration = 60;

export async function POST(request: Request) {
  const {
    id,
    messages,
    modelId,
  }: { id: string; messages: Array<Message>; modelId: string } =
    await request.json();
  const session = await auth();

  if (!session || !session.user || !session.user.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const model = models.find((model) => model.id === modelId);

  if (!model) {
    return new Response('Model not found', { status: 404 });
  }

  const coreMessages = convertToCoreMessages(messages);
  const userMessage = getMostRecentUserMessage(coreMessages);

  if (!userMessage) {
    return new Response('No user message found', { status: 400 });
  }

  const mastra = createMastra({
    modelProvider: model.provider,
    modelName: model.apiIdentifier,
  });

  const cryptoAgent = mastra.getAgent('cryptoAgent');

  if (!cryptoAgent) {
    return new Response('Agent not found', { status: 404 });
  }

  const userMessages = messages.map((message) => message.content);

  try {
    const streamResult = await cryptoAgent.stream(userMessages, {
      resourceId: session.user.id,
      threadId: id,
    });

    return streamResult.toDataStreamResponse();
  } catch (err) {
    console.error(err);
    return new Response('An error occurred while processing your request', {
      status: 500,
    });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new Response('Not Found', { status: 404 });
  }

  const session = await auth();

  if (!session || !session.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const mastra = createMastra({
      modelProvider: models[0].provider,
      modelName: models[0].apiIdentifier,
    });
    const chat = await mastra.memory?.getThreadById({ threadId: id });

    if (chat?.resourceId !== session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    await mastra.memory?.deleteThread(id);

    return new Response('Chat deleted', { status: 200 });
  } catch (error) {
    return new Response('An error occurred while processing your request', {
      status: 500,
    });
  }
}
