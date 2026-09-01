import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../../../../../');
const creator = resolve(here, '../../imports/__tests__/proof/create-linked-workspace.ts');
const directory = await mkdtemp(join(tmpdir(), 'knowledge-wave-3-two-process-'));
const workspace = join(directory, 'workspace');
const output = join(directory, 'output');

try {
  await exec('pnpm', ['exec', 'tsx', creator, '--out', workspace], {
    cwd: root,
    env: { ...process.env, NO_COLOR: '1' },
  });
  await exec('pnpm', ['install', '--offline'], { cwd: workspace, env: { ...process.env, NO_COLOR: '1' } });
  const execution = await exec('pnpm', ['wave3', '--', '--out', output], {
    cwd: workspace,
    env: { ...process.env, NO_COLOR: '1', KNOWLEDGE_ADAPTER: 'libsql' },
    maxBuffer: 10 * 1024 * 1024,
  });
  const result = JSON.parse(await readFile(join(output, 'result.json'), 'utf8')) as {
    warmCacheVisibleBeforeRevocation: boolean;
    warmCacheVisibleAfterRevocation: boolean;
  };
  if (!result.warmCacheVisibleBeforeRevocation || result.warmCacheVisibleAfterRevocation) {
    throw new Error('Cross-process revocation did not invalidate the warm access frontier');
  }
  process.stdout.write(execution.stdout);
  console.log('PROOF: GREEN — two-process warm-cache revocation converged');
} finally {
  await rm(directory, { recursive: true, force: true });
}
