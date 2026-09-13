import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';

const exec = promisify(execFile);
const temporaryDirectories: string[] = [];
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../../../../');
const creator = resolve(here, '../../imports/__tests__/proof/create-linked-workspace.ts');

async function run(args: string[], cwd: string, env: NodeJS.ProcessEnv = {}) {
  return exec('pnpm', args, { cwd, env: { ...process.env, ...env, NO_COLOR: '1' }, maxBuffer: 10 * 1024 * 1024 });
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

describe('Shipyard-shaped durable operations proof', () => {
  it('uses built packages in a linked consumer and resumes maintenance in a fresh process', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'knowledge-shipyard-operations-'));
    temporaryDirectories.push(directory);
    const workspace = join(directory, 'workspace');
    const output = join(directory, 'output');
    await run(['exec', 'tsx', creator, '--out', workspace], root);
    await run(['install', '--offline'], workspace);
    await run(['shipyard', '--', '--phase', 'seed', '--out', output], workspace);
    const execution = await run(['shipyard', '--', '--phase', 'resume', '--out', output], workspace);
    const seed = JSON.parse(await readFile(join(output, 'seed.json'), 'utf8'));
    const result = JSON.parse(await readFile(join(output, 'result.json'), 'utf8'));
    expect(execution.stdout).toContain('PROOF: GREEN — Shipyard deterministic durable maintenance passed');
    expect(result).toMatchObject({
      surface: 'linked-built-packages',
      adapter: 'libsql',
      source: 'deterministic-fixture',
      freshProcessWatermark: true,
      replayWithoutDuplicates: true,
      failedVerificationPreservesGraph: true,
      forwardIntegrationPreservesNode: true,
      publicPrivateSeparation: true,
      nodeId: seed.nodeId,
    });
    expect(result.recordId).not.toBe(seed.recordId);
  }, 180_000);

  it.skipIf(process.env.RUN_SHIPYARD_GOAL_PROOF !== '1')(
    'repairs a gap with a native goal and judges real graph state',
    async () => {
      const apiKey = process.env.SHIPYARD_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
      expect(apiKey, 'SHIPYARD_OPENAI_API_KEY is required for the native goal proof').toBeTruthy();
      const directory = await mkdtemp(join(tmpdir(), 'knowledge-shipyard-goal-'));
      temporaryDirectories.push(directory);
      const workspace = join(directory, 'workspace');
      const output = join(directory, 'output');
      await run(['exec', 'tsx', creator, '--out', workspace], root);
      await run(['install', '--offline'], workspace);
      const execution = await run(['exec', 'tsx', 'src/shipyard-maintenance-goal.ts', '--out', output], workspace, {
        OPENAI_API_KEY: apiKey,
      });
      expect(execution.stdout).toContain('PROOF: GREEN — real-provider native Shipyard maintenance goal passed');
      const result = JSON.parse(await readFile(join(output, 'result.json'), 'utf8'));
      expect(result).toMatchObject({
        source: 'deterministic-fixture',
        objectiveStatus: 'done',
        graph: { integrated: true, internalRecordCount: 1, publicRecordCount: 0 },
      });
      expect(result.repairCalls).toBeGreaterThan(0);
      expect(result.graphReads).toBeGreaterThan(0);
    },
    180_000,
  );
});
