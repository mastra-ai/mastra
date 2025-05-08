import { Mastra } from '@mastra/core';
import { LibSQLStore } from '@mastra/libsql';
import { weatherAgent } from './agents/weather';

export const mastra = new Mastra({
  agents: {
    test: weatherAgent,
  },
  storage: new LibSQLStore({
    url: 'file:mastra.db',
  }),
});
