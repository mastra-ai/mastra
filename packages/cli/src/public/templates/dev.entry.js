// @ts-ignore
import { scoreTracesWorkflow } from '@mastra/core/evals/scoreTraces';
import { mastra } from '#mastra';
import { createNodeServer, getToolExports } from '#server';
import { tools } from '#tools';
// @ts-ignore
await createNodeServer(mastra, {
  playground: true,
  isDev: true,
  tools: getToolExports(tools),
});

if (mastra.getStorage()) {
  mastra.__registerInternalWorkflow(scoreTracesWorkflow);
}