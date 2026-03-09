import { Mastra } from '@mastra/core/mastra';

import { myWorkflow } from './workflows';

export const mastra = new Mastra({
  workflows: {
    myWorkflow,
  },
});
