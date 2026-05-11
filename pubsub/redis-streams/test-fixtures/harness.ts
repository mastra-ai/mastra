import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

export const PACKAGE_DIR = resolve(__dirname, '..');
export const TSX_BIN = resolve(PACKAGE_DIR, 'node_modules/.bin/tsx');

export const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6381';

export async function getFreePort(): Promise<number> {
  return await new Promise<number>((resolveFn, rejectFn) => {
    const srv = createServer();
    srv.unref();
    srv.on('error', rejectFn);
    srv.listen(0, () => {
      const addr = srv.address();
      if (typeof addr === 'object' && addr !== null) {
        const { port } = addr;
        srv.close(() => resolveFn(port));
      } else {
        srv.close();
        rejectFn(new Error('Failed to acquire free port'));
      }
    });
  });
}

export interface ManagedProcess {
  proc: ChildProcess;
  stdout: string;
  stderr: string;
  label: string;
}

export interface SpawnOptions {
  entry: string;
  env?: NodeJS.ProcessEnv;
  label?: string;
  /** Use absolute path to a custom binary instead of tsx (e.g. node for bundled output). */
  binary?: string;
}

export function spawnFixture(opts: SpawnOptions): ManagedProcess {
  const binary = opts.binary ?? TSX_BIN;
  const proc = spawn(binary, [opts.entry], {
    cwd: PACKAGE_DIR,
    env: { ...process.env, ...opts.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const managed: ManagedProcess = { proc, stdout: '', stderr: '', label: opts.label ?? opts.entry };
  proc.stdout?.on('data', (chunk: Buffer) => {
    managed.stdout += chunk.toString();
  });
  proc.stderr?.on('data', (chunk: Buffer) => {
    managed.stderr += chunk.toString();
  });
  return managed;
}

export async function waitForLine(managed: ManagedProcess, marker: string | RegExp, timeoutMs = 30_000): Promise<void> {
  const start = Date.now();
  const test = typeof marker === 'string' ? (s: string) => s.includes(marker) : (s: string) => marker.test(s);
  while (Date.now() - start < timeoutMs) {
    if (test(managed.stdout)) return;
    if (managed.proc.exitCode !== null) {
      throw new Error(
        `[${managed.label}] exited (code=${managed.proc.exitCode}) before emitting "${marker}".\nstdout:\n${managed.stdout}\nstderr:\n${managed.stderr}`,
      );
    }
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error(
    `[${managed.label}] timed out waiting for "${marker}".\nstdout:\n${managed.stdout}\nstderr:\n${managed.stderr}`,
  );
}

export async function waitFor(predicate: () => Promise<boolean>, timeoutMs = 15_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await predicate()) return;
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error(`waitFor timed out after ${timeoutMs}ms`);
}

export function countMarker(managed: ManagedProcess | undefined, marker: string): number {
  if (!managed) return 0;
  let count = 0;
  let idx = 0;
  while ((idx = managed.stdout.indexOf(marker, idx)) !== -1) {
    count += 1;
    idx += marker.length;
  }
  return count;
}

export async function killProcess(
  managed: ManagedProcess | undefined,
  signal: NodeJS.Signals = 'SIGTERM',
): Promise<void> {
  if (!managed) return;
  if (managed.proc.exitCode !== null) return;

  managed.proc.kill(signal);
  await new Promise<void>(resolveFn => {
    const timer = setTimeout(() => {
      try {
        managed.proc.kill('SIGKILL');
      } catch {
        /* ignore */
      }
      resolveFn();
    }, 5000);
    managed.proc.once('exit', () => {
      clearTimeout(timer);
      resolveFn();
    });
  });
}

export async function makeStorageDir(
  prefix = 'mastra-redis-streams-',
): Promise<{ dir: string; storageUrl: string; cleanup: () => Promise<void> }> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  const storageUrl = `file:${join(dir, 'mastra.db')}`;
  return {
    dir,
    storageUrl,
    cleanup: async () => {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    },
  };
}

export async function flushRedis(redisUrl = REDIS_URL): Promise<void> {
  const { createClient } = await import('redis');
  const client = createClient({ url: redisUrl });
  await client.connect();
  try {
    await client.flushAll();
  } finally {
    await client.quit();
  }
}

/**
 * Wait until the server's HTTP listener is actually accepting connections.
 * Useful because `server-ready` is logged before the listen() callback fires
 * in some Mastra internal startup paths.
 */
export async function waitForServerHttp(serverUrl: string, timeoutMs = 15_000): Promise<void> {
  await waitFor(async () => {
    try {
      const res = await fetch(`${serverUrl}/api`);
      return res.ok || res.status === 404 || res.status === 405;
    } catch {
      return false;
    }
  }, timeoutMs);
}
