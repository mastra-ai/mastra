import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';

const memory = new Memory();

export const memoryAgent = new Agent({
  id: 'memory-agent',
  name: 'Memory Agent',
  instructions: 'You are a helpful assistant that can remember things.',
  model: 'openai/gpt-4o',
  memory,
});
