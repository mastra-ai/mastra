/**
 * Peer-process side of the cross-process test helper. Import this from a
 * fixture that `spawnPeer` (./peer-helper.ts) forks; see that file for why
 * these tests need real child processes.
 *
 * A fixture is a module that calls `runPeer(async peer => { ... })`. Whatever
 * the callback returns is reported to the test as the peer's result. The
 * callback must not exit the process itself: `runPeer` reports the result (or
 * the error) and exits 0 or 1.
 *
 * Startup: `runPeer` publishes one ping on `XPROC_SELFCHECK_TOPIC`, which the
 * test process subscribed to before it forked anything. A peer that cannot
 * reach the shared transport therefore fails at `spawnPeer` with its config,
 * instead of showing up later as a test that waits for an event nobody delivers.
 *
 * Exit: it flushes the pubsub before it reports. That protects a *broker*'s
 * queued fan-out to its clients; it does not protect a client's own outbound
 * publish, which is never registered there (see the flush contract in
 * ./peer-helper.ts). A fixture that calls a fire-and-forget API must await its
 * publish or set its own delivery barrier — see fixtures/t79-peer.ts.
 *
 * A peer that declares `workers: true` but never boots them is failed on the
 * way out (`workerBootMismatch`): nothing in `Mastra` can tell the difference.
 */
import { UnixSocketPubSub } from '@mastra/core/events';

import { workerBootMismatch } from './process-workers';

/** Where one process in a cross-process test lives. Included in every failure message. */
export interface XprocConfig {
  role: string;
  pid: number;
  dir: string;
  socketPath: string;
  dbPath: string;
  /** Whether this process boots its event workers (`mastra.startWorkers()`). */
  workers: boolean;
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
  workers: boolean;
  args: unknown;
}

export const DEFAULT_HANG_GUARD_MS = 15_000;

/**
 * Topic the peer runtime pings on at startup. The test process subscribes to it
 * before it forks anything, so the ping doubles as a transport self-check (the
 * in-process equivalent of the harness's `xproc-selfcheck`): if the peer's first
 * publish cannot reach the test process, `spawnPeer` fails there and then.
 */
export const XPROC_SELFCHECK_TOPIC = 'xproc.selfcheck';

export interface Peer<TArgs = unknown> {
  readonly config: XprocConfig;
  readonly args: TArgs;
  /** `file:` URL of the LibSQL database shared with the test process. */
  readonly dbUrl: string;
  /** This process's worker setting. Pass to `bootWorkers` and `Mastra({ workers })`. */
  readonly workers: boolean;
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
    workers: env.workers,
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
    workers: env.workers,
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

  const exitWith = async (message: PeerToMain, code: number) => {
    await send(message).catch(error => {
      // The test process may already be gone. Keep the report reachable: the
      // parent captures this process's stderr.
      process.stderr.write(
        `peer-runtime: could not send ${message.kind} over IPC (${serializeError(error).message})\n${JSON.stringify(message)}\n`,
      );
    });
    process.disconnect?.();
    process.exit(code);
  };

  const flushAndExit = async (message: PeerToMain, code: number) => {
    // Mandatory: without it the last publish frame can still be in this
    // process's write queue when it exits, and the receiver never sees it.
    // Not best-effort: a failed flush means a frame may be lost, so it turns
    // into this peer's error outcome (and a nonzero exit) instead of a
    // silently dropped publish that shows up later as a mystery hang.
    try {
      await pubsub?.flush();
    } catch (error) {
      // When the fixture had already failed, keep that failure in the report:
      // the flush error is a consequence of exiting, not the root cause.
      const fixtureFailure = message.kind === 'error' ? `\nthe fixture had also failed: ${message.error.message}` : '';
      await exitWith(
        {
          kind: 'error',
          error: serializeError(
            new Error(
              `peer ${config.role} (pid ${config.pid}): flush() before exit failed, its last publish may not have reached the broker: ${serializeError(error).message}${fixtureFailure}`,
            ),
          ),
        },
        1,
      );
      return;
    }
    await exitWith(message, code);
  };

  /**
   * Transport self-check: one awaited publish on a topic the test process is
   * already listening to. Awaited rather than flushed — `flush()` on a client
   * awaits an empty write queue (see ./peer-helper.ts), so it would prove
   * nothing here.
   */
  const selfCheck = async () => {
    await peer.pubsub().publish(XPROC_SELFCHECK_TOPIC, {
      type: 'xproc-selfcheck',
      runId: `xproc-selfcheck-${config.pid}`,
      data: { pid: config.pid, role: config.role },
    });
  };

  void (async () => {
    await send({ kind: 'config', config });
    try {
      await selfCheck();
      const value = await main(peer);
      const mismatch = workerBootMismatch(config.workers);
      // Last thing before reporting: the fixture has had its chance to boot.
      if (mismatch) throw new Error(`peer ${config.role} (pid ${config.pid}): ${mismatch}`);
      await flushAndExit({ kind: 'result', value }, 0);
    } catch (error) {
      await flushAndExit({ kind: 'error', error: serializeError(error) }, 1);
    }
  })();
}
