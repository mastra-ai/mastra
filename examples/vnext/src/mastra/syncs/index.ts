import { createSync, PropertyType } from '@mastra/core';
import { z } from 'zod';

export const mySync = createSync({
  label: 'My Sync',
  description: 'This is a test sync',
  schema: z.object({
    name: z.string(),
    connectionId: z.string(),
    records: z.array(
      z.object({
        data: z.record(z.any()),
        externalId: z.string(),
      }),
    ),
  }),
  outputShema: z.object({
    message: z.string(),
  }),
  executor: async ({ data, engine }) => {
    await engine.syncRecords({
      name: data.name,
      connectionId: data.connectionId,
      records: data.records,
    });

    console.log({
      result,
      agentResult,
    });

    return {
      message: 'Hello',
    };
  },
});
