import type { Mastra } from '@mastra/core';
import { AvailableHooks, registerHook } from '@mastra/core/hooks';
import { MastraStorage } from '@mastra/core/storage';

import { GLOBAL_RUN_ID_ENV_KEY } from './constants';

export async function attachListeners(mastra?: Mastra) {
  registerHook(AvailableHooks.ON_EVALUATION, async traceObject => {
    if (mastra?.storage) {
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
}

export async function globalSetup() {
  if (process.env[GLOBAL_RUN_ID_ENV_KEY]) {
    throw new Error('Global run id already set, you should only run "GlobalSetup" once');
  }

  const globalRunId = crypto.randomUUID();
  process.env[GLOBAL_RUN_ID_ENV_KEY] = globalRunId;
}
