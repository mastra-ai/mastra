import { Mastra } from '@mastra/core';
import { assistantAgent } from './agents';

export const mastra = new Mastra({
  agents: { assistantAgent },
});
