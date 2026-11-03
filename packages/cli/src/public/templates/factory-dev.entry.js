// @ts-ignore
import { scoreTracesWorkflow } from '@mastra/core/evals/scoreTraces';
import { mastra } from '#mastra';
import { createNodeServer, getToolExports } from '#server';
import { tools } from '#tools';

// No top-level await: it turns off Rolldown's chunk optimizations for the whole build.
(async () => {
  // @ts-ignore
  await createNodeServer(mastra, {
    studio: false,
    isDev: true,
    tools: getToolExports(tools),
  });

  if (mastra.getStorage()) {
    mastra.__registerInternalWorkflow(scoreTracesWorkflow);
  }
})().catch(error => {
  console.error(error);
  process.exit(1);
});
