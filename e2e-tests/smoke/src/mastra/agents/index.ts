import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';

import { calculatorTool, stringTool } from '../tools/index.js';

export const memory = new Memory({
  options: {
    lastMessages: 20,
    workingMemory: {
      enabled: true,
    },
  },
});

export const testAgent = new Agent({
  id: 'test-agent',
  name: 'Test Agent',
  instructions: 'You are a helpful test agent.',
  model: 'openai/gpt-4o-mini',
  tools: { calculator: calculatorTool, 'string-transform': stringTool },
  memory,
});
