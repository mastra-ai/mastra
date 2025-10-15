import { Mastra } from '@mastra/core';
import { LibSQLStore } from '@mastra/libsql';

import { weatherAgent } from './agents';
import { weatherWorkflow } from './workflows';
import { scorers } from './scorers';

export const mastra = new Mastra({
  storage: new LibSQLStore({
    url: 'file:./mastra.db',
  }),
  observability: {
    default: {
      enabled: true,
    },
  },
  agents: { weatherAgent },
  workflows: { weatherWorkflow },
  scorers,
});
