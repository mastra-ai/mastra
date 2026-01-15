// @ts-nocheck

import { z } from 'zod/v3';
import { Agent } from '../agent/agent';
import { createTool } from '../tools';
import { DefaultEngineType } from './types';
import { createStep } from './workflow';

const step = createStep({
  id: 'test',
  inputSchema: z.object({ name: z.string() }),
  outputSchema: z.object({ greeting: z.string(), age: z.number() }),
  execute: async ({ inputData }) => {
    return { greeting: `Hello, ${inputData.name}!` };
  },
});

const agent = new Agent({
  id: 'test',
  name: 'Test',
  instructions: 'Test',
  model: 'gpt-4o',
});

const tool = createTool({
  id: 'test',
  description: 'Test',
  inputSchema: z.object({ name: z.string() }),
  outputSchema: z.object({ greeting: z.string(), age: z.number().optional() }),
  execute: async ({ inputData }) => {
    return { greeting: `Hello, ${inputData.name}!`, age: 30 };
  },
});
const processor = new (class TestProcessor implements Processor<'test'> {
  readonly id = 'test';
  readonly name = 'Test';

  constructor() {}

  processInput(): MastraDBMessage[] {
    return [
      {
        id: 'msg-123',
        role: 'user',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [
            {
              type: 'text',
              text: 'yo',
            },
          ],
        },
      },
    ];
  }
})();
const processorStep = createStep(processor);

const agentStep = createStep(agent);

const agentStep2 = createStep(agent, {
  retries: 3,
});

const toolStep = createStep(tool, {
  retries: 3,
});
