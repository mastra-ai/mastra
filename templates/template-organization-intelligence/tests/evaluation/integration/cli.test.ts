import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
const command = promisify(execFile);
describe('evaluation integration', () => {
  it('evaluation CLI rejects invalid arguments without provider access', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'organization-eval-cli-'));
    await command('npm', ['exec', '--', 'tsc', '-p', 'tsconfig.eval.json']);
    const runner = fileURLToPath(new URL('../../../build/eval/mastra/evaluation/eval-runner.js', import.meta.url));
    const { OPENAI_API_KEY: _key, ...withoutKey } = process.env;
    await expect(
      command(process.execPath, [runner, '--allow-live', '--state-dir'], { env: withoutKey }),
    ).rejects.toMatchObject({ code: 1 });
    await expect(
      command(process.execPath, [runner, '--allow-live', '--state-dir=--not-a-directory'], { env: withoutKey }),
    ).rejects.toMatchObject({ code: 1 });
    const stateDirectory = join(directory, 'state');
    await expect(
      command(process.execPath, [runner, '--', '--allow-live', '--state-dir', stateDirectory], { env: withoutKey }),
    ).rejects.toMatchObject({ code: 1 });
    const report = JSON.parse(await readFile(join(stateDirectory, 'evaluation-report.json'), 'utf8')) as {
      settings: { answerCalls: number; judgeCalls: number; embeddingCalls: number };
      failure: { stage: string; reason: string };
    };
    expect(report.settings).toMatchObject({ answerCalls: 0, judgeCalls: 0, embeddingCalls: 0 });
    expect(report.failure).toEqual({ stage: 'environment', reason: 'Evaluation environment did not complete.' });
    await rm(directory, { recursive: true, force: true });
  });
});
