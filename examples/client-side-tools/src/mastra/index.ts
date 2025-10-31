import { Mastra } from '@mastra/core';
import { agent } from './agents';

export const mastra = new Mastra({
  agents: {
    agent,
  },
});
