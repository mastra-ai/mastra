// @ts-ignore
import { mastra } from '#mastra';
// @ts-ignore
import { createNodeServer } from '#server';
import { evaluate } from '@mastra/core/eval';
import { AvailableHooks, registerHook } from '@mastra/core/hooks';
import { MastraStorage } from '@mastra/core/storage';

// @ts-ignore
await createNodeServer(mastra, { playground: true, swaggerUI: true });

registerHook(AvailableHooks.ON_GENERATION, ({ input, output, metric, runId, agentName, instructions }) => {
  evaluate({
    agentName,
    input,
    metric,
    output,
    runId,
    globalRunId: runId,
    instructions,
  });
});

registerHook(AvailableHooks.ON_EVALUATION, async traceObject => {
  if (mastra.storage) {
    await mastra.storage.insert({
      tableName: MastraStorage.TABLE_EVALS,
      record: {
        result: JSON.stringify(traceObject.result),
        meta: JSON.stringify(traceObject.meta),
        input: traceObject.input,
        output: traceObject.output,
        createdAt: new Date().toISOString(),
      },
    });
  }
});
