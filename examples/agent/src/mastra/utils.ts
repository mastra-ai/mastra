import { openai } from '@ai-sdk/openai';
import { CoreMessage } from '@mastra/core';
import { generateObject } from 'ai';
import { z } from 'zod';

export const generateChatSummary = async (
  messages: CoreMessage[],
): Promise<{
  chatSummary: string;
}> => {
  const { object } = await generateObject({
    model: openai.chat('gpt-4o-mini'),
    prompt: `Your task is to summarize the following conversation.

The summary should be concise and capture the main points of the conversation.

Conversation:
${messages}`,
    schema: z.object({
      chatSummary: z.string().describe('The summary of the conversation.'),
    }),
    temperature: 0.2,
  });

  return object;
};
