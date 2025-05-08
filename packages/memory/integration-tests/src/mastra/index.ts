import { Mastra } from '@mastra/core';
import { weatherAgent } from './agents/weather';
import { LibSQLStore } from '@mastra/libsql';

export const mastra = new Mastra({
  agents: {
    test: weatherAgent,
  },
  storage: new LibSQLStore({
    url: 'file:../mastra.db',
  }),
});
