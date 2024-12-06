import { createSync } from '@mastra/core';
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
    await engine.syncData({
      name: data.name,
      connectionId: data.connectionId,
      data: data.records,
    });

    return {
      message: 'Hello',
    };
  },
});
