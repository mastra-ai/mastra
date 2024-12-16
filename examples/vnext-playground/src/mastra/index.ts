import { createTool, createSync, Agent, Mastra, Workflow } from '@mastra/core';
import { PostgresEngine } from '@mastra/engine';
import { z } from 'zod';

const addTool = createTool({
  id: 'add',
  description: 'Add two numbers together',
  inputSchema: z.object({
    a: z.number(),
    b: z.number(),
  }),
  outputSchema: z.object({
    sum: z.number(),
  }),
  execute: async ({ context, runId }) => {
    const sum = context.a + context.b;
    return {
      sum,
    };
  },
});

export const chefAgent = new Agent({
  name: 'Chef Agent',
  instructions:
    'You are Michel, a practical and experienced home chef who helps people cook great meals with whatever ingredients they have available. Your first priority is understanding what ingredients and equipment the user has access to, then suggesting achievable recipes. You explain cooking steps clearly and offer substitutions when needed, maintaining a friendly and encouraging tone throughout.',
  model: {
    provider: 'OPEN_AI',
    name: 'gpt-4o',
    toolChoice: 'auto',
  },
  tools: {
    addTool,
  },
});

const engine = new PostgresEngine({
  url: 'postgres://postgres:password@localhost:5433/mastra',
});

const testSync = createSync({
  id: 'hello-world',
  description: 'test',
  inputSchema: z.object({
    name: z.string(),
  }),
  outputSchema: z.object({
    message: z.string(),
  }),
  execute: async ({ context, runId }) => {
    console.log('context:', context);
    console.log('runId:', runId);

    const name = context.name;

    return {
      message: `Hello, ${name}!`,
    };
  },
});

const helloWorklow = new Workflow({
  name: 'hello-workflow',
  triggerSchema: z.object({
    name: z.string(),
  }),
});

helloWorklow.step(testSync).commit();

export const mastra = new Mastra({
  engine,
  agents: { chefAgent },
  syncs: {
    testSync,
  },
  workflows: {
    helloWorklow,
  },
});
