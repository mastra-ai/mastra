// @ts-ignore
import { mastra } from '#mastra';
// @ts-ignore
import { createNodeServer } from '#server';
import { evaluate } from '@mastra/core/eval';
import { AvailableHooks, registerHook } from '@mastra/core/hooks';

// @ts-ignore
const evalStore = [];
// @ts-ignore
await createNodeServer(mastra, { playground: true, swaggerUI: true, evalStore });

registerHook(AvailableHooks.ON_GENERATION, ({ input, output, metric, runId, agentName }) => {
  evaluate({
    agentName,
    input,
    metric,
    output,
    runId,
    globalRunId: runId,
  });
});

registerHook(AvailableHooks.ON_EVALUATION, async traceObject => {
  evalStore.push(traceObject);
});
