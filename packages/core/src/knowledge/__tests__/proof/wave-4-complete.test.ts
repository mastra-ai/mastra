import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../../../../');
const exec = promisify(execFile);

it('runs the final linked consumer with durable restart, source recovery and private-memory isolation', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'knowledge-wave4-test-'));
  const workspace = join(directory, 'workspace');
  const output = join(directory, 'result');
  const run = (args: string[], cwd: string) => exec('pnpm', args, { cwd, maxBuffer: 10 * 1024 * 1024 });
  try {
    await run(['exec', 'tsx', join(here, 'create-wave-4-linked-workspace.ts'), '--out', workspace], root);
    await expect(
      run(['exec', 'tsx', join(here, 'create-wave-4-linked-workspace.ts'), '--out', workspace], root),
    ).rejects.toThrow('Output already exists');
    await run(['install', '--offline', '--ignore-workspace'], workspace);
    await run(['check'], workspace);
    const env = { ...process.env };
    delete env.OPENAI_API_KEY;
    const missingKeyOutput = join(directory, 'missing-key');
    await expect(exec('pnpm', ['wave4', '--', '--out', missingKeyOutput], { cwd: workspace, env })).rejects.toThrow(
      'OPENAI_API_KEY is required',
    );
    await expect(stat(missingKeyOutput)).rejects.toMatchObject({ code: 'ENOENT' });
    const execution = await run(['wave4', '--', '--deterministic', '--out', output], workspace);
    expect(execution.stdout).toContain('PROOF: GREEN — final linked-consumer deterministic-only journey');
    const result = JSON.parse(await readFile(join(output, 'result.json'), 'utf8'));
    expect(result).toMatchObject({
      surface: 'linked-built-packages',
      mode: 'deterministic-only',
      provider: null,
      compiler: null,
      steps: ['durable-seed', 'durable-restart', 'file-backed-source-recovery', 'private-memory-source-recovery'],
      durable: {
        freshProcessWatermark: true,
        replayWithoutDuplicates: true,
        failedVerificationPreservesGraph: true,
        publicPrivateSeparation: true,
      },
    });
    expect(result.exclusions).toEqual([
      'UI/TUI journeys',
      'four-adapter matrix',
      'official skill distribution',
      'live Shipyard deployment',
    ]);
    const transcript = await readFile(join(output, 'transcript.txt'), 'utf8');
    expect(transcript).toContain('deterministic-only journey');
    expect(transcript).not.toContain('real-provider-maintenance-goal');
    await expect(run(['wave4', '--', '--deterministic', '--out', output], workspace)).rejects.toThrow();
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 180_000);

it.skipIf(process.env.RUN_WAVE4_PROVIDER_PROOF !== '1')(
  'compiles the full Shipyard description and reuses it after a fresh-process restart',
  async () => {
    const apiKey = process.env.SHIPYARD_OPENAI_API_KEY;
    expect(apiKey, 'SHIPYARD_OPENAI_API_KEY is required for the explicit provider gate').toBeTruthy();
    const directory = await mkdtemp(join(tmpdir(), 'knowledge-wave4-provider-'));
    const workspace = join(directory, 'workspace');
    const output = join(directory, 'compiler');
    try {
      await exec('pnpm', ['exec', 'tsx', join(here, 'create-wave-4-linked-workspace.ts'), '--out', workspace], {
        cwd: root,
      });
      await exec('pnpm', ['install', '--offline', '--ignore-workspace'], { cwd: workspace });
      const env: NodeJS.ProcessEnv = { ...process.env, OPENAI_API_KEY: apiKey };
      await exec(
        process.execPath,
        ['--import', 'tsx', 'src/shipyard-compiler.ts', '--phase', 'seed', '--out', output],
        {
          cwd: workspace,
          env,
          timeout: 180_000,
          maxBuffer: 10 * 1024 * 1024,
        },
      );
      // Restart has no provider credential: success must come from durable compiled state.
      delete env.OPENAI_API_KEY;
      delete env.SHIPYARD_OPENAI_API_KEY;
      const resumed = await exec(
        process.execPath,
        ['--import', 'tsx', 'src/shipyard-compiler.ts', '--phase', 'resume', '--out', output],
        {
          cwd: workspace,
          env,
          timeout: 30_000,
          maxBuffer: 10 * 1024 * 1024,
        },
      );
      expect(resumed.stdout).toContain('PROOF: GREEN');
      expect(JSON.parse(await readFile(join(output, 'result.json'), 'utf8'))).toMatchObject({
        freshProcessRestart: true,
        restartCompilerCalls: 0,
        publicPrivateSeparation: true,
        recoveredApplyFailure: true,
      });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  },
  240_000,
);
