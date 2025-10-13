import { Mastra } from '@mastra/core/mastra';

import { stockWeatherAgent } from './agents';

export const mastra = new Mastra({
  agents: { stockWeatherAgent },
});
