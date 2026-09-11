import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';

export const supportAgent = new Agent({
  id: 'support-agent',
  name: 'Support Agent',
  instructions: 'Answer support questions concisely and return clear next steps.',
  model: openai('gpt-4o-mini'),
});
