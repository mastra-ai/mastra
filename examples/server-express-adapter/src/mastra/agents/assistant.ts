import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';

export const assistantAgent = new Agent({
  id: 'assistantAgent',
  name: 'Assistant',
  instructions: 'You are a helpful assistant. Answer questions concisely.',
  model: openai('gpt-4o-mini'),
});
