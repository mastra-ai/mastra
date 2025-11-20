import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';

export const testAgent = new Agent({
  id: 'test-agent',
  name: 'test-agent',
  instructions: 'test-agent',
  model: openai('gpt-4o'),
});
