// @ts-ignore
import { mastra } from '#mastra';
// @ts-ignore
import { createNodeServer } from '#server';
import { evaluate } from '@mastra/core/eval';
import { AvailableHooks, registerHook } from '@mastra/core/hooks';

// @ts-ignore
await createNodeServer(mastra, { playground: true, swaggerUI: true });

registerHook(AvailableHooks.ON_GENERATION, ({ input, output, metric, runId, agentName }) => {
  evaluate({
    mastra,
    agentName,
    input,
    metric,
    output,
    runId,
    globalRunId: runId,
  });
});
