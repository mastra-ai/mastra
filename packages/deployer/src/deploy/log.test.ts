import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { noopLogger } from '@mastra/core/logger';
import { afterEach, describe, expect, it } from 'vitest';
import { createChildProcessLogger } from './log';

describe.skipIf(process.platform === 'win32')('createChildProcessLogger', () => {
  const dirs: string[] = [];
  afterEach(async () => {
    await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })));
  });
  async function tempDir() {
    const dir = await mkdtemp(join(tmpdir(), 'mastra-cp-logger-'));
    dirs.push(dir);
    return dir;
  }

  it('passes shell metacharacters through to the binary verbatim without running them', async () => {
    const root = await tempDir();
    const hostile = ['out dir;touch pwned', '$(touch pwned)', '`touch pwned`', 'a && touch pwned', 'a | touch pwned'];
    const run = createChildProcessLogger({ logger: noopLogger, root });

    const result: any = await run({
      cmd: 'node -p',
      args: ['JSON.stringify(process.argv.slice(1))', ...hostile],
      env: { PATH: process.env.PATH! },
    });

    expect(result.success).toBe(true);
    expect(JSON.parse(result.stdout)).toEqual(hostile);
    expect(await readdir(root)).toEqual([]);
  });

  it('rejects with the exit code when the binary fails', async () => {
    const root = await tempDir();
    const run = createChildProcessLogger({ logger: noopLogger, root });

    await expect(run({ cmd: 'node -e', args: ['process.exit(3)'], env: { PATH: process.env.PATH! } })).rejects.toThrow(
      'Process exited with code 3',
    );
  });
});
