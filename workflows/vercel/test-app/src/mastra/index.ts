import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/di';
import { registerMastra, getMastra, VercelExecutionEngine, buildExecutionParams } from '@mastra/vercel';
import { testWorkflow } from './workflows';

export const mastra = new Mastra({
  workflows: { 'test-workflow': testWorkflow },
});

// Register with the singleton so mainWorkflow can access it
registerMastra(mastra);

// Re-export utilities needed by runtime.workflow.ts
export { getMastra, VercelExecutionEngine, buildExecutionParams, RequestContext };
