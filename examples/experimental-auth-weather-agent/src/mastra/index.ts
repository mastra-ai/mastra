import { Mastra } from '@mastra/core/mastra';

import { weatherAgent } from './agents';
import { weatherWorkflow } from './workflows';
import { authConfig } from './auth';

export const mastra = new Mastra({
  agents: { weatherAgent },
  workflows: { weatherWorkflow },
  server: {
    auth: authConfig,
  },
});
