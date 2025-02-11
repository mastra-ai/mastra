import type { Mastra } from '@mastra/core';
import { AvailableHooks, registerHook } from '@mastra/core/hooks';
import { MastraStorage } from '@mastra/core/storage';
import { mkdirSync, appendFile } from 'fs';
import { join } from 'path';

import { GLOBAL_RUN_ID_ENV_KEY } from './constants';

export async function attachListeners(mastra: Mastra) {
  const dotMastraPath = join(process.cwd(), '.mastra');

  try {
    mkdirSync(dotMastraPath);
  } catch (error) {}

  registerHook(AvailableHooks.ON_EVALUATION, async traceObject => {
    appendFile(join(dotMastraPath, 'evals.json'), JSON.stringify(traceObject) + '\n', () => {});
    if (mastra?.memory?.storage) {
      await mastra.memory.storage.insert({
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
