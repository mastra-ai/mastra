import { Mastra } from '@mastra/core';

import { stockWeatherAgent } from './agents';

export const mastra = new Mastra({
  agents: { stockWeatherAgent },
});
