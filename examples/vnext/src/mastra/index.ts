import { Mastra, createLogger } from '@mastra/core';
import { PostgresEngine } from '@mastra/engine';

import { agents } from './agents/test';
import { integrations } from './integrations';
import * as syncs from './syncs';
import * as tools from './tools';

export const mastra = new Mastra<typeof integrations, typeof tools, typeof syncs>({
  tools,
  syncs,
  engine: new PostgresEngine({
    url: process.env.DB_URL!,
  }),
  agents,
  integrations,
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
      endpoint: 'http://localhost:4318/v1/traces',
      headers: {
        'X-OTLP-Protocol': 'http/protobuf',
      },
    },
  },
});
