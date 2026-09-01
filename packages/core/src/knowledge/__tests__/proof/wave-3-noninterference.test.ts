import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';

const exec = promisify(execFile);
const temporaryDirectories: string[] = [];
const adapter = process.env.KNOWLEDGE_ADAPTER === 'pg' ? 'pg' : 'libsql';
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../../../../');
const creator = resolve(here, '../../imports/__tests__/proof/create-linked-workspace.ts');

async function run(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv = {}) {
  return exec(command, args, {
    cwd,
    env: { ...process.env, NO_COLOR: '1', ...env },
    maxBuffer: 10 * 1024 * 1024,
  });
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, { recursive: true, force: true })));
});

describe(`Wave 3 adversarial noninterference proof (${adapter})`, () => {
  it('preserves filtered shapes and invalidates warm cross-process access after revocation', async () => {
    const directory = await mkdtemp(join(tmpdir(), `knowledge-wave-3-${adapter}-`));
    temporaryDirectories.push(directory);
    const workspace = join(directory, 'workspace');
    const output = join(directory, 'output');
    await run('pnpm', ['exec', 'tsx', creator, '--out', workspace], root);
    await run('pnpm', ['install', '--offline'], workspace);
    const execution = await run('pnpm', ['wave3', '--', '--out', output], workspace, {
      KNOWLEDGE_ADAPTER: adapter,
    });
    const result = JSON.parse(await readFile(join(output, 'result.json'), 'utf8'));

    expect(execution.stdout).toContain(`PROOF: GREEN — Wave 3 noninterference passed on ${adapter}`);
    expect(result).toEqual({
      adapter,
      hiddenDataNoninterference: true,
      inaccessibleEqualsAbsent: true,
      cycleSafe: true,
      mirrorSafe: true,
      multiParentAnyVisible: true,
      proposalApprovedAfterProposerRevocation: true,
      staleProposalConflicted: true,
      replacementRejected: true,
      warmCacheVisibleBeforeRevocation: true,
      warmCacheVisibleAfterRevocation: false,
    });
  }, 180_000);
});
