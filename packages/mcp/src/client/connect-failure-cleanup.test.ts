/**
 * A connect that fails must settle with its own error even when the host refuses to let
 * the client release its process hooks, and the client must still be able to connect again
 * afterwards (#30820). Process listeners and signal handling only exist per process, so this
 * drives a real child host, like `process-hooks.test.ts`.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const packageRoot = fileURLToPath(new URL('../../', import.meta.url));
const hostScript = fileURLToPath(new URL('../__fixtures__/connect-cleanup-host.ts', import.meta.url));

// The pre-fix hang leaves the child running forever; this is the deadline that fails the test.
const HOST_TIMEOUT_MS = 15_000;

describe.skipIf(process.platform === 'win32')('MCPClient connect failure with a hostile process.off', () => {
  it('settles with the connect error and starts a fresh connect on retry when releasing the process hooks throws', async () => {
    const host = spawn(process.execPath, ['--import', 'tsx', hostScript], {
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

      expect(stdout).not.toContain('host: unhandled');
      expect(stdout).toContain('host: settled');
      expect(stdout).toContain('host: retried');
      expect(code).toBe(0);

      const settledLine = stdout.split('\n').find(line => line.startsWith('host: settled '))!;
      const reported = JSON.parse(settledLine.slice('host: settled '.length)) as Record<string, string>;
      expect(reported.broken).toContain('Failed to connect to MCP server broken');
      expect(reported.broken).toContain('HTTP 404');
      // The connect error is what reaches the caller, not the cleanup failure. The cleanup
      // failure is logged separately, so only the reported error is checked here.
      expect(reported.broken).not.toContain('process.off blocked by host');

      // A second connect against the same hostile host must start over instead of replaying
      // the rejected attempt: it rejects with the connect error, and it reaches the server
      // again — the fresh request is what proves the failed attempt was not left cached.
      const retriedLine = stdout.split('\n').find(line => line.startsWith('host: retried '))!;
      const retried = JSON.parse(retriedLine.slice('host: retried '.length)) as {
        errors: Record<string, string>;
        requests: { first: number; second: number };
      };
      expect(retried.errors.broken).toContain('Failed to connect to MCP server broken');
      expect(retried.errors.broken).toContain('HTTP 404');
      expect(retried.requests.second).toBeGreaterThan(retried.requests.first);
    } finally {
      clearTimeout(timer);
      host.kill('SIGKILL');
      await exited;
    }
  }, 20_000);
});
