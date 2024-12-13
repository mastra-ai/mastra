import { Mastra } from '@mastra/core';
import { PostgresEngine } from '@mastra/engine';

import * as agents from './agents/test';
import * as syncs from './syncs';

export const mastra = new Mastra<typeof syncs>({
  syncs,
  engine: new PostgresEngine({
    url: process.env.DB_URL!,
  }),
  agents,
  telemetry: {
    serviceName: 'mastra-vnext',
    sampling: {
      type: 'parent_based',
      root: {
        probability: 0.5,
      },
    },
    enabled: true,
    export: {
      type: 'otlp',
    },
  },
});
