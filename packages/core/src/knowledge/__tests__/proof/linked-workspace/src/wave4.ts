import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const index = process.argv.indexOf('--out');
assert(index >= 0 && process.argv[index + 1], '--out <new directory> is required');
const output = resolve(process.argv[index + 1]!);
const deterministic = process.argv.includes('--deterministic');
assert(
  deterministic || process.env.OPENAI_API_KEY,
  'OPENAI_API_KEY is required; --deterministic explicitly excludes provider proof',
);
await mkdir(output);
const workspace = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const temporary = await mkdtemp(join(tmpdir(), 'knowledge-wave4-'));
const steps: string[] = [];

async function run(name: string, file: string, args: string[] = []) {
  const env: NodeJS.ProcessEnv = { ...process.env, NO_COLOR: '1' };
  delete env.FORCE_COLOR;
  const result = await promisify(execFile)(process.execPath, ['--import', 'tsx', `src/${file}`, ...args], {
    cwd: workspace,
    env,
    timeout: 180_000,
    maxBuffer: 10 * 1024 * 1024,
  });
  if (name !== 'durable-seed')
    assert(result.stdout.includes('PROOF: GREEN'), `${name} did not produce its verified verdict`);
  steps.push(name);
  console.log(`PASS: ${name}`);
}

try {
  const durable = join(temporary, 'durable');
  await run('durable-seed', 'shipyard-operations.ts', ['--phase', 'seed', '--out', durable]);
  await run('durable-restart', 'shipyard-operations.ts', ['--phase', 'resume', '--out', durable]);
  const persisted = JSON.parse(await readFile(join(durable, 'result.json'), 'utf8'));
  assert(persisted.freshProcessWatermark && persisted.replayWithoutDuplicates && persisted.publicPrivateSeparation);
  await run('file-backed-source-recovery', 'shipyard-wiring.ts');
  await run('private-memory-source-recovery', 'shipyard-wiring.ts', ['--memory']);
  let provider: unknown = null;
  let compiler: unknown = null;
  if (!deterministic) {
    const compiled = join(temporary, 'compiler');
    await run('full-description-compiler-seed', 'shipyard-compiler.ts', ['--phase', 'seed', '--out', compiled]);
    await run('full-description-compiler-restart', 'shipyard-compiler.ts', ['--phase', 'resume', '--out', compiled]);
    compiler = JSON.parse(await readFile(join(compiled, 'result.json'), 'utf8'));
    const goal = join(temporary, 'goal');
    await run('real-provider-maintenance-goal', 'shipyard-maintenance-goal.ts', ['--out', goal]);
    provider = JSON.parse(await readFile(join(goal, 'result.json'), 'utf8'));
  }
  await writeFile(
    join(output, 'result.json'),
    JSON.stringify(
      {
        surface: 'linked-built-packages',
        mode: deterministic ? 'deterministic-only' : 'real-provider',
        steps,
        durable: persisted,
        provider,
        compiler,
        exclusions: [
          'UI/TUI journeys',
          'four-adapter matrix',
          'official skill distribution',
          'live Shipyard deployment',
        ],
      },
      null,
      2,
    ),
  );
  const verdict = `PROOF: GREEN — final linked-consumer ${deterministic ? 'deterministic-only' : 'real-provider'} journey`;
  await writeFile(join(output, 'transcript.txt'), `${steps.map(step => `PASS: ${step}`).join('\n')}\n${verdict}\n`);
  console.log(verdict);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
