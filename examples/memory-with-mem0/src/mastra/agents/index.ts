import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { mem0MemorizeTool, mem0RememberTool } from '../tools';

export const mem0Agent = new Agent({
  name: 'Mem0 Agent',
  instructions: `
    You are a helpful assistant that has the ability to memorize and remember facts using Mem0.
  `,
  model: openai('gpt-4o'),
  tools: { mem0RememberTool, mem0MemorizeTool },
});
