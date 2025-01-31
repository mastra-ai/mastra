import { Mastra } from '@mastra/core';

import { myWorkflow } from './workflows';

export const mastra = new Mastra({
  workflows: {
    myWorkflow,
  },
});
