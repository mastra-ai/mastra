import { Agent } from '@mastra/core/agent';

export const testAgent = new Agent({
  id: 'test-agent',
  name: 'test-agent',
  instructions: 'You are a helpful assistant.',
  model: 'openai/gpt-4o-mini',
});
