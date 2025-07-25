import { Mastra, createMockModel } from '@mastra/core';
import { Agent } from '@mastra/core/agent';

const mockModel = createMockModel({ mockText: 'Hello world from v5 test agent' });

const testAgent = new Agent({
  name: 'test-agent',
  instructions: 'You are a helpful test agent.',
  model: mockModel,
});

export const mastra = new Mastra({
  agents: { 'test-agent': testAgent },
  aiSdkCompat: 'v5', // Native v5 mode
});
