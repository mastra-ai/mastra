import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core';

export const catOne = new Agent({
  name: 'cat-one',
  instructions: ({ runtimeContext }) => {
    const user = runtimeContext.get('user') as { name: string };

    return `
  You are a professional AI assistant for user: ${user.name}
  `;
  },
  model: openai('gpt-4o'),
});
