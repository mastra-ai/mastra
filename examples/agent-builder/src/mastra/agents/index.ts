import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';

export const weatherAgent = new Agent({
  id: 'weather-agent',
  name: 'weather-agent',
  instructions: 'You answer questions about the weather concisely.',
  model: openai('gpt-4o-mini'),
});
