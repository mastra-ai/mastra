/**
 * Child-process peer helper for cross-process durable-agent tests.
 *
 * Why these tests cannot run in one process: a durable run's in-flight state
 * lives in module-level singletons (`globalRunRegistry`, the thread-stream
 * runtime, pubsub caches). Two `Mastra` instances in one process share that
 * state, so "abort / observe / recover from another process" passes even when
 * nothing crossed a process boundary. Each side therefore has to be a real OS
 * process with its own module graph. Pausing the original worker while a peer
 * recovers (SIGSTOP / SIGCONT) is also impossible inside one event loop.
 *
 * What it provides:
 * - `createXprocEnv()`: a short temp directory holding one `UnixSocketPubSub`
 *   socket path and one LibSQL file, shared by the test process and its peers.
 *   `env.pubsub()` is the test process's own client of that socket.
 * - `env.spawnPeer(fixture, args)`: forks a tsx fixture (see ./peer-runtime.ts)
 *   and returns a handle with `send`, `waitFor`, `result`, `exit`, `pause`
 *   (SIGSTOP), `resume` (SIGCONT) and `kill`.
 * - `env.cleanup()`: kills stragglers (resuming paused ones first), closes the
 *   test process's pubsub and removes the temp directory.
 * - Every failure message carries each process's config (role, pid, socket,
 *   db) and the peer's stderr, so a misconfigured peer is distinguishable from
 *   a real cross-process failure.
 *
 * Coordination is explicit: IPC signals and gate promises, never sleeps. Every
 * wait takes a bounded `timeoutMs` that only exists as a hang guard and fails
 * the test when it fires.
 *
 * Peers must flush before exit. `runPeer` (peer-runtime.ts) awaits the shared
 * pubsub's `flush()` before reporting a result and exiting; without it a
 * peer's last publish can die in flight and look like the receiver ignored it.
 */
import { execFile, fork } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { UnixSocketPubSub } from '@mastra/core/events';

import { DEFAULT_HANG_GUARD_MS, XPROC_PEER_ENV } from './peer-runtime';
import type { MainToPeer, PeerEnv, PeerToMain, SerializedError, XprocConfig } from './peer-runtime';

export { DEFAULT_HANG_GUARD_MS };
export type { XprocConfig };

export interface PeerExit {
  code: number | null;
  signal: NodeJS.Signals | null;
}

export interface PeerHandle {
  readonly config: XprocConfig;
  readonly pid: number;
  /** Send a named signal to the peer's `peer.waitFor(name)`. */
  send(name: string, data?: unknown): void;
  /** Wait for a named signal from the peer. Rejects if the peer exits first or the hang guard fires. */
  waitFor<T = unknown>(name: string, options?: { timeoutMs?: number }): Promise<T>;
  /** The value the fixture returned. Rejects with the peer's error, or if it exits without a result. */
  result<T = unknown>(options?: { timeoutMs?: number }): Promise<T>;
  /** Resolves when the peer process has exited. */
  exit(options?: { timeoutMs?: number }): Promise<PeerExit>;
  /** SIGSTOP the peer; resolves once the OS reports it stopped. */
  pause(): Promise<void>;
  /** SIGCONT the peer; resolves once the OS reports it running again. */
  resume(): Promise<void>;
  /** SIGKILL the peer (resuming it first if paused) and wait for it to exit. */
  kill(): Promise<PeerExit>;
  readonly stdout: string;
  readonly stderr: string;
}

export interface SpawnPeerOptions {
  role?: string;
}

export interface XprocEnv {
  readonly dir: string;
  readonly socketPath: string;
  readonly dbPath: string;
  /** `file:` URL for `LibSQLStore` / `LibSQLVector`. */
  readonly dbUrl: string;
  /** The test process's config, as recorded in failure messages. */
  readonly config: XprocConfig;
  /** The test process's client of the shared socket. Created on first use, closed by `cleanup()`. */
  pubsub(): UnixSocketPubSub;
  spawnPeer(fixture: string | URL, args?: unknown, options?: SpawnPeerOptions): Promise<PeerHandle>;
  /** Every process's config plus each peer's stderr, for failure messages. */
  describe(): string;
  cleanup(): Promise<void>;
}

function deserializeError(error: SerializedError, context: string): Error {
  const result = new Error(`${error.name}: ${error.message}\n${context}`);
  result.name = error.name;
  if (error.stack) result.stack = `${result.message}\n--- peer stack ---\n${error.stack}`;
  return result;
}

function withHangGuard<T>(promise: Promise<T>, timeoutMs: number, onTimeout: () => Error): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const guard = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(onTimeout()), timeoutMs);
  });
  return Promise.race([promise, guard]).finally(() => clearTimeout(timer));
}

const execFileAsync = promisify(execFile);

/** Whether the OS reports `pid` as job-control stopped (`ps` state `T`). */
async function isStopped(pid: number): Promise<boolean> {
  const { stdout } = await execFileAsync('ps', ['-o', 'stat=', '-p', String(pid)]);
  return stdout.trim().startsWith('T');
}

/**
 * Re-check the process state until it matches. Each round is a `ps` call, not
 * a sleep; the hang guard bounds the loop.
 */
async function waitForStopState(pid: number, stopped: boolean, timeoutMs: number, onTimeout: () => Error) {
  const deadline = Date.now() + timeoutMs;
  while ((await isStopped(pid)) !== stopped) {
    if (Date.now() > deadline) throw onTimeout();
  }
}

export async function createXprocEnv(): Promise<XprocEnv> {
  // Unix socket paths are capped at ~104 bytes on macOS; keep the prefix short.
  const dir = await mkdtemp(path.join(tmpdir(), 'xp-'));
  const socketPath = path.join(dir, 'events.sock');
  const dbPath = path.join(dir, 'shared.db');
  const config: XprocConfig = { role: 'main', pid: process.pid, dir, socketPath, dbPath };
  const peers: Array<{ handle: PeerHandle; child: ChildProcess }> = [];
  let pubsub: UnixSocketPubSub | undefined;
  const tsx = import.meta.resolve('tsx');

  const describe = () => {
    const lines = [`xproc-config ${JSON.stringify(config)}`];
    for (const { handle } of peers) {
      lines.push(`xproc-config ${JSON.stringify(handle.config)}`);
      if (handle.stderr.trim())
        lines.push(`--- ${handle.config.role} (pid ${handle.pid}) stderr ---\n${handle.stderr}`);
    }
    return lines.join('\n');
  };

  const spawnPeer = async (fixture: string | URL, args?: unknown, { role }: SpawnPeerOptions = {}) => {
    const fixturePath = fixture instanceof URL || fixture.startsWith('file:') ? fileURLToPath(fixture) : fixture;
    const peerRole = role ?? `peer-${peers.length + 1}`;
    const peerEnv: PeerEnv = { role: peerRole, dir, socketPath, dbPath, args };
    const child = fork(fixturePath, [], {
      execArgv: ['--import', tsx],
      env: { ...process.env, [XPROC_PEER_ENV]: JSON.stringify(peerEnv) },
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });
    if (child.pid === undefined) throw new Error(`spawnPeer: fork of ${fixturePath} produced no pid\n${describe()}`);
    const pid = child.pid;

    let stdout = '';
    let stderr = '';
    child.stdout?.on('data', chunk => (stdout += chunk));
    child.stderr?.on('data', chunk => (stderr += chunk));

    const exited = new Promise<PeerExit>(resolve => {
      // 'close' (not 'exit'): stdio and the IPC channel have drained, so every message the peer sent has arrived.
      child.once('close', (code, signal) => resolve({ code, signal }));
    });
    let exitInfo: PeerExit | undefined;
    void exited.then(info => (exitInfo = info));

    let peerConfig: XprocConfig = { role: peerRole, pid, dir, socketPath, dbPath };
    const inbox = new Map<string, unknown[]>();
    const waiters = new Map<string, Array<(data: unknown) => void>>();
    let resolveConfig!: () => void;
    const configReceived = new Promise<void>(resolve => (resolveConfig = resolve));
    let outcome: { kind: 'result'; value: unknown } | { kind: 'error'; error: SerializedError } | undefined;
    let resolveOutcome!: () => void;
    const outcomeReceived = new Promise<void>(resolve => (resolveOutcome = resolve));

    child.on('message', (message: PeerToMain) => {
      switch (message.kind) {
        case 'config':
          peerConfig = message.config;
          resolveConfig();
          return;
        case 'signal': {
          const next = waiters.get(message.name)?.shift();
          if (next) {
            next(message.data);
            return;
          }
          inbox.set(message.name, [...(inbox.get(message.name) ?? []), message.data]);
          return;
        }
        case 'result':
        case 'error':
          outcome = message;
          resolveOutcome();
          return;
      }
    });

    const label = () => `${peerConfig.role} (pid ${peerConfig.pid})`;
    const fail = (what: string) => new Error(`${what}\n${describe()}`);
    const exitedBefore = (what: string) =>
      exited.then(info => {
        throw fail(`${label()} exited (code ${info.code}, signal ${info.signal}) before ${what}`);
      });

    const handle: PeerHandle = {
      get config() {
        return peerConfig;
      },
      pid,
      get stdout() {
        return stdout;
      },
      get stderr() {
        return stderr;
      },
      send(name, data) {
        const message: MainToPeer = { kind: 'signal', name, data };
        child.send(message);
      },
      waitFor<T>(name: string, { timeoutMs = DEFAULT_HANG_GUARD_MS } = {}) {
        const queued = inbox.get(name);
        if (queued?.length) return Promise.resolve(queued.shift() as T);
        let deliver!: (data: unknown) => void;
        const received = new Promise<T>(resolve => (deliver = data => resolve(data as T)));
        waiters.set(name, [...(waiters.get(name) ?? []), deliver]);
        const withdraw = () => {
          const list = waiters.get(name);
          const index = list?.indexOf(deliver) ?? -1;
          if (index >= 0) list!.splice(index, 1);
        };
        return withHangGuard(Promise.race([received, exitedBefore(`sending signal "${name}"`)]), timeoutMs, () =>
          fail(`signal "${name}" from ${label()} not received within ${timeoutMs}ms (hang guard)`),
        ).finally(withdraw);
      },
      result<T>({ timeoutMs = DEFAULT_HANG_GUARD_MS } = {}) {
        return withHangGuard(Promise.race([outcomeReceived, exited]), timeoutMs, () =>
          fail(`${label()} did not report a result within ${timeoutMs}ms (hang guard)`),
        ).then(() => {
          if (outcome?.kind === 'result') return outcome.value as T;
          if (outcome?.kind === 'error') throw deserializeError(outcome.error, `reported by ${label()}\n${describe()}`);
          throw fail(
            `${label()} exited (code ${exitInfo?.code}, signal ${exitInfo?.signal}) without reporting a result`,
          );
        });
      },
      exit({ timeoutMs = DEFAULT_HANG_GUARD_MS } = {}) {
        return withHangGuard(exited, timeoutMs, () =>
          fail(`${label()} did not exit within ${timeoutMs}ms (hang guard)`),
        );
      },
      async pause() {
        child.kill('SIGSTOP');
        await waitForStopState(pid, true, DEFAULT_HANG_GUARD_MS, () =>
          fail(`${label()} not reported stopped after SIGSTOP (hang guard)`),
        );
      },
      async resume() {
        child.kill('SIGCONT');
        await waitForStopState(pid, false, DEFAULT_HANG_GUARD_MS, () =>
          fail(`${label()} still reported stopped after SIGCONT (hang guard)`),
        );
      },
      async kill() {
        if (exitInfo) return exitInfo;
        child.kill('SIGCONT');
        child.kill('SIGKILL');
        return exited;
      },
    };
    peers.push({ handle, child });

    await withHangGuard(
      Promise.race([configReceived, exitedBefore('reporting its config')]),
      DEFAULT_HANG_GUARD_MS,
      () => fail(`${label()} did not start within ${DEFAULT_HANG_GUARD_MS}ms (hang guard)`),
    );
    return handle;
  };

  return {
    dir,
    socketPath,
    dbPath,
    dbUrl: `file:${dbPath}`,
    config,
    pubsub: () => (pubsub ??= new UnixSocketPubSub(socketPath)),
    spawnPeer,
    describe,
    async cleanup() {
      await Promise.all(peers.map(({ handle }) => handle.kill()));
      await pubsub?.close();
      await rm(dir, { recursive: true, force: true });
    },
  };
}
