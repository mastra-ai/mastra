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
 *   (SIGSTOP), `resume` (SIGCONT, which accepts a peer that finished cleanly on
 *   the way up) and `kill`.
 * - `env.cleanup()`: kills stragglers (resuming paused ones first), closes the
 *   test process's pubsub and removes the temp directory.
 * - Every failure message carries each process's config (role, pid, socket,
 *   db, workers) and the peer's stderr, so a misconfigured peer is
 *   distinguishable from a real cross-process failure.
 * - A transport self-check on every spawn: the test process subscribes to a
 *   shared topic before it forks (which also makes it the broker of the
 *   socket), and each peer publishes one ping on it at startup. The ping is
 *   one-way — the peer sends, this process receives — so receiving it proves
 *   the peer reached *this* process's broker; that is why a peer which cannot
 *   reach the transport fails there instead of later as a mystery hang.
 *   `handle.selfCheck` records the receipt as observed inside the subscription
 *   callback, not as observed after the spawn wait.
 * - A per-process worker setting (`env.workers`, `peer.workers`): pass it to
 *   `bootWorkers` (see ./process-workers.ts) and to `Mastra({ workers })` so a
 *   test can run a producer with workers off next to a separate worker process.
 *   A peer that declares `workers: true` without booting them (or the reverse)
 *   is failed by the peer runtime, because nothing in `Mastra` can tell. That
 *   check is peer-side only: `env.workers` describes the test process, whose
 *   `Mastra` the helper does not build, so main's setting is never verified.
 *
 * Coordination is explicit: IPC signals and gate promises, never sleeps. Every
 * wait takes a bounded `timeoutMs` that only exists as a hang guard and fails
 * the test when it fires. Two budgets, both taken from the validation harness
 * so a ported cell waits as long as the case it was ported from:
 * `DEFAULT_HANG_GUARD_MS` (20s, the harness's `GUARD_MS`) for waiting on the
 * run under test, and `PEER_TIMEOUT_MS` (45s, the harness's `PEER_MS`) for
 * waiting on a peer process — startup, result, exit, pause/resume. The peer
 * handle defaults to the peer budget; callers override per wait.
 *
 * Peers must flush before exit. `runPeer` (peer-runtime.ts) awaits the shared
 * pubsub's `flush()` before reporting a result and exiting; without it a
 * peer's last publish can die in flight and look like the receiver ignored it.
 * A flush failure is not swallowed: it becomes the peer's error outcome and a
 * nonzero exit, and is written to the peer's stderr too, so a lost final frame
 * cannot pass as success.
 *
 * What `flush()` guarantees is narrower than "everything I published arrived":
 * it awaits the writes already queued on that instance (see
 * `UnixSocketPubSub.flush`), so it neither waits for an in-flight
 * fire-and-forget publish to enqueue its write nor reports individual write
 * failures. A fixture that calls a fire-and-forget API (for example
 * `agent.abortRunStream`) must therefore await the publish itself or establish
 * an explicit delivery barrier before returning — as fixtures/t79-peer.ts does
 * by waiting for its own abort request to echo back through the broker. It
 * also only flushes the instance from `peer.pubsub()`; a fixture that builds
 * its own `UnixSocketPubSub` bypasses this entirely.
 */
import { execFile, fork } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { UnixSocketPubSub } from '@mastra/core/events';

import { DEFAULT_HANG_GUARD_MS, PEER_TIMEOUT_MS, XPROC_PEER_ENV, XPROC_SELFCHECK_TOPIC } from './peer-runtime';
import type { MainToPeer, PeerEnv, PeerToMain, SerializedError, XprocConfig } from './peer-runtime';

export { DEFAULT_HANG_GUARD_MS, PEER_TIMEOUT_MS };
export { bootWorkers } from './process-workers';
export type { WorkerHost } from './process-workers';
export type { XprocConfig };

export interface PeerExit {
  code: number | null;
  signal: NodeJS.Signals | null;
}

/** What the startup self-check observed about this peer. */
export interface PeerSelfCheck {
  /** Milliseconds from `fork()` to the peer's ping arriving in the test process. */
  startupMs: number;
  /**
   * The broker's client count at the instant the ping arrived (>= 1: the peer
   * was connected then). Sampled in the subscription callback rather than after
   * the spawn wait: a fixture that returns immediately can have exited — and
   * been dropped from the broker's client list — by the time the caller resumes.
   */
  remoteClientCount: number;
}

export interface PeerHandle {
  readonly config: XprocConfig;
  readonly pid: number;
  /** This peer's worker setting. A peer with `workers: false` is a producer. */
  readonly workers: boolean;
  /** Result of the startup transport self-check, once the peer has reached the socket. */
  readonly selfCheck: PeerSelfCheck | undefined;
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
  /**
   * SIGKILL the peer (resuming it first if paused) and wait for it to exit.
   * The wait is bounded by `timeoutMs`: a descendant the fixture spawned can
   * hold this peer's stdio open after the peer itself is gone.
   */
  kill(options?: { timeoutMs?: number }): Promise<PeerExit>;
  readonly stdout: string;
  readonly stderr: string;
}

export interface SpawnPeerOptions {
  role?: string;
  /** Whether the peer boots its event workers. Defaults to the test process's setting. */
  workers?: boolean;
}

export interface XprocEnvOptions {
  /** Whether the test process boots its event workers. Defaults to `true`. */
  workers?: boolean;
}

export interface XprocEnv {
  readonly dir: string;
  readonly socketPath: string;
  readonly dbPath: string;
  /** `file:` URL for `LibSQLStore` / `LibSQLVector`. */
  readonly dbUrl: string;
  /** This test process's worker setting. Pass to `bootWorkers` and `Mastra({ workers })`. */
  readonly workers: boolean;
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

/** `promise` if it settles within `timeoutMs`, otherwise `undefined`. */
async function settledWithin<T>(promise: Promise<T>, timeoutMs: number): Promise<T | undefined> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<undefined>(resolve => {
        timer = setTimeout(() => resolve(undefined), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * How long a failed state check waits for the exit it implies. `ps` cannot see
 * a process that has just gone, and its exit event and final message are
 * already on their way, so this only covers that gap — it is a hang guard, not
 * a wait for something that might still happen.
 */
const PEER_EXIT_GRACE_MS = 5_000;

const execFileAsync = promisify(execFile);

/** Whether the OS reports `pid` as job-control stopped (`ps` state `T`). */
async function isStopped(pid: number): Promise<boolean> {
  const { stdout } = await execFileAsync('ps', ['-o', 'stat=', '-p', String(pid)]);
  return stdout.trim().startsWith('T');
}

/**
 * Re-check the process state until it matches. Each round is a `ps` call, not
 * a sleep; the hang guard bounds the loop.
 *
 * A `ps` that fails has no state to compare, so it is handed to the caller:
 * only the caller knows whether a process that is gone is the answer it wanted
 * (resuming a peer that finished on the way up) or a failure to report.
 */
async function waitForStopState(
  pid: number,
  stopped: boolean,
  timeoutMs: number,
  onTimeout: () => Error,
  onStateCheckError: (error: unknown) => Promise<void> | void,
) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    let actual: boolean;
    try {
      actual = await isStopped(pid);
    } catch (error) {
      await onStateCheckError(error);
      return;
    }
    if (actual === stopped) return;
    if (Date.now() > deadline) throw onTimeout();
  }
}

export async function createXprocEnv({ workers = true }: XprocEnvOptions = {}): Promise<XprocEnv> {
  // Unix socket paths are capped at ~104 bytes on macOS; keep the prefix short.
  const dir = await mkdtemp(path.join(tmpdir(), 'xp-'));
  const socketPath = path.join(dir, 'events.sock');
  if (socketPath.length > 100) {
    throw new Error(
      `createXprocEnv: socket path is ${socketPath.length} bytes, over the ~104 byte limit some platforms put on unix sockets: ${socketPath}`,
    );
  }
  const dbPath = path.join(dir, 'shared.db');
  const config: XprocConfig = { role: 'main', pid: process.pid, dir, socketPath, dbPath, workers };
  const peers: Array<{ handle: PeerHandle; child: ChildProcess; errors: string[] }> = [];
  let pubsub: UnixSocketPubSub | undefined;
  let tsx: string;
  try {
    // Peers are tsx fixtures: `--import` is the only reason tsx has to resolve
    // from this package, so fail with that reason instead of an ENOENT later.
    tsx = import.meta.resolve('tsx');
  } catch (error) {
    throw new Error(
      `createXprocEnv: cannot resolve "tsx" from ${import.meta.url} (${(error as Error).message}); keep it a devDependency of stores/libsql`,
    );
  }

  // Each entry resolves with the observation made inside the subscription
  // callback itself: the ping is received there, and by the time the caller of
  // `spawnPeer` resumes, a short-lived peer can already be gone.
  const selfChecks = new Map<number, (receipt: { at: number; remoteClientCount: number }) => void>();
  let selfCheckSubscription: Promise<void> | undefined;
  const getPubsub = () => (pubsub ??= new UnixSocketPubSub(socketPath));

  /**
   * Subscribe to the self-check topic and prove this process is the broker of
   * `socketPath`. Runs before the first fork: a peer spawned first would claim
   * the broker role, and pausing or killing it would take the shared transport
   * down for everyone. Whoever publishes or listens first becomes the broker,
   * so this also makes main the side every peer connects to.
   */
  const ensureSelfCheckSubscription = () => {
    selfCheckSubscription ??= (async () => {
      const client = getPubsub();
      await client.subscribe(XPROC_SELFCHECK_TOPIC, event => {
        const data = event.data as { pid?: number; role?: string } | undefined;
        if (data?.pid === undefined) return;
        selfChecks.get(data.pid)?.({ at: Date.now(), remoteClientCount: client.remoteClientCount });
      });
      if (!client.isBroker) {
        throw new Error(
          `the test process is not the broker of ${socketPath}: another process claimed it first, so pausing or killing that process takes the shared transport down\n${describe()}`,
        );
      }
    })();
    return selfCheckSubscription;
  };

  const describe = () => {
    const lines = [`xproc-config ${JSON.stringify(config)}`];
    for (const { handle, errors } of peers) {
      lines.push(`xproc-config ${JSON.stringify(handle.config)}`);
      const selfCheck = handle.selfCheck;
      if (selfCheck) {
        lines.push(
          `xproc-selfcheck role=${handle.config.role} pid=${handle.pid} startupMs=${selfCheck.startupMs} remoteClientCount=${selfCheck.remoteClientCount}`,
        );
      }
      for (const error of errors) lines.push(`--- ${handle.config.role} (pid ${handle.pid}) child error ---\n${error}`);
      if (handle.stderr.trim())
        lines.push(`--- ${handle.config.role} (pid ${handle.pid}) stderr ---\n${handle.stderr}`);
    }
    return lines.join('\n');
  };

  const spawnPeer = async (
    fixture: string | URL,
    args?: unknown,
    { role, workers: peerWorkers = workers }: SpawnPeerOptions = {},
  ) => {
    const fixturePath = fixture instanceof URL || fixture.startsWith('file:') ? fileURLToPath(fixture) : fixture;
    const peerRole = role ?? `peer-${peers.length + 1}`;
    const peerEnv: PeerEnv = { role: peerRole, dir, socketPath, dbPath, workers: peerWorkers, args };
    // Before the fork: main listens first, so it is the broker this peer connects to.
    await ensureSelfCheckSubscription();
    const forkedAt = Date.now();
    const child = fork(fixturePath, [], {
      execArgv: ['--import', tsx],
      env: { ...process.env, [XPROC_PEER_ENV]: JSON.stringify(peerEnv) },
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });
    if (child.pid === undefined) throw new Error(`spawnPeer: fork of ${fixturePath} produced no pid\n${describe()}`);
    const pid = child.pid;
    const selfCheckReceived = new Promise<{ at: number; remoteClientCount: number }>(resolve =>
      selfChecks.set(pid, resolve),
    );
    let selfCheck: PeerSelfCheck | undefined;

    let stdout = '';
    let stderr = '';
    const errors: string[] = [];
    child.stdout?.on('data', chunk => (stdout += chunk));
    child.stderr?.on('data', chunk => (stderr += chunk));
    // A forked child can fail asynchronously (spawn failure, killed while a
    // message is in flight). Keep it for failure messages instead of letting
    // it surface as an unhandled 'error' event.
    child.on('error', error => errors.push(error.stack ?? error.message));

    const exited = new Promise<PeerExit>(resolve => {
      // 'close' (not 'exit'): stdio and the IPC channel have drained, so every message the peer sent has arrived.
      child.once('close', (code, signal) => resolve({ code, signal }));
    });
    let exitInfo: PeerExit | undefined;
    void exited.then(info => (exitInfo = info));

    let peerConfig: XprocConfig = { role: peerRole, pid, dir, socketPath, dbPath, workers: peerWorkers };
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
    const unreadableState = (signal: 'SIGSTOP' | 'SIGCONT', error: unknown) =>
      `${label()} could not read process state after ${signal}: ${error instanceof Error ? error.message : String(error)}`;
    const exitedBefore = (what: string) =>
      exited.then(info => {
        throw fail(`${label()} exited (code ${info.code}, signal ${info.signal}) before ${what}`);
      });

    const handle: PeerHandle = {
      get config() {
        return peerConfig;
      },
      pid,
      get workers() {
        return peerConfig.workers;
      },
      get selfCheck() {
        return selfCheck;
      },
      get stdout() {
        return stdout;
      },
      get stderr() {
        return stderr;
      },
      send(name, data) {
        const message: MainToPeer = { kind: 'signal', name, data };
        // A send racing peer termination reports an error rather than throwing
        // here; keep it so the next failure message explains itself.
        child.send(message, error => {
          if (error) errors.push(`send("${name}") failed: ${error.message}`);
        });
      },
      waitFor<T>(name: string, { timeoutMs = PEER_TIMEOUT_MS } = {}) {
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
      result<T>({ timeoutMs = PEER_TIMEOUT_MS } = {}) {
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
      exit({ timeoutMs = PEER_TIMEOUT_MS } = {}) {
        return withHangGuard(exited, timeoutMs, () =>
          fail(`${label()} did not exit within ${timeoutMs}ms (hang guard)`),
        );
      },
      async pause() {
        child.kill('SIGSTOP');
        await waitForStopState(
          pid,
          true,
          PEER_TIMEOUT_MS,
          () => fail(`${label()} not reported stopped after SIGSTOP (hang guard)`),
          error => {
            throw fail(unreadableState('SIGSTOP', error));
          },
        );
      },
      async resume() {
        child.kill('SIGCONT');
        await waitForStopState(
          pid,
          false,
          PEER_TIMEOUT_MS,
          () => fail(`${label()} still reported stopped after SIGCONT (hang guard)`),
          async error => {
            // `ps` has nothing to report once the peer is gone, and a peer with
            // work already waiting can finish, report its result and exit before
            // the first state check — the `heard` fixture in the self-tests does
            // exactly that. That is a resume that worked, so accept it when the
            // peer also closed cleanly *and* reported a result. Any other exit,
            // a peer that never reports, and a state check that cannot be read at
            // all (no `ps`, no permission) all stay failures.
            const info = exitInfo ?? (await settledWithin(exited, PEER_EXIT_GRACE_MS));
            if (info?.code === 0 && info.signal === null) {
              if (!outcome) await settledWithin(outcomeReceived, PEER_EXIT_GRACE_MS);
              if (outcome?.kind === 'result') return;
            }
            throw fail(
              `${unreadableState('SIGCONT', error)}; ${
                info ? `peer exited (code ${info.code}, signal ${info.signal})` : 'peer did not exit'
              }${
                outcome
                  ? ` and reported ${outcome.kind === 'result' ? 'a result' : `an error (${outcome.error.name})`}`
                  : ' and reported nothing'
              }`,
            );
          },
        );
      },
      async kill({ timeoutMs = PEER_TIMEOUT_MS } = {}) {
        if (exitInfo) return exitInfo;
        child.kill('SIGCONT');
        child.kill('SIGKILL');
        // Bounded: 'close' waits for the peer's stdio to drain, so a descendant
        // the fixture spawned while holding this pipe open would otherwise leave
        // `cleanup()` waiting on a process that is already gone.
        return withHangGuard(exited, timeoutMs, () =>
          fail(`${label()} was killed but its stdio did not close within ${timeoutMs}ms (hang guard)`),
        );
      },
    };
    peers.push({ handle, child, errors });

    // Prove the peer reached the shared transport: a peer whose first publish
    // never arrives (wrong socket path, a second broker) would otherwise
    // surface later as a mystery hang in whatever the test happened to wait
    // for. The ping is one-way — the peer sends, this process receives — so
    // receiving it proves the peer's socket is bound to this process's broker.
    // It does not mean the fixture waited for this acknowledgment: the child
    // starts work as soon as its own config send is queued.
    let receipt: { at: number; remoteClientCount: number };
    try {
      await withHangGuard(Promise.race([configReceived, exitedBefore('reporting its config')]), PEER_TIMEOUT_MS, () =>
        fail(`${label()} did not start within ${PEER_TIMEOUT_MS}ms (hang guard)`),
      );
      receipt = await withHangGuard(
        Promise.race([selfCheckReceived, exitedBefore('reaching the shared transport')]),
        PEER_TIMEOUT_MS,
        () =>
          fail(
            `${label()} did not reach the shared transport within ${PEER_TIMEOUT_MS}ms (hang guard): its first publish never arrived here. Check the socket path and that the test process is the broker`,
          ),
      );
    } finally {
      selfChecks.delete(pid);
    }
    if (receipt.remoteClientCount < 1) {
      throw fail(
        `${label()} reported reaching the transport but this process's broker did not count it as a client when its ping arrived (remoteClientCount ${receipt.remoteClientCount})`,
      );
    }
    selfCheck = { startupMs: receipt.at - forkedAt, remoteClientCount: receipt.remoteClientCount };
    return handle;
  };

  return {
    dir,
    socketPath,
    dbPath,
    dbUrl: `file:${dbPath}`,
    config,
    workers,
    pubsub: getPubsub,
    spawnPeer,
    describe,
    async cleanup() {
      // A peer that will not settle must not keep the socket and the temp dir
      // alive: collect the failures, tear the environment down either way, then
      // report them.
      const killFailures = await Promise.all(
        peers.map(({ handle }) =>
          handle.kill().catch((error: unknown) => `${handle.config.role} (pid ${handle.pid}): ${String(error)}`),
        ),
      ).then(results => results.filter((result): result is string => typeof result === 'string'));
      await pubsub?.close();
      await rm(dir, { recursive: true, force: true });
      if (killFailures.length) throw new Error(`cleanup: peers did not all exit\n${killFailures.join('\n')}`);
    },
  };
}
