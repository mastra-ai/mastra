import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { connect, createServer } from 'node:net';
import type { AddressInfo, Socket } from 'node:net';
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

/**
 * Split complete RESP request arrays (`*N\r\n$len\r\narg\r\n...`) off the front
 * of `buf`. Returns each command's name and the unparsed remainder.
 */
function takeRespCommands(buf: Buffer): { names: string[]; rest: Buffer } {
  const names: string[] = [];
  let offset = 0;
  outer: while (offset < buf.length) {
    if (buf[offset] !== 0x2a /* '*' */) throw new Error(`unexpected RESP request byte ${buf[offset]}`);
    let lineEnd = buf.indexOf('\r\n', offset);
    if (lineEnd === -1) break;
    const argc = Number(buf.toString('latin1', offset + 1, lineEnd));
    let cursor = lineEnd + 2;
    let name = '';
    for (let i = 0; i < argc; i++) {
      lineEnd = buf.indexOf('\r\n', cursor);
      if (lineEnd === -1) break outer;
      const len = Number(buf.toString('latin1', cursor + 1, lineEnd));
      const start = lineEnd + 2;
      if (buf.length < start + len + 2) break outer;
      if (i === 0) name = buf.toString('latin1', start, start + len).toUpperCase();
      cursor = start + len + 2;
    }
    names.push(name);
    offset = cursor;
  }
  return { names, rest: buf.subarray(offset) };
}

/**
 * TCP proxy that simulates a Redis restart followed by its dataset reload.
 * `restart(ms)` drops every open connection (the old server process died),
 * then for `ms` milliseconds every new connection is answered
 * `-LOADING Redis is loading the dataset in memory` per command, exactly like a
 * real server replaying a large RDB/AOF. Connection-setup commands Redis
 * allows while loading (CLIENT, HELLO, AUTH, SELECT) succeed. When the window
 * closes, every connection opened during it starts forwarding to the real
 * server with its unanswered bytes intact. Data in the backing Redis survives,
 * as it does after a persisted restart.
 */
export function makeLoadingProxy(target: { host: string; port: number }) {
  const sockets = new Set<Socket>();
  const loadingClients = new Set<{ attach: () => void }>();
  let loadingUntil = 0;
  let loadingReplies = 0;
  let windowTimer: ReturnType<typeof setTimeout> | undefined;
  const forward = (client: Socket, initial: Buffer[] = []) => {
    const upstream = connect(target.port, target.host);
    sockets.add(upstream);
    upstream.on('close', () => {
      sockets.delete(upstream);
      client.destroy();
    });
    upstream.on('error', () => {});
    client.on('close', () => upstream.destroy());
    for (const chunk of initial) upstream.write(chunk);
    client.pipe(upstream);
    upstream.pipe(client);
  };
  const serveLoading = (client: Socket) => {
    let pending: Buffer = Buffer.alloc(0);
    const onData = (chunk: Buffer) => {
      pending = Buffer.concat([pending, chunk]);
      const { names, rest } = takeRespCommands(pending);
      pending = rest;
      for (const name of names) {
        if (name === 'CLIENT' || name === 'SELECT' || name === 'AUTH') client.write('+OK\r\n');
        else if (name === 'HELLO') client.write('-NOPROTO unsupported protocol version\r\n');
        // MULTI is allowed while loading; the queued commands are refused, so EXEC aborts.
        else if (name === 'MULTI') client.write('+OK\r\n');
        else if (name === 'EXEC') client.write('-EXECABORT Transaction discarded because of previous errors.\r\n');
        else if (name === 'DISCARD') client.write('+OK\r\n');
        else {
          loadingReplies += 1;
          client.write('-LOADING Redis is loading the dataset in memory\r\n');
        }
      }
    };
    client.on('data', onData);
    const entry = {
      attach: () => {
        client.off('data', onData);
        forward(client, pending.length ? [pending] : []);
      },
    };
    loadingClients.add(entry);
    client.on('close', () => loadingClients.delete(entry));
  };
  const server = createServer(client => {
    sockets.add(client);
    client.on('close', () => sockets.delete(client));
    client.on('error', () => {});
    if (Date.now() < loadingUntil) serveLoading(client);
    else forward(client);
  });
  const listening = new Promise<number>(resolve => {
    server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port));
  });
  return {
    listening,
    get loadingReplies() {
      return loadingReplies;
    },
    /** Kill every connection, then answer LOADING for `loadingMs`. Resolves when the window closes. */
    restart(loadingMs: number): Promise<void> {
      loadingUntil = Date.now() + loadingMs;
      for (const s of sockets) s.destroy();
      return new Promise<void>(resolve => {
        windowTimer = setTimeout(() => {
          loadingUntil = 0;
          for (const entry of [...loadingClients]) {
            loadingClients.delete(entry);
            entry.attach();
          }
          resolve();
        }, loadingMs);
      });
    },
    close() {
      if (windowTimer) clearTimeout(windowTimer);
      for (const s of sockets) s.destroy();
      return new Promise<void>(r => server.close(() => r()));
    },
  };
}

/**
 * TCP proxy that drops the connection carrying the first XADD. With
 * `before`, the XADD never reaches Redis; with `after`, Redis applies it and
 * the reply is lost. Every later connection forwards normally, unless
 * `closeListenerAfterDrop` is set: then the proxy stops accepting connections
 * once it drops, like a Redis that went away and stayed down.
 */
export function makeXaddDropProxy(
  target: { host: string; port: number },
  mode: 'before' | 'after',
  options: { closeListenerAfterDrop?: boolean } = {},
) {
  const sockets = new Set<Socket>();
  let dropped = false;
  const drop = () => {
    dropped = true;
    if (options.closeListenerAfterDrop) server.close();
  };
  const server = createServer(client => {
    sockets.add(client);
    client.on('close', () => sockets.delete(client));
    client.on('error', () => {});
    const upstream = connect(target.port, target.host);
    sockets.add(upstream);
    upstream.on('close', () => {
      sockets.delete(upstream);
      client.destroy();
    });
    upstream.on('error', () => {});
    client.on('close', () => upstream.destroy());
    let pending: Buffer = Buffer.alloc(0);
    let sawXadd = false;
    let inMulti = false;
    let replyLost = false;
    client.on('data', (chunk: Buffer) => {
      if (dropped) return void upstream.write(chunk);
      pending = Buffer.concat([pending, chunk]);
      const { names, rest } = takeRespCommands(pending);
      pending = rest;
      for (const name of names) {
        if (name === 'MULTI') inMulti = true;
        if (name === 'XADD') sawXadd = true;
      }
      if (sawXadd && mode === 'before') {
        drop();
        return void client.destroy();
      }
      upstream.write(chunk);
      // Publish wraps XADD in MULTI/EXEC when a TTL is set; wait for EXEC so
      // Redis applies the write, then hide its reply by dropping the client.
      if (sawXadd && (!inMulti || names.includes('EXEC'))) {
        drop();
        replyLost = true;
        setTimeout(() => client.destroy(), 200);
      }
    });
    upstream.on('data', (chunk: Buffer) => {
      if (!replyLost) client.write(chunk);
    });
  });
  const listening = new Promise<number>(resolve => {
    server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port));
  });
  return {
    listening,
    get dropped() {
      return dropped;
    },
    close() {
      for (const s of sockets) s.destroy();
      return new Promise<void>(r => server.close(() => r()));
    },
  };
}

/**
 * TCP proxy in front of a Redis node. While stalled it still accepts new
 * connections (so node-redis's TCP-level connectTimeout is satisfied) but never
 * forwards them, exactly like a frozen server. Connections made before the
 * stall keep forwarding. On resume, held connections start forwarding with the
 * client's queued writes intact, like a SIGCONTed server answering late.
 */
export function makeStallingProxy(target: { host: string; port: number }) {
  const sockets = new Set<Socket>();
  const held = new Set<Socket>();
  let stalled = false;
  const forward = (client: Socket) => {
    const upstream = connect(target.port, target.host);
    sockets.add(upstream);
    upstream.on('close', () => {
      sockets.delete(upstream);
      client.destroy();
    });
    upstream.on('error', () => {});
    client.on('close', () => upstream.destroy());
    client.pipe(upstream);
    upstream.pipe(client);
  };
  const server = createServer(client => {
    sockets.add(client);
    client.on('close', () => {
      sockets.delete(client);
      held.delete(client);
    });
    client.on('error', () => {});
    if (stalled) {
      held.add(client);
      return;
    }
    forward(client);
  });
  const listening = new Promise<number>(resolve => {
    server.listen(0, '127.0.0.1', () => resolve((server.address() as AddressInfo).port));
  });
  return {
    listening,
    stall: () => void (stalled = true),
    /**
     * Forward every held connection. `newestFirst` with `gapMs` answers them
     * in reverse arrival order, so an earlier connect settles after a later one.
     */
    async resume({ newestFirst = false, gapMs = 0 } = {}) {
      stalled = false;
      const pending = [...held];
      held.clear();
      if (newestFirst) pending.reverse();
      for (const [i, client] of pending.entries()) {
        if (i > 0 && gapMs) await new Promise(r => setTimeout(r, gapMs));
        forward(client);
      }
    },
    close() {
      for (const s of sockets) s.destroy();
      return new Promise<void>(r => server.close(() => r()));
    },
  };
}
