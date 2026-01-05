// @ts-ignore
import { scoreTracesWorkflow } from '@mastra/core/evals/scoreTraces';
import { mastra } from '#mastra';
import { createServer, getToolExports } from '#server';
import { tools } from '#tools';
// @ts-ignore
// createServer auto-detects the runtime (Bun vs Node.js) and uses the appropriate server
await createServer(mastra, {
  playground: true,
  isDev: true,
  tools: getToolExports(tools),
});

if (mastra.getStorage()) {
  mastra.__registerInternalWorkflow(scoreTracesWorkflow);
}