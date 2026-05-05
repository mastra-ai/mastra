/**
 * IsloSandbox integration tests.
 *
 * Run only when `ISLO_API_KEY` is set. Tests hit api.islo.dev and create real
 * sandboxes which are torn down in `afterAll`.
 */

import { afterAll, describe, expect, it } from 'vitest';

import { IsloSandbox } from './index';

const hasApiKey = !!process.env.ISLO_API_KEY;

describe.skipIf(!hasApiKey)('IsloSandbox (live)', () => {
  const sandbox = new IsloSandbox({
    sandboxName: `mastra-it-${Date.now().toString(36)}`,
    timeout: 60_000,
  });

  afterAll(async () => {
    try {
      await sandbox._destroy();
    } catch {
      // best-effort cleanup
    }
  }, 60_000);

  it('creates a sandbox, runs a command, and streams output live', async () => {
    await sandbox._start();
    expect(sandbox.status).toBe('running');

    const chunks: string[] = [];
    const result = await sandbox.executeCommand!('echo', ['hello-from-mastra'], {
      onStdout: (d) => chunks.push(d),
    });

    expect(result.success).toBe(true);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('hello-from-mastra');
    expect(chunks.length).toBeGreaterThan(0);
  }, 120_000);

  it('streams output incrementally for a long-running command', async () => {
    const chunks: string[] = [];
    const start = Date.now();
    const result = await sandbox.executeCommand!('bash', ['-lc', 'for i in 1 2 3; do echo $i; sleep 1; done'], {
      onStdout: (d) => chunks.push(d),
    });
    const elapsed = Date.now() - start;

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/1[\r\n]+2[\r\n]+3/);
    // Three iterations sleep ≈3s; total should be around that, not buffered.
    expect(elapsed).toBeGreaterThan(2_000);
  }, 30_000);

  it('propagates non-zero exit codes', async () => {
    const result = await sandbox.executeCommand!('bash', ['-lc', 'echo oops >&2; exit 42']);
    expect(result.exitCode).toBe(42);
    expect(result.success).toBe(false);
    expect(result.stderr).toContain('oops');
  }, 60_000);
});
