import type { AgentControllerEvent } from '@mastra/core/agent-controller';
import type { MiddlewareHandler } from 'hono';

/** The slice of a live session the unloader reads: its id, its run, its parked tools, and its events. */
export interface UnloadableSession {
  readonly identity: { getId(): string };
  readonly run: { isRunning(): boolean };
  readonly stream: { isActive(): boolean };
  readonly suspensions: { hasPending(): boolean };
  subscribe(listener: (event: AgentControllerEvent) => void): () => void;
}

export interface UnloadableController {
  onSessionCreated(listener: (session: UnloadableSession) => void): () => void;
  onSessionDeleted(listener: (session: UnloadableSession) => void): () => void;
  deleteSession(input: { sessionId: string }): Promise<boolean>;
}

/**
 * Whether a session holds work only this process can finish: a run in flight, or a tool
 * parked on an answer. Both live in memory, so a session holding work must stay loaded.
 */
export function sessionHoldsWork(session: Pick<UnloadableSession, 'run' | 'suspensions'>): boolean {
  return session.suspensions.hasPending() || session.run.isRunning();
}

export interface IdleSessionUnloadOptions {
  /**
   * How long a session goes without activity before it is unloaded. Default: 30 minutes.
   * `0` turns the idle sweep off while still unloading sessions whose sandbox Factory stops.
   */
  idleMs?: number;
  /** How often idle sessions are looked for. Default: 1 minute. */
  sweepIntervalMs?: number;
}

export const DEFAULT_IDLE_SESSION_UNLOAD_MS = 30 * 60_000;
export const DEFAULT_IDLE_SESSION_SWEEP_INTERVAL_MS = 60_000;

export interface SessionUnloaderOptions extends IdleSessionUnloadOptions {
  controller: UnloadableController;
  /** Drops what Factory keeps for the session outside the controller: its workspaces and sandbox handle. */
  invalidateSession?: (sessionId: string) => Promise<void> | void;
  /** Resolves once writes Factory makes through the session after a run, such as its run-end audit, are done. */
  settle?: (session: UnloadableSession) => Promise<void>;
  now?: () => number;
  warn?: (message: string, details: Record<string, unknown>) => void;
}

interface TrackedSession {
  session: UnloadableSession;
  lastActiveAt: number;
  /** Open event streams (a browser tab following the session). */
  watchers: number;
  /** Its sandbox was released while it still held work: unload once it is idle. */
  unloadWhenIdle: boolean;
  unloading: boolean;
  unsubscribe: () => void;
}

export type SessionUnloadResult = 'unloaded' | 'deferred' | 'not-loaded';

/**
 * Unloads controller sessions this process no longer needs, so their in-memory state (display
 * state, workspace, bus) can be collected. The controller keeps every session it creates until
 * the host deletes it; unloading is that delete, which keeps the thread, its messages, the
 * session row and the sandbox VM. The next request, run or wake for the session creates it
 * again from storage, as after a restart.
 *
 * A session is never unloaded while it runs, holds a parked tool, or has an event stream open:
 * all three exist only in this process. Membership comes from the controller's notifications,
 * so a session this process never loaded (another replica's) is never touched.
 */
export class SessionUnloader {
  readonly #controller: UnloadableController;
  readonly #invalidateSession: (sessionId: string) => Promise<void> | void;
  readonly #settle: (session: UnloadableSession) => Promise<void>;
  readonly #idleMs: number;
  readonly #sweepIntervalMs: number;
  readonly #now: () => number;
  readonly #warn: NonNullable<SessionUnloaderOptions['warn']>;
  readonly #byId = new Map<string, TrackedSession>();
  /** Streams opened before the session finished loading, counted until it is tracked. */
  readonly #pendingWatchers = new Map<string, number>();
  readonly #unsubscribes: Array<() => void> = [];
  #timer: ReturnType<typeof setInterval> | undefined;
  #sweeping: Promise<number> | undefined;

  constructor(options: SessionUnloaderOptions) {
    this.#controller = options.controller;
    this.#invalidateSession = options.invalidateSession ?? (() => {});
    this.#settle = options.settle ?? (async () => {});
    this.#idleMs = options.idleMs ?? DEFAULT_IDLE_SESSION_UNLOAD_MS;
    this.#sweepIntervalMs = options.sweepIntervalMs ?? DEFAULT_IDLE_SESSION_SWEEP_INTERVAL_MS;
    this.#now = options.now ?? Date.now;
    this.#warn = options.warn ?? ((message, details) => console.warn(`[Mastra Factory] ${message}`, details));
    this.#unsubscribes.push(
      this.#controller.onSessionCreated(session => this.#track(session)),
      this.#controller.onSessionDeleted(session => this.#untrack(session)),
    );
  }

  #track(session: UnloadableSession): void {
    const id = session.identity.getId();
    this.#byId.get(id)?.unsubscribe();
    const tracked: TrackedSession = {
      session,
      lastActiveAt: this.#now(),
      watchers: this.#pendingWatchers.get(id) ?? 0,
      unloadWhenIdle: false,
      unloading: false,
      unsubscribe: () => {},
    };
    this.#pendingWatchers.delete(id);
    tracked.unsubscribe = session.subscribe(event => {
      tracked.lastActiveAt = this.#now();
      // A new run means someone is using the session again.
      if (event.type === 'agent_start') tracked.unloadWhenIdle = false;
    });
    this.#byId.set(id, tracked);
  }

  #untrack(session: UnloadableSession): void {
    const id = session.identity.getId();
    const tracked = this.#byId.get(id);
    if (tracked?.session !== session) return;
    tracked.unsubscribe();
    this.#byId.delete(id);
    // Streams still open on the deleted session follow whichever session takes its id next.
    if (tracked.watchers > 0) this.#pendingWatchers.set(id, tracked.watchers);
  }

  /** Start sweeping. With a non-positive `idleMs` the sweep only unloads released sessions. */
  start(): void {
    if (this.#timer) return;
    this.#timer = setInterval(() => void this.sweep(), this.#sweepIntervalMs);
    this.#timer.unref?.();
  }

  async stop(): Promise<void> {
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = undefined;
    for (const unsubscribe of this.#unsubscribes.splice(0)) unsubscribe();
    for (const tracked of this.#byId.values()) tracked.unsubscribe();
    this.#byId.clear();
    await this.#sweeping;
  }

  /** Whether the session is loaded in this process. */
  isLoaded(sessionId: string): boolean {
    return this.#byId.has(sessionId);
  }

  /** Mark activity that reaches the session without an event, such as a request addressing it. */
  touch(sessionId: string): void {
    const tracked = this.#byId.get(sessionId);
    if (tracked) tracked.lastActiveAt = this.#now();
  }

  /** Count an open event stream on the session; call the returned function when it closes. */
  watch(sessionId: string): () => void {
    const tracked = this.#byId.get(sessionId);
    if (tracked) tracked.watchers += 1;
    else this.#pendingWatchers.set(sessionId, (this.#pendingWatchers.get(sessionId) ?? 0) + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const current = this.#byId.get(sessionId);
      if (current && current.watchers > 0) {
        current.watchers -= 1;
        current.lastActiveAt = this.#now();
        return;
      }
      const pending = (this.#pendingWatchers.get(sessionId) ?? 0) - 1;
      if (pending > 0) this.#pendingWatchers.set(sessionId, pending);
      else this.#pendingWatchers.delete(sessionId);
    };
  }

  /**
   * Unload the session now its sandbox was stopped or released. A session still holding work, or
   * followed by an open stream, is unloaded on the first sweep after it goes idle instead, unless
   * it starts a new run first.
   */
  async unloadReleased(sessionId: string): Promise<SessionUnloadResult> {
    const tracked = this.#byId.get(sessionId);
    if (!tracked) return 'not-loaded';
    if (this.#inUse(tracked)) {
      tracked.unloadWhenIdle = true;
      return 'deferred';
    }
    return (await this.#unload(tracked, () => !this.#inUse(tracked))) ? 'unloaded' : 'deferred';
  }

  /** Unload every session idle past `idleMs`, and every released one now idle. Resolves how many were unloaded. */
  sweep(): Promise<number> {
    this.#sweeping ??= this.#sweep().finally(() => {
      this.#sweeping = undefined;
    });
    return this.#sweeping;
  }

  async #sweep(): Promise<number> {
    const now = this.#now();
    const due: Array<{ tracked: TrackedSession; idleSince: number }> = [];
    for (const tracked of this.#byId.values()) {
      if (tracked.unloading) continue;
      if (this.#inUse(tracked)) {
        // The idle clock starts once the work ends, not when the work started.
        tracked.lastActiveAt = now;
        continue;
      }
      const idleFor = now - tracked.lastActiveAt;
      if (tracked.unloadWhenIdle || (this.#idleMs > 0 && idleFor >= this.#idleMs)) {
        due.push({ tracked, idleSince: tracked.lastActiveAt });
      }
    }
    let unloaded = 0;
    for (const { tracked, idleSince } of due) {
      // Anything that touched the session since it was picked keeps it.
      const stillIdle = () => !this.#inUse(tracked) && tracked.lastActiveAt === idleSince;
      if (await this.#unload(tracked, stillIdle)) unloaded += 1;
    }
    return unloaded;
  }

  #inUse(tracked: TrackedSession): boolean {
    return tracked.watchers > 0 || tracked.session.stream.isActive() || sessionHoldsWork(tracked.session);
  }

  async #unload(tracked: TrackedSession, stillIdle: () => boolean): Promise<boolean> {
    const sessionId = tracked.session.identity.getId();
    if (tracked.unloading || this.#byId.get(sessionId) !== tracked || !stillIdle()) return false;
    tracked.unloading = true;
    try {
      // Deleting the session unbinds its thread, so writes still going through it would fail.
      await this.#settle(tracked.session);
      if (this.#byId.get(sessionId) !== tracked || !stillIdle()) return false;
      // Factory's caches go first: a request racing the unload then rebuilds them for the
      // session it gets, instead of having them dropped from under it.
      await this.#invalidateSession(sessionId);
      if (this.#byId.get(sessionId) !== tracked || !stillIdle()) return false;
      return await this.#controller.deleteSession({ sessionId });
    } catch (error) {
      this.#warn('Factory session unload failed', {
        sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    } finally {
      tracked.unloading = false;
    }
  }
}

const SESSION_PATH = /\/agent-controller\/[^/]+\/sessions\/([^/]+)/;
const SESSION_STREAM_PATH = /\/agent-controller\/[^/]+\/sessions\/[^/]+\/stream\/?$/;

function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/** The same body, calling `onClose` once when it ends, errors, or the reader cancels it. */
function closingWith(body: ReadableStream<Uint8Array>, onClose: () => void): ReadableStream<Uint8Array> {
  const reader = body.getReader();
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          onClose();
          controller.close();
          return;
        }
        controller.enqueue(value);
      } catch (error) {
        onClose();
        controller.error(error);
      }
    },
    async cancel(reason) {
      onClose();
      await reader.cancel(reason);
    },
  });
}

/**
 * Reports controller session requests to the unloader: every request addressing a session counts
 * as activity, and an open event stream keeps the session loaded until it closes.
 */
export function createSessionActivityMiddleware(unloader: () => SessionUnloader | undefined): MiddlewareHandler {
  return async (c, next) => {
    const sessions = unloader();
    const match = sessions ? SESSION_PATH.exec(c.req.path) : null;
    if (!sessions || !match) return next();
    const sessionId = decodeSegment(match[1]!);
    sessions.touch(sessionId);
    if (c.req.method !== 'GET' || !SESSION_STREAM_PATH.test(c.req.path)) return next();

    const release = sessions.watch(sessionId);
    c.req.raw.signal.addEventListener('abort', release, { once: true });
    try {
      await next();
    } catch (error) {
      release();
      throw error;
    }
    const body = c.res.body;
    if (!body || !c.res.ok) {
      release();
      return;
    }
    c.res = new Response(closingWith(body, release), c.res);
  };
}
