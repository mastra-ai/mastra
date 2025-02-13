import { MastraStorageLibSql, createLogger, Mastra } from '@mastra/core';

import { catOne, agentTwo } from './agents/agent';
import { logCatWorkflow } from './workflow';

const logger = createLogger({
  level: 'debug',
});

export const mastra = new Mastra({
  agents: { catOne, agentTwo },
  workflows: { logCatWorkflow },
  logger,
});
