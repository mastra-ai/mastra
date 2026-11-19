import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const packageRoot = fileURLToPath(new URL('../../', import.meta.url));
const hostScript = fileURLToPath(new URL('../__fixtures__/graceful-shutdown-host.ts', import.meta.url));

interface ListenerSnapshot {
  SIGINT: number;
  SIGTERM: number;
  SIGHUP: number;
  beforeExit: number;
  message: number;
}

// The fixture reports the listeners it can see one stage at a time, so merge the stages a run reached.
function listenersFrom(stdout: string) {
  const snapshots: Record<string, ListenerSnapshot> = {};
  const prefix = 'host: listeners ';
  for (const line of stdout.split('\n')) {
    if (line.startsWith(prefix)) Object.assign(snapshots, JSON.parse(line.slice(prefix.length)));
  }
  return snapshots;
}

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
  const host = spawn(process.execPath, ['--import', 'tsx', hostScript, hooks, String(disconnectFirst), signal], {
    cwd: packageRoot,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  host.stderr.on('data', chunk => {
    stderr += String(chunk);
  });
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

// Signals must reach a real process: a listener mock cannot show that a signal the host never
// expected still ends it, because the leak was in the listeners, not in the callbacks (#27478).
describe.skipIf(process.platform === 'win32')('MCPClient process hooks and host shutdown', () => {
  it.each(['SIGTERM', 'SIGINT', 'SIGHUP'] satisfies NodeJS.Signals[])(
    'lets the host finish awaited cleanup on %s with hooks disabled',
    async signal => {
      const result = await signalHost({ hooks: 'false', signal });
      expect(result.stdout).toContain('host: starting cleanup');
      expect(result.stdout).toContain('host: cleanup finished');
      expect(result.code).toBe(0);
      expect(result.signal).toBeNull();
      expect(listenersFrom(result.stdout).before).toEqual(listenersFrom(result.stdout).connected);
    },
    20000,
  );

  it('still lets the host finish when disconnected before SIGTERM', async () => {
    const result = await signalHost({ hooks: 'false', disconnectFirst: true });
    expect(result.stdout).toContain('host: cleanup finished');
    expect(result.code).toBe(0);
  }, 20000);

  it.each(['default', 'true'] as const)(
    'preserves %s SIGTERM exit behavior',
    async hooks => {
      const result = await signalHost({ hooks });
      expect(result.stdout).toContain('host: starting cleanup');
      expect(result.stdout).not.toContain('host: cleanup finished');
      expect(result.code).toBe(143);
      expect(result.signal).toBeNull();
    },
    20000,
  );

  it.each([
    ['SIGINT', 130],
    ['SIGHUP', 129],
  ] as const)('ends the host with 128 + the signal number on %s while hooks are registered', async (signal, code) => {
    const result = await signalHost({ hooks: 'default', signal });
    expect(result.stdout).toContain('host: starting cleanup');
    expect(result.stdout).not.toContain('host: cleanup finished');
    expect(result.code).toBe(code);
    expect(result.signal).toBeNull();
  }, 20000);

  it('lets the host finish cleanup on SIGTERM after it disconnected clients that used default hooks', async () => {
    const result = await signalHost({ hooks: 'default', disconnectFirst: true });
    const listeners = listenersFrom(result.stdout);
    expect(result.stdout).toContain('host: starting cleanup');
    expect(result.stdout).toContain('host: cleanup finished');
    expect(result.code).toBe(0);
    expect(result.signal).toBeNull();
    // Nothing of the clients' listeners may outlive disconnect(), or the signal that follows
    // would end the host before its own cleanup ran (#29547).
    expect(listeners.disconnected).toEqual(listeners.before);
  }, 20000);
});
