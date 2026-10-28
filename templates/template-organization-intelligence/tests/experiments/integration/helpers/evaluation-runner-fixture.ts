import { copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function evaluationRunnerFixture(
  directory: string,
  mode: 'expired' | 'retryable-answer' | 'retryable-judge' | 'success' | 'timeout',
) {
  const injector = join(directory, `openai-${mode}-fixture.mjs`);
  const log = join(directory, `openai-${mode}-requests.jsonl`);
  await copyFile(new URL('../../../fixtures/openai-fetch.mjs', import.meta.url), injector);
  return {
    env: {
      ...process.env,
      EVALUATION_FIXTURE_LOG: log,
      EVALUATION_FIXTURE_MODE: mode,
      NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import=${pathToFileURL(injector).href}`.trim(),
      OPENAI_API_KEY: 'fixture-key',
    },
    log,
  };
}
