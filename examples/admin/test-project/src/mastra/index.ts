import { Mastra } from '@mastra/core/mastra';
import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

// Simple test tool
const echoTool = createTool({
  id: 'echo',
  description: 'Echoes back the input',
  inputSchema: z.object({
    message: z.string().describe('The message to echo'),
  }),
  execute: async ({ context }) => {
    return { echoed: context.message };
  },
});

// Simple test agent using echo provider
const testAgent = new Agent({
  id: 'test-agent',
  name: 'Test Agent',
  instructions: 'You are a test agent.',
  model: {
    provider: 'ECHO',
    name: 'echo',
  },
  tools: { echoTool },
});

export const mastra = new Mastra({
  agents: { testAgent },
});
