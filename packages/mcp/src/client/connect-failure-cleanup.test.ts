/**
 * A connect that fails must settle with its own error even when the host refuses to let
 * the client release its process hooks, and the client must still be able to connect again
 * afterwards (#30820). A host logger that throws while the failed release is reported must not
 * break that recovery either. Process listeners and signal handling only exist per process, so
 * this drives a real child host, like `process-hooks.test.ts`.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const packageRoot = fileURLToPath(new URL('../../', import.meta.url));
const hostScript = fileURLToPath(new URL('../__fixtures__/connect-cleanup-host.ts', import.meta.url));

// The pre-fix hang leaves the child running forever; this is the deadline that fails the test.
const HOST_TIMEOUT_MS = 15_000;

/** Runs the child host to completion and returns what it printed. */
async function runHost(mode: 'hooks' | 'logger') {
  const host = spawn(process.execPath, ['--import', 'tsx', hostScript, mode], {
    cwd: packageRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  host.stdout.on('data', chunk => {
    stdout += String(chunk);
  });
  host.stderr.on('data', chunk => {
    stderr += String(chunk);
  });
  const exited = new Promise<number | null>((resolve, reject) => {
    host.once('error', reject);
    host.once('close', code => resolve(code));
  });
  let timer: NodeJS.Timeout | undefined;
  try {
    const code = await Promise.race([
      exited,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Host never settled: ${stdout}\n${stderr}`)), HOST_TIMEOUT_MS);
      }),
    ]);
    return { code, stdout };
  } finally {
    clearTimeout(timer);
    host.kill('SIGKILL');
    await exited;
  }
}

/** Reads a JSON payload the host printed behind a `host: <name> ` prefix. */
function hostPayload<T>(stdout: string, name: string): T {
  const prefix = `host: ${name} `;
  const line = stdout.split('\n').find(candidate => candidate.startsWith(prefix));
  expect(line, `the host printed no "${prefix}" line`).toBeDefined();
  return JSON.parse((line ?? '').slice(prefix.length)) as T;
}

describe.skipIf(process.platform === 'win32')('MCPClient connect failure with a hostile process.off', () => {
  it('settles with the connect error and starts a fresh connect on retry when releasing the process hooks throws', async () => {
    const { code, stdout } = await runHost('hooks');

    expect(stdout).not.toContain('host: unhandled');
    expect(stdout).toContain('host: settled');
    expect(stdout).toContain('host: retried');
    expect(code).toBe(0);

    const reported = hostPayload<Record<string, string>>(stdout, 'settled');
    expect(reported.broken).toContain('Failed to connect to MCP server broken');
    expect(reported.broken).toContain('HTTP 404');
    // The connect error is what reaches the caller, not the cleanup failure. The cleanup
    // failure is logged separately, so only the reported error is checked here.
    expect(reported.broken).not.toContain('process.off blocked by host');

    // A second connect against the same hostile host must start over instead of replaying
    // the rejected attempt: it rejects with the connect error, and it reaches the server
    // again — the fresh request is what proves the failed attempt was not left cached.
    const retried = hostPayload<{
      errors: Record<string, string>;
      requests: { first: number; second: number };
    }>(stdout, 'retried');
    expect(retried.errors.broken).toContain('Failed to connect to MCP server broken');
    expect(retried.errors.broken).toContain('HTTP 404');
    expect(retried.requests.second).toBeGreaterThan(retried.requests.first);

    // The host refuses only the SIGTERM removal, so SIGHUP is the listener that shows whether
    // the release carried on past the refusal instead of abandoning the rest of it.
    const listeners = hostPayload<{ SIGTERM: number; SIGHUP: number }>(stdout, 'listeners');
    expect(listeners.SIGHUP).toBe(0);
  }, 20_000);

  it('keeps a failed connect out of the cache when the host logger throws while the release is reported', async () => {
    const { code, stdout } = await runHost('logger');

    expect(stdout).not.toContain('host: unhandled');
    expect(code).toBe(0);

    // The logger refuses the failed-release report. Recovery must survive that: the retry still
    // rejects with the connect error and still reaches the server, so the rejected attempt was
    // already dropped when the report threw.
    const retried = hostPayload<{
      errors: Record<string, string>;
      requests: { first: number; second: number };
    }>(stdout, 'retried');
    expect(retried.errors.broken).toContain('Failed to connect to MCP server broken');
    expect(retried.errors.broken).toContain('HTTP 404');
    expect(retried.requests.second).toBeGreaterThan(retried.requests.first);
  }, 20_000);
});
