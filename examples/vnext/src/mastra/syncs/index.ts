import { createSync } from '@mastra/core';
import { z } from 'zod';

import { integrations } from '../integrations';
import * as tools from '../tools';

export const mySync = createSync({
  label: 'My Sync',
  description: 'This is a test sync',
  schema: z.object({
    name: z.string(),
    foo: z.string(),
    createdAt: z.date(),
  }),
  outputShema: z.object({
    message: z.string(),
  }),
  executor: async ({ data, agents, toolsRegistry, integrationsRegistry, engine, llm, vectors }) => {
    const myTool = toolsRegistry<typeof tools>().get('testTool2');

    const toolResult = await myTool.executor({
      agents,
      data: {
        balance: 100,
      },
      engine,
      integrationsRegistry,
      llm,
    });

    const myIntegration = integrationsRegistry<typeof integrations>().get('GITHUB');

    const myAgent = agents.get('Agent One');

    const agentResult = await myAgent?.text({
      messages: ['Hello'],
    });

    await engine.syncData({
      connectionId: '123',
      data: {},
      name: 'mySync',
      properties: [],
      type: 'SYNC',
      lastSyncId: '123',
    });

    return {
      message: 'Hello',
    };
  },
});
