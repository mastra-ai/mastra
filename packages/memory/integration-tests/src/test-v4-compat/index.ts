import { Mastra, createMockModel } from '@mastra/core';
import { Agent } from '@mastra/core/agent';

const mockModel = createMockModel({ mockText: 'Hello world from v4 test agent' });

const mockTool = {
  description: 'A mock tool for testing',
  parameters: {
    type: 'object',
    properties: {
      message: { type: 'string' },
    },
    required: ['message'],
  },
  execute: async ({ message }: any) => {
    return { result: `Tool executed with: ${message}` };
  },
};

const testAgent = new Agent({
  name: 'test-agent',
  instructions: 'You are a helpful test agent. When asked to use a tool, use the mock_tool with the user message.',
  model: mockModel,
  tools: { mock_tool: mockTool },
});

export const mastra = new Mastra({
  agents: { 'test-agent': testAgent },
  aiSdkCompat: 'v4', // Force v4 compatibility
});
