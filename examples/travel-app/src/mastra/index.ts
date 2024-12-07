import { Mastra, createLogger } from '@mastra/core';
import { PostgresEngine } from '@mastra/engine';

import { travelAgent, travelAnalyzer } from './agents';
import { syncBookingCom } from './syncs/attractions';
import * as tools from './tools';

const url = 'postgresql://postgres:postgres@localhost:5433/mastra';

const engine = new PostgresEngine({
  url,
});

export const mastra = new Mastra({
  tools,
  syncs: { syncBookingCom },
  engine,
  agents: [travelAgent, travelAnalyzer],
  logger: createLogger({
    type: 'CONSOLE',
    level: 'INFO',
  }),
});
