import { Mastra } from '@mastra/core';
import { myAgent, contentCreatorAgent } from './agents';

export const mastra = new Mastra({
  agents: {
    myAgent,
    contentCreatorAgent,
  },
});
