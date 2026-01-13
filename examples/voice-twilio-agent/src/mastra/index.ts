import { Mastra } from '@mastra/core/mastra';

import { phoneAgent } from './agents';

export const mastra = new Mastra({
  agents: { phoneAgent },
});
