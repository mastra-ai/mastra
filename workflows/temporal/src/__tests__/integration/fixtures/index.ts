import { Mastra } from '@mastra/core/mastra';
import { complexWorkflow } from './workflows/complex-workflow';

export const mastra = new Mastra({
  workflows: { complexWorkflow },
});
