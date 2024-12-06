import {
  convertToCoreMessages,
  CoreAssistantMessage,
  CoreMessage,
  Message,
  StreamData,
  streamText,
} from 'ai';

import { models } from '@/ai/models';
import { auth } from '@/app/(auth)/auth';
import { deleteChatById, getChatById } from '@/db/queries';
import {
  getMostRecentUserMessage,
  sanitizeResponseMessages,
} from '@/lib/utils';

import { createMastra } from '@/mastra';
import { randomUUID } from 'crypto';

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

  const userMessages = messages.map(
    (message) => message.content
  ) as unknown as string[];

  console.log({ id });

  const streamingData = new StreamData();

  try {
    const streamResult = await cryptoAgent.stream({
      resourceid: session.user.id,
      threadId: id,
      messages: userMessages,
      onFinish: async (result) => {
        const { responseMessages } = JSON.parse(result) || {};
        if (session.user && session.user.id) {
          try {
            if (!responseMessages) {
              return streamingData.close();
            }

            const ms = Array.isArray(responseMessages)
              ? responseMessages
              : [responseMessages];

            const responseMessagesWithoutIncompleteToolCalls =
              sanitizeResponseMessages(ms);

            console.log('YOOOO', responseMessagesWithoutIncompleteToolCalls);

            await mastra?.memory?.saveMessages({
              messages: responseMessagesWithoutIncompleteToolCalls.map(
                (message: CoreMessage | CoreAssistantMessage) => {
                  const messageId = randomUUID();
                  if (message.role === 'assistant') {
                    streamingData.appendMessageAnnotation({
                      messageIdFromServer: messageId,
                    });
                  }

                  return {
                    id: messageId,
                    threadId: id,
                    role: message.role as any,
                    content: message.content as any,
                    createdAt: new Date(),
                  };
                }
              ),
            });
          } catch (error) {
            console.error(error);
            console.error('Failed to save chat');
          }
        }

        streamingData.close();
      },
    });

    return streamResult.toDataStreamResponse({
      data: streamingData as any,
    });
  } catch (err) {
    console.error(err);
    streamingData.close();
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
    const chat = await getChatById({ id });

    if (chat.userId !== session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    await deleteChatById({ id });

    return new Response('Chat deleted', { status: 200 });
  } catch (error) {
    return new Response('An error occurred while processing your request', {
      status: 500,
    });
  }
}
