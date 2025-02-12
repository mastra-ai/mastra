import type { Mastra } from '@mastra/core';
import { AvailableHooks, registerHook } from '@mastra/core/hooks';
import { MastraStorage } from '@mastra/core/storage';

import { GLOBAL_RUN_ID_ENV_KEY } from './constants';

/**
 * TODO(storage): Currently the mastrra instance passed here is not the same we use in dev.entry.js due to bundling.
 * This does not cause apparent problems for file storage, but is a problem for in-memory storage.
 * When using :memory: URL with libSQL, each client gets its own isolated memory database, so test evals do not properly show up in the UI.
 */
export async function attachListeners(mastra?: Mastra) {
  if (mastra?.storage) {
    await mastra.storage.init();
  }

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
