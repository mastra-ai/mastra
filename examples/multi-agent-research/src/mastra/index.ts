import { Mastra } from '@mastra/core/mastra';
import { LibSQLStore } from '@mastra/libsql';
import { researcherAgent, writerAgent } from './agents';

export const mastra = new Mastra({
  storage: new LibSQLStore({
    id: 'multi-agent-research-storage',
    url: 'file:./mastra.db',
  }),
  agents: {
    researcherAgent,
    writerAgent,
  },
});