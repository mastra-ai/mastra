import { fork } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('idle Session retention (#28230)', () => {
  it('releases finished run contexts while keeping the session usable', async () => {
    // Isolate forced garbage collection so the test suite does not need to run with --expose-gc.
    const fixture = new URL('./__tests__/fixtures/idle-session-retention-gc.ts', import.meta.url);
    const child = fork(fixture, {
      execArgv: ['--expose-gc', '--import', import.meta.resolve('tsx')],
      silent: true,
    });
    const stderr: Buffer[] = [];
    child.stderr?.on('data', chunk => stderr.push(chunk));
    let completed = false;
    child.on('message', message => {
      if (message === 'ok') completed = true;
    });

    const result = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
      const timeout = setTimeout(() => child.kill('SIGKILL'), 30_000);
      child.once('error', error => {
        clearTimeout(timeout);
        reject(error);
      });
      child.once('close', (code, signal) => {
        clearTimeout(timeout);
        resolve({ code, signal });
      });
    });

    const diagnostics = Buffer.concat(stderr).toString() || 'child produced no stderr';
    expect({ ...result, completed }, diagnostics).toEqual({ code: 0, signal: null, completed: true });
  }, 40_000);
});
