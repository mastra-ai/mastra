import { Mastra } from '@mastra/core/mastra';
import { registerMastra, registerRuntime } from '@mastra/vercel';
import { testWorkflow } from './workflows';
import { runStep, mainWorkflow } from '../workflow-runtime';

export const mastra = new Mastra({
  workflows: { 'test-workflow': testWorkflow },
});

// Register with the singleton so implementations can access the mastra instance
registerMastra(mastra);

// Register the runtime functions (with Vercel directives) from user-space
registerRuntime({ runStep, mainWorkflow });
