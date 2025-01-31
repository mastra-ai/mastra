import { evaluate } from '@mastra/core/eval';
import { AvailableHooks, registerHook } from '@mastra/core/hooks';

// @ts-ignore
import { mastra } from './mastra.mjs';
// @ts-ignore
import { createNodeServer } from './server.mjs';

// @ts-ignore
const evalStore = [];
// @ts-ignore
const server = await createNodeServer(mastra, { playground: true, swaggerUI: true, evalStore });

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
