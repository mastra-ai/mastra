import { Mastra } from '@mastra/core';
import { createLogger } from '@mastra/core/logger';

import { discordAnalysisAgent } from './agents/index.js';

// Create and export the Mastra instance with our Discord analysis agent
export const mastra = new Mastra({
  agents: { discordAnalysisAgent },
  logger: createLogger({ name: 'DiscordAnalysisBot', level: 'info' }),
});
