import { Mastra } from '@mastra/core/mastra';
import { browserAgent } from './agents/index.js';

export const mastra = new Mastra({
  agents: { browserAgent },
});
