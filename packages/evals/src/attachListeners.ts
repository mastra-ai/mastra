import { AvailableHooks, registerHook } from '@mastra/core/hooks';
import { mkdirSync, appendFile } from 'fs';
import { join } from 'path';

import { GLOBAL_RUN_ID_ENV_KEY } from './constants';

export async function attachListeners() {
  const dotMastraPath = join(process.cwd(), '.mastra');

  try {
    mkdirSync(dotMastraPath);
  } catch (error) {}

  registerHook(AvailableHooks.ON_EVALUATION, async traceObject => {
    appendFile(join(dotMastraPath, 'evals.json'), JSON.stringify(traceObject) + '\n', () => {});
  });
}

export async function globalSetup() {
  if (process.env[GLOBAL_RUN_ID_ENV_KEY]) {
    throw new Error('Global run id already set, you should only run "GlobalSetup" once');
  }

  const globalRunId = crypto.randomUUID();
  process.env[GLOBAL_RUN_ID_ENV_KEY] = globalRunId;
}
