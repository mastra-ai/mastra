import { Mastra } from '@mastra/core/mastra';
import { registerMastra } from '@mastra/vercel';
import { testWorkflow } from './workflows';

export const mastra = new Mastra({
  workflows: { 'test-workflow': testWorkflow },
});

// Register with the singleton so mainWorkflow can access it
registerMastra(mastra);
