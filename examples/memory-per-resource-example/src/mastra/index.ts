import { Mastra } from '@mastra/core/mastra';
import { assistantAgent } from './agents';

export const mastra = new Mastra({
  agents: { assistantAgent },
});
