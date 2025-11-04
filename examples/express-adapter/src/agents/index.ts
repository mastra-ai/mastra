import { Agent } from '@mastra/core/agent';

export const helloAgent = new Agent({
  id: 'hello-agent',
  name: 'Hello Agent',
  instructions: 'You are a helpful assistant that can answer questions and help with tasks.',
  model: 'openai/gpt-4o',
});
