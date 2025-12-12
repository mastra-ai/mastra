import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';

const agent = new Agent({
  id: 'example-agent',
  name: 'Example Agent',
  instructions: 'You are a helpful assistant',
  model: openai('gpt-4o'),
});

const result = await agent.generate('Yo whats up');

console.log(result.text);
