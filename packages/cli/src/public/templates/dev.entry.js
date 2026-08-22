// @ts-ignore
import { scoreTracesWorkflow } from '@mastra/core/evals/scoreTraces';
// @ts-ignore
import { scoreRunWorkflow } from '@mastra/core/evals/scoreRun';
import { mastra } from '#mastra';
import { createNodeServer, getToolExports } from '#server';
import { tools } from '#tools';
// @ts-ignore
await createNodeServer(mastra, {
  studio: true,
  isDev: true,
  tools: getToolExports(tools),
});

if (mastra.getStorage()) {
  mastra.__registerInternalWorkflow(scoreTracesWorkflow);
  mastra.__registerInternalWorkflow(scoreRunWorkflow);
}