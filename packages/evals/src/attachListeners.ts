import { AvailableHooks, registerHook } from '@mastra/core';
import { mkdirSync, appendFile } from 'fs';
import { join } from 'path';

export async function attachListeners() {
  const dotMastraPath = join(process.cwd(), '.mastra');

  try {
    mkdirSync(dotMastraPath);
  } catch (error) {}

  registerHook(AvailableHooks.ON_EVALUATION, traceObject => {
    appendFile(join(dotMastraPath, 'evals.json'), JSON.stringify(traceObject), () => {});
  });
}
