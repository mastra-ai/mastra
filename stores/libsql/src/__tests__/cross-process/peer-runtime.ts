/**
 * Peer-process side of the cross-process test helper. Import this from a
 * fixture that `spawnPeer` (./peer-helper.ts) forks; see that file for why
 * these tests need real child processes.
 *
 * A fixture is a module that calls `runPeer(async peer => { ... })`. Whatever
 * the callback returns is reported to the test as the peer's result. The
 * callback must not exit the process itself: `runPeer` flushes the shared
 * pubsub before it reports and exits, which is what keeps the peer's last
 * publish from dying in flight.
 */
import { UnixSocketPubSub } from '@mastra/core/events';

/** Where one process in a cross-process test lives. Included in every failure message. */
export interface XprocConfig {
  role: string;
  pid: number;
  dir: string;
  socketPath: string;
  dbPath: string;
}

export interface SerializedError {
  name: string;
  message: string;
  stack?: string;
}

export type PeerToMain =
  | { kind: 'config'; config: XprocConfig }
  | { kind: 'signal'; name: string; data: unknown }
  | { kind: 'result'; value: unknown }
  | { kind: 'error'; error: SerializedError };

export type MainToPeer = { kind: 'signal'; name: string; data: unknown };

export const XPROC_PEER_ENV = 'MASTRA_XPROC_PEER';

export interface PeerEnv {
  role: string;
  dir: string;
  socketPath: string;
  dbPath: string;
  args: unknown;
}

export const DEFAULT_HANG_GUARD_MS = 15_000;

export interface Peer<TArgs = unknown> {
  readonly config: XprocConfig;
  readonly args: TArgs;
  /** `file:` URL of the LibSQL database shared with the test process. */
  readonly dbUrl: string;
  /** This process's client of the shared socket. Created on first use. */
  pubsub(): UnixSocketPubSub;
  /** Send a named signal (with optional data) to the test process. */
  signal(name: string, data?: unknown): Promise<void>;
  /** Wait for a named signal from the test process. Rejects after `timeoutMs` (a hang guard). */
  waitFor<T = unknown>(name: string, options?: { timeoutMs?: number }): Promise<T>;
}

export function serializeError(error: unknown): SerializedError {
  if (error instanceof Error) return { name: error.name, message: error.message, stack: error.stack };
  return { name: 'NonError', message: String(error) };
}

function send(message: PeerToMain): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!process.send) {
      reject(new Error('peer-runtime: no IPC channel; this module must run under spawnPeer()'));
      return;
    }
    process.send(message, undefined, {}, error => (error ? reject(error) : resolve()));
  });
}

/**
 * Run a peer fixture. Reports `main`'s return value as the result, or its
 * error, after awaiting `flush()` on the shared pubsub, then exits (0 on
 * success, 1 on error).
 */
export function runPeer<TArgs = unknown>(main: (peer: Peer<TArgs>) => Promise<unknown>): void {
  const raw = process.env[XPROC_PEER_ENV];
  if (!raw) throw new Error(`peer-runtime: ${XPROC_PEER_ENV} is not set; run this fixture through spawnPeer()`);
  const env = JSON.parse(raw) as PeerEnv;
  const config: XprocConfig = {
    role: env.role,
    pid: process.pid,
    dir: env.dir,
    socketPath: env.socketPath,
    dbPath: env.dbPath,
  };

  const inbox = new Map<string, unknown[]>();
  const waiters = new Map<string, Array<(data: unknown) => void>>();
  process.on('message', (message: MainToPeer) => {
    if (message?.kind !== 'signal') return;
    const waiting = waiters.get(message.name);
    const next = waiting?.shift();
    if (next) {
      next(message.data);
      return;
    }
    const queued = inbox.get(message.name) ?? [];
    queued.push(message.data);
    inbox.set(message.name, queued);
  });
  // The test process went away: don't linger as an orphan holding the socket.
  process.on('disconnect', () => process.exit(2));

  let pubsub: UnixSocketPubSub | undefined;
  const peer: Peer<TArgs> = {
    config,
    args: env.args as TArgs,
    dbUrl: `file:${env.dbPath}`,
    pubsub: () => (pubsub ??= new UnixSocketPubSub(env.socketPath)),
    signal: (name, data) => send({ kind: 'signal', name, data }),
    waitFor: <T>(name: string, { timeoutMs = DEFAULT_HANG_GUARD_MS } = {}) =>
      new Promise<T>((resolve, reject) => {
        const queued = inbox.get(name);
        if (queued?.length) {
          resolve(queued.shift() as T);
          return;
        }
        const timer = setTimeout(() => {
          const list = waiters.get(name);
          list?.splice(list.indexOf(deliver), 1);
          reject(new Error(`peer ${config.role} (pid ${config.pid}): signal "${name}" not received in ${timeoutMs}ms`));
        }, timeoutMs);
        const deliver = (data: unknown) => {
          clearTimeout(timer);
          resolve(data as T);
        };
        waiters.set(name, [...(waiters.get(name) ?? []), deliver]);
      }),
  };

  const flushAndExit = async (message: PeerToMain, code: number) => {
    // Mandatory: without it the last publish frame can still be in this
    // process's write queue when it exits, and the receiver never sees it.
    await pubsub?.flush().catch(() => {});
    await send(message).catch(() => {});
    process.disconnect?.();
    process.exit(code);
  };

  void (async () => {
    await send({ kind: 'config', config });
    try {
      const value = await main(peer);
      await flushAndExit({ kind: 'result', value }, 0);
    } catch (error) {
      await flushAndExit({ kind: 'error', error: serializeError(error) }, 1);
    }
  })();
}
