import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';

export const myAgent = new Agent({
  id: 'my-agent',
  name: 'My Agent',
  instructions: 'My Agent Instructions',
  model: openai('gpt-4o'),
});

export const contentCreatorAgent = new Agent({
  id: 'content-creator-agent',
  name: 'Content Creator Agent',
  instructions: 'Create engaging content',
  model: openai('gpt-4o'),
});
