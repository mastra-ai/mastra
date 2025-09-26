import { Mastra } from '@mastra/core';
import { LibSQLStore } from '@mastra/libsql';

import { weatherAgent, weatherReporterAgent, agentNetwork } from './agents';
import { weatherWorkflow as legacyWeatherWorkflow } from './workflows';
import { weatherWorkflow, weatherWorkflow2 } from './workflows/new-workflow';

export const mastra = new Mastra({
  storage: new LibSQLStore({
    url: 'file:./mastra.db',
  }),
  agents: { weatherAgent, weatherReporterAgent, agentNetwork },
  legacy_workflows: { legacyWeatherWorkflow },
  workflows: { weatherWorkflow, weatherWorkflow2 },
});
