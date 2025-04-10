import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';

export const agent = new Agent({
  name: 'Test Agent',
  instructions: 'You are a browser client agent. You execute tools in the browser.',
  model: openai('gpt-4o'),
});
