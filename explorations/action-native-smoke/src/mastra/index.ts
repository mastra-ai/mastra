import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { createTool } from '@mastra/core/tools';
import { LibSQLStore } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { z } from 'zod';

const weather = createTool({
  id: 'weather',
  description: 'Get the weather for a city',
  inputSchema: z.object({ city: z.string() }),
  execute: async ({ city }) => ({ city, tempC: 21, conditions: 'sunny' }),
});

const deleteFile = createTool({
  id: 'deleteFile',
  description: 'Delete a file by path',
  inputSchema: z.object({ path: z.string() }),
  requireApproval: true,
  execute: async ({ path }) => ({ deleted: path }),
});

const storage = new LibSQLStore({ id: 'smoke', url: 'file:./smoke.db' });

export const mastra = new Mastra({
  storage,
  agents: {
    actionAgent: new Agent({
      id: 'action-agent',
      name: 'Action Agent',
      instructions: 'You are concise. Use tools when relevant.',
      model: 'openai/gpt-4o-mini',
      tools: { weather, deleteFile },
      memory: new Memory({ storage }),
    }),
    brokenAgent: new Agent({
      id: 'broken-agent',
      name: 'Broken Agent',
      instructions: 'You are concise.',
      model: 'openai/gpt-does-not-exist',
      memory: new Memory({ storage }),
    }),
    reasoningAgent: new Agent({
      id: 'reasoning-agent',
      name: 'Reasoning Agent',
      instructions: 'You are concise.',
      model: 'openai/o4-mini',
      memory: new Memory({ storage }),
    }),
  },
});
