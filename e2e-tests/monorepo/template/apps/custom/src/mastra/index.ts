import { Mastra } from '@mastra/core/mastra';
import { innerAgent } from '@/agents';

export const mastra = new Mastra({
  agents: [innerAgent],
});
