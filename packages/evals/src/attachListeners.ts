import type { Mastra } from '@mastra/core';
import { AvailableHooks, registerHook } from '@mastra/core/hooks';
import { TABLE_EVALS } from '@mastra/core/storage';

import { GLOBAL_RUN_ID_ENV_KEY } from './constants';

export async function attachListeners(mastra?: Mastra) {
  if (mastra?.storage) {
    await mastra.storage.init();
  }

  registerHook(AvailableHooks.ON_EVALUATION, async traceObject => {
    if (mastra?.storage) {
      await mastra.storage.insert({
        tableName: TABLE_EVALS,
        record: {
          input: traceObject.input,
          output: traceObject.output,
          result: JSON.stringify(traceObject.result),
          agent_name: traceObject.agentName,
          metric_name: traceObject.metricName,
          instructions: traceObject.instructions,
          test_info: traceObject.testInfo ? JSON.stringify(traceObject.testInfo) : null,
          global_run_id: traceObject.globalRunId,
          run_id: traceObject.runId,
          created_at: new Date().toISOString(),
        },
      });
    }
  });
}

export async function globalSetup() {
  if (process.env[GLOBAL_RUN_ID_ENV_KEY]) {
    throw new Error('Global run id already set, you should only run "GlobalSetup" once');
  }

  const globalRunId = crypto.randomUUID();
  process.env[GLOBAL_RUN_ID_ENV_KEY] = globalRunId;
}
