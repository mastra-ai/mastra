import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const packageRoot = fileURLToPath(new URL('../../', import.meta.url));
const hostScript = fileURLToPath(new URL('../__fixtures__/graceful-shutdown-host.ts', import.meta.url));

// Run node directly: the tsx CLI would intercept the signal before the host sees it.
async function signalHost({
  hooks,
  disconnectFirst = false,
  signal = 'SIGTERM',
}: {
  hooks: 'true' | 'false' | 'default';
  disconnectFirst?: boolean;
  signal?: NodeJS.Signals;
}) {
  const host = spawn(
    process.execPath,
    ['--import', 'tsx', hostScript, hooks, String(disconnectFirst), signal],
    { cwd: packageRoot, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  let stdout = '';
  let stderr = '';
  host.stderr.on('data', chunk => { stderr += String(chunk); });
  const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
    host.once('error', reject);
    host.once('close', (code, signal) => resolve({ code, signal }));
  });
  const run = async () => {
    await new Promise<void>((resolve, reject) => {
      host.stdout.on('data', chunk => {
        stdout += String(chunk);
        if (stdout.includes('host: READY')) resolve();
      });
      void exited.then(() => reject(new Error(`Host exited before READY: ${stdout}\n${stderr}`)), reject);
    });
    host.kill(signal);
    return { ...(await exited), stdout, stderr };
  };
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      run(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Host timed out: ${stdout}\n${stderr}`)), 15000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
    host.kill('SIGKILL');
    await exited;
  }
}

// Signals must reach a real process: listener mocks miss exit-hook's persistent handlers (#27478).
describe.skipIf(process.platform === 'win32')('MCPClient process hooks and host shutdown', () => {
  it.each(['SIGTERM', 'SIGINT', 'SIGHUP'] satisfies NodeJS.Signals[])(
    'lets the host finish awaited cleanup on %s with hooks disabled',
    async signal => {
      const result = await signalHost({ hooks: 'false', signal });
      expect(result.stdout).toContain('host: starting cleanup');
      expect(result.stdout).toContain('host: cleanup finished');
      expect(result.code).toBe(0);
      expect(result.signal).toBeNull();
    },
    20000,
  );

  it('still lets the host finish when disconnected before SIGTERM', async () => {
    const result = await signalHost({ hooks: 'false', disconnectFirst: true });
    expect(result.stdout).toContain('host: cleanup finished');
    expect(result.code).toBe(0);
  }, 20000);

  it.each(['default', 'true'] as const)('preserves %s SIGTERM exit behavior', async hooks => {
    const result = await signalHost({ hooks });
    expect(result.stdout).toContain('host: starting cleanup');
    expect(result.stdout).not.toContain('host: cleanup finished');
    expect(result.code).toBe(143);
    expect(result.signal).toBeNull();
  }, 20000);
});
