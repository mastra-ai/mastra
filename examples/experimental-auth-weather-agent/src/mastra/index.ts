import { Mastra } from '@mastra/core';

import { weatherAgent } from './agents';
import { weatherWorkflow as legacyWeatherWorkflow } from './workflows';
import { weatherWorkflow } from './workflows/new-workflow';
import { authConfig } from './auth';

export const mastra = new Mastra({
  agents: { weatherAgent },
  legacy_workflows: { legacyWeatherWorkflow },
  workflows: { weatherWorkflow },
  server: {
    experimental_auth: authConfig,
  },
});
