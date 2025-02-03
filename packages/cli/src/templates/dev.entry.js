import { evaluate } from '@mastra/core/eval';
import { AvailableHooks, registerHook } from '@mastra/core/hooks';

// @ts-ignore
import { mastra } from './mastra.mjs';
// @ts-ignore
import { createNodeServer } from './server.mjs';

// @ts-ignore
const evalStore = [];

// @ts-ignore
const swaggerUI = process.env?.MASTRA_SERVER_SWAGGER_UI === 'true';
// @ts-ignore
const fiberplane = process.env?.MASTRA_SERVER_FIBERPLANE === 'true';
// @ts-ignore
const apiReqLogs = process.env?.MASTRA_SERVER_API_REQ_LOGS === 'true';

// @ts-ignore
const server = await createNodeServer(mastra, { playground: true, apiReqLogs, evalStore, fiberplane, swaggerUI });

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
