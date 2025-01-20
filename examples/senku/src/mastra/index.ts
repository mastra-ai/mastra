import { Mastra, createLogger } from '@mastra/core';
import { PgVector } from '@mastra/rag';

import { kindergartenAgent, whitePaperAgent } from './agents';
import { whitePaperWorkflow } from './workflows';

const pgVector = new PgVector(process.env.POSTGRES_CONNECTION_STRING!);

export const mastra = new Mastra({
  workflows: { whitePaperWorkflow },
  vectors: { pgVector },
  agents: { kindergartenAgent, whitePaperAgent },
  logger: false,
});
