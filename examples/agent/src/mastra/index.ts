import { yoyo, yo, wefew } from './agents/index';

import { Mastra } from '@mastra/core';

export const mastra = new Mastra({
  agents: [yoyo, yo, wefew],
});
