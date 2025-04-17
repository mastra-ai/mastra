// @ts-ignore
// @ts-ignore
import { evaluate } from '@mastra/core/eval';
import { AvailableHooks, registerHook } from '@mastra/core/hooks';
import { TABLE_EVALS } from '@mastra/core/storage';
import { checkEvalStorageFields } from '@mastra/core/utils';
import { mastra } from '#mastra';
import { createNodeServer } from '#server';
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

if (mastra.getStorage()) {
  // start storage init in the background
  mastra.getStorage().init();
}

registerHook(AvailableHooks.ON_EVALUATION, async traceObject => {
  const storage = mastra.getStorage();
  if (storage) {
    // Check for required fields
    const logger = mastra?.getLogger();
    const areFieldsValid = checkEvalStorageFields(traceObject, logger);
    if (!areFieldsValid) return;

    await storage.insert({
      tableName: TABLE_EVALS,
      record: {
        input: traceObject.input,
        output: traceObject.output,
        result: JSON.stringify(traceObject.result || {}),
        agent_name: traceObject.agentName,
        metric_name: traceObject.metricName,
        instructions: traceObject.instructions,
        test_info: null,
        global_run_id: traceObject.globalRunId,
        run_id: traceObject.runId,
        created_at: new Date().toISOString(),
      },
    });
  }
});
