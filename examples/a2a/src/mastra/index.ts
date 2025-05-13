import { Mastra } from '@mastra/core/mastra';
import { myAgent } from './agents';

export const mastra = new Mastra({
  agents: {
    myAgent,
  },
});
