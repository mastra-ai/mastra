import type { IMastraLogger } from '@mastra/core/logger';
import type { Mastra } from '@mastra/core/mastra';
import { MastraWorker } from '@mastra/core/worker';
import type { WorkerStopOptions } from '@mastra/core/worker';

import { ConnectClient } from './connect-client.js';
import { MastraConnectError } from './errors.js';
import type { ConnectEventFilter, FilteredConnectEvent } from './event-filter.js';
import { ConnectEvents } from './events.js';
import type {
  ConnectEvent,
  ConnectEventProvider,
  ConnectEventsOptions,
  ConnectEventType,
  EventCursor,
  EventCursorStore,
} from './events.js';

/** What a handler gets for each event. */
export interface ConnectEventHandlerContext<E> {
  /** The event. */
  event: E;
  /** The Mastra the worker runs on, to start workflows or call agents. */
  mastra: Mastra;
  /** Mastra's logger. */
  logger: IMastraLogger;
  /**
   * A client for the project's connections, built from the worker's options.
   * When the event's connection belongs to an end user, it's scoped to the
   * event's `resourceId`, so it acts as that user.
   */
  connect: ConnectClient;
}

/** Handles one event. A handler that throws is retried, then logged and skipped. */
export type ConnectEventHandler<E> = (context: ConnectEventHandlerContext<E>) => void | Promise<void>;

type HandlerFor<F extends ConnectEventFilter, U extends boolean> = ConnectEventHandler<FilteredConnectEvent<F, U>>;

/**
 * One provider's handlers: a function for every event of the provider, or an
 * object with a function per event type. A provider with typed payloads only
 * gets the event types Connect has types for, and only listed event types can
 * be keys.
 */
export type ConnectEventProviderHandlers<P extends string, U extends boolean = false> = P extends ConnectEventProvider
  ? HandlerFor<{ [K in P]: true }, U> | { [E in ConnectEventType<P>]?: HandlerFor<{ [K in P]: readonly [E] }, U> }
  : HandlerFor<{ [K in P]: true }, U> | { [eventType: string]: HandlerFor<{ [K in P]: true }, U> };

/** Handlers keyed by provider, such as `github` or `linear`. */
export type ConnectEventHandlers<H = Record<string, unknown>, U extends boolean = false> = {
  [P in keyof H & string]: ConnectEventProviderHandlers<P, U>;
};

/** How a failing handler is retried. */
export interface ConnectEventRetry {
  /** Times a handler is called for one event before it's logged and skipped. Defaults to 3. */
  attempts?: number;
  /** Delay before the first retry, in milliseconds, doubling for each one after. Defaults to 1000. */
  delayMs?: number;
}

export interface ConnectEventWorkerOptions<U extends boolean = false> extends Omit<
  ConnectEventsOptions<undefined, U>,
  'events' | 'signal'
> {
  /** Per-request timeout for `connect`, in milliseconds. Defaults to 15000. */
  timeoutMs?: number;
  /** How a failing handler is retried. */
  retry?: ConnectEventRetry;
}

type AnyHandler = ConnectEventHandler<ConnectEvent>;

/** Events read ahead of their handlers, across all connections, before the worker waits for one to finish. */
const MAX_PENDING_EVENTS = 100;
const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 1_000;
const DEFAULT_RESUBSCRIBE_DELAY_MS = 1_000;
const DEFAULT_MAX_RESUBSCRIBE_DELAY_MS = 30_000;

/**
 * Runs handlers concurrently across connections and in order within one. The
 * subscription saves an event when the next one is read, which here can be
 * before earlier events are handled, so each save is held back until every
 * event read before it has been handled. A restart then never skips an event
 * that was still being handled.
 *
 * @internal Exported for tests.
 */
export class Dispatcher {
  readonly #store: EventCursorStore;
  readonly #logger: IMastraLogger;
  /** The last handler queued for each connection. */
  readonly #tails = new Map<string, Promise<void>>();
  /** Read order of the events not handled yet. */
  readonly #pending = new Set<number>();
  #read = 0;
  /**
   * Saves waiting on events read before them, oldest first. Each one but the
   * last has an unhandled event read between it and the next, so there are at
   * most one more than the pending events.
   */
  #saves: Array<{ cursor: EventCursor; read: number }> = [];
  #saving: Promise<void> = Promise.resolve();
  #waiters: Array<() => void> = [];

  constructor(store: EventCursorStore, logger: IMastraLogger) {
    this.#store = store;
    this.#logger = logger;
  }

  /** The store to give the subscription. */
  get cursorStore(): EventCursorStore {
    const store = this.#store;
    return {
      load: () => store.load(),
      save: cursor => {
        this.#saves.push({ cursor, read: this.#read });
        this.#flush();
      },
    };
  }

  /** How many saves are held back. */
  get heldSaves(): number {
    return this.#saves.length;
  }

  /** Whether an event read in `[from, to)` is still being handled. */
  #pendingIn(from: number, to: number): boolean {
    for (const pending of this.#pending) if (pending >= from && pending < to) return true;
    return false;
  }

  /**
   * Queues `handle` behind the connection's earlier events. Waits while too
   * many events are pending. When `handle` resolves `false`, the event stays
   * unhandled, so the cursor is never saved past it.
   */
  async dispatch(connectionId: string, handle: () => Promise<boolean | void>): Promise<void> {
    while (this.#pending.size >= MAX_PENDING_EVENTS) {
      await new Promise<void>(resolve => this.#waiters.push(resolve));
    }
    const order = this.#read++;
    this.#pending.add(order);
    const done: Promise<void> = (this.#tails.get(connectionId) ?? Promise.resolve()).then(handle).then(handled => {
      if (handled !== false) this.#pending.delete(order);
      if (this.#tails.get(connectionId) === done) this.#tails.delete(connectionId);
      for (const wake of this.#waiters.splice(0)) wake();
      this.#flush();
    });
    this.#tails.set(connectionId, done);
  }

  /** Waits for every queued handler, then for the cursor saves they released. */
  async drain(): Promise<void> {
    while (this.#tails.size > 0) await Promise.all(this.#tails.values());
    await this.#saving;
  }

  /** Writes the newest save whose earlier events have all been handled, and drops the saves it covers. */
  #flush(): void {
    const store = this.#store;
    const unhandled = this.#pending.size > 0 ? Math.min(...this.#pending) : this.#read;
    let ready = -1;
    while (ready + 1 < this.#saves.length && this.#saves[ready + 1]!.read <= unhandled) ready++;
    if (ready >= 0) {
      const { cursor } = this.#saves[ready]!;
      this.#saves = this.#saves.slice(ready + 1);
      this.#saving = this.#saving
        .then(() => store.save(cursor))
        .catch(error => this.#logger.error('Connect event worker could not save its cursor', { error }));
    }
    // A held save is covered by the next one when no unhandled event was read between them: both become safe together.
    this.#saves = this.#saves.filter(
      (save, i, saves) => i === saves.length - 1 || this.#pendingIn(save.read, saves[i + 1]!.read),
    );
  }
}

/**
 * Handles provider events on a project's Connect connections. Pass it to
 * `new Mastra({ workers: [...] })`; it subscribes when Mastra starts its
 * workers, and only to the providers and event types it has handlers for.
 *
 * Events from different connections are handled concurrently, and one
 * connection's events one at a time, in order. Delivery is at least once:
 * the cursor moves past an event once it and every event before it have been
 * handled, so a handler can see an event again after a restart. A failing
 * handler is retried (`retry`), then logged and skipped. When the
 * subscription ends, for example because the events service refused the
 * token, the worker logs it and subscribes again, backing off, from the last
 * event it handled.
 *
 * The cursor is kept in memory, so each process reads every event and a
 * restarted one starts at the newest. Give `cursorStore` to resume across
 * restarts; a store is one process's cursor, so don't share one between
 * processes.
 *
 * @example
 * ```ts
 * const connectEvents = new ConnectEventWorker({
 *   linear: {
 *     'Issue.create': async ({ event, mastra }) => {
 *       // A run id from the delivery id, so a redelivered webhook doesn't start a second run.
 *       const run = await mastra.getWorkflow('triageIssue').createRun({
 *         runId: `linear:${event.sourceEventId ?? event.id}`,
 *         resourceId: event.resourceId,
 *       });
 *       if (run.workflowRunStatus === 'pending') {
 *         await run.startAsync({ inputData: { issueId: event.payload.data.id } });
 *       }
 *     },
 *   },
 * });
 *
 * export const mastra = new Mastra({ workflows: { triageIssue }, workers: [connectEvents] });
 * ```
 */
export class ConnectEventWorker<const H = Record<string, unknown>, U extends boolean = false> extends MastraWorker {
  readonly name = 'connect-events';

  readonly #handlers: Record<string, AnyHandler | Record<string, AnyHandler>>;
  readonly #options: ConnectEventWorkerOptions<U>;
  /** The last event that it and every event before it were handled, kept across subscriptions. */
  #cursor?: EventCursor;
  /** Set once the service rejected the stored cursor: start at the newest event instead of loading it again. */
  #atTail = false;
  #abort?: AbortController;
  #delivery?: Promise<void>;

  constructor(handlers: ConnectEventHandlers<H, U>, options: ConnectEventWorkerOptions<U> = {}) {
    super();
    const { attempts, delayMs } = options.retry ?? {};
    if (attempts !== undefined && !(Number.isInteger(attempts) && attempts >= 1)) {
      throw new MastraConnectError('invalid_options', 'retry.attempts must be a whole number of 1 or more.');
    }
    if (delayMs !== undefined && !(Number.isFinite(delayMs) && delayMs >= 0)) {
      throw new MastraConnectError('invalid_options', 'retry.delayMs must be a finite number of 0 or more.');
    }
    this.#handlers = handlers as Record<string, AnyHandler | Record<string, AnyHandler>>;
    this.#options = options;
  }

  get isRunning(): boolean {
    return this.#abort !== undefined;
  }

  /** Subscribes to the project's Connect events. Called when Mastra starts its workers. */
  async start(): Promise<void> {
    if (this.#abort) return;
    const mastra = this.mastra;
    if (!mastra) {
      console.error('Connect event worker is not registered on a Mastra, so it is not listening');
      return;
    }
    const events = this.#filter();
    if (Object.keys(events).length === 0) return;

    const logger = mastra.getLogger();
    let connect: ConnectClient;
    try {
      connect = new ConnectClient(this.#options);
      // Checks the options up front, so a missing token is logged once rather than retried.
      new ConnectEvents<ConnectEventFilter, boolean>({ ...this.#options, events }).close();
    } catch (error) {
      logger.error('Connect event worker could not subscribe', { error });
      return;
    }
    const abort = new AbortController();
    this.#abort = abort;
    this.#delivery = this.#run(events, { mastra, logger, connect }, abort.signal);
  }

  /** Ends the subscription and waits for the events being handled, up to `drainTimeout` ms. */
  async stop(options?: WorkerStopOptions): Promise<void> {
    const abort = this.#abort;
    const delivery = this.#delivery;
    this.#abort = undefined;
    this.#delivery = undefined;
    abort?.abort();
    if (!delivery) return;
    if (options?.drainTimeout === undefined) return delivery;
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([delivery, new Promise<void>(resolve => (timer = setTimeout(resolve, options.drainTimeout)))]);
    clearTimeout(timer);
  }

  /** The events the handlers ask for: every event of a provider with a function, or the listed event types. */
  #filter(): ConnectEventFilter {
    const filter: Record<string, true | string[]> = {};
    for (const [provider, handlers] of Object.entries(this.#handlers)) {
      if (typeof handlers === 'function') filter[provider] = true;
      else if (handlers) filter[provider] = Object.keys(handlers).filter(type => typeof handlers[type] === 'function');
    }
    return filter as ConnectEventFilter;
  }

  #handler(event: ConnectEvent): AnyHandler | undefined {
    // The subscription only delivers events a handler asked for.
    const handlers = this.#handlers[event.provider];
    return typeof handlers === 'function' ? handlers : handlers?.[event.eventType];
  }

  /**
   * Calls the event's handler, retrying it. Resolves `false` when the worker
   * stopped before the handler succeeded, so the event stays unhandled.
   */
  async #handle(
    event: ConnectEvent,
    context: Omit<ConnectEventHandlerContext<ConnectEvent>, 'event'>,
    signal: AbortSignal,
  ): Promise<boolean> {
    const handler = this.#handler(event);
    if (!handler) return true;
    const connect = event.resourceId ? context.connect.withResource(event.resourceId) : context.connect;
    const attempts = this.#options.retry?.attempts ?? DEFAULT_RETRY_ATTEMPTS;
    const delayMs = this.#options.retry?.delayMs ?? DEFAULT_RETRY_DELAY_MS;
    const about = { eventId: event.id, provider: event.provider, eventType: event.eventType };
    for (let attempt = 1; ; attempt++) {
      try {
        await handler({ ...context, connect, event });
        return true;
      } catch (error) {
        // One failing event must not end the subscription.
        if (attempt >= attempts) {
          context.logger.error('Connect event handler failed; skipping the event', { error, ...about, attempt });
          return true;
        }
        context.logger.warn('Connect event handler failed; retrying', { error, ...about, attempt });
        await sleep(delayMs * 2 ** (attempt - 1), signal);
        if (signal.aborted) return false;
      }
    }
  }

  /** Subscribes, and subscribes again whenever the subscription ends, until the worker stops. */
  async #run(
    events: ConnectEventFilter,
    context: Omit<ConnectEventHandlerContext<ConnectEvent>, 'event'>,
    signal: AbortSignal,
  ): Promise<void> {
    const { logger } = context;
    const base = this.#options.reconnectDelayMs ?? DEFAULT_RESUBSCRIBE_DELAY_MS;
    const max = this.#options.maxReconnectDelayMs ?? DEFAULT_MAX_RESUBSCRIBE_DELAY_MS;
    let failures = 0;
    while (!signal.aborted) {
      const dispatcher = new Dispatcher(this.#cursorStore(), logger);
      let read = false;
      try {
        // `after` and `afterTimestamp` only place the first subscription; later ones resume from the cursor.
        const resume = this.#cursor || this.#atTail ? { after: undefined, afterTimestamp: undefined } : {};
        const subscription = new ConnectEvents<ConnectEventFilter, boolean>({
          ...this.#options,
          ...resume,
          cursorStore: dispatcher.cursorStore,
          events,
          signal,
        });
        for await (const event of subscription as AsyncIterable<ConnectEvent>) {
          read = true;
          await dispatcher.dispatch(event.connectionId, () => this.#handle(event, context, signal));
        }
      } catch (error) {
        if (!signal.aborted) {
          if (error instanceof MastraConnectError && error.code === 'invalid_cursor') {
            // Nothing to resume from: start at the newest event. Events since the rejected cursor are missed.
            this.#cursor = undefined;
            this.#atTail = true;
          }
          if (read) failures = 0;
          const retryInMs = Math.min(max, base * 2 ** Math.min(failures++, 20));
          logger.error('Connect event worker subscription ended; subscribing again', { error, retryInMs });
          await dispatcher.drain();
          await sleep(retryInMs, signal);
          continue;
        }
      } finally {
        await dispatcher.drain();
      }
    }
  }

  /** The cursor kept in memory, backed by `cursorStore` when given. */
  #cursorStore(): EventCursorStore {
    const store = this.#options.cursorStore;
    return {
      load: async () => {
        if (this.#cursor) return this.#cursor;
        if (this.#atTail || !store) return null;
        return store.load();
      },
      save: async cursor => {
        this.#cursor = cursor;
        this.#atTail = false;
        await store?.save(cursor);
      },
    };
  }
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise(resolve => {
    if (signal.aborted) return resolve();
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal.removeEventListener('abort', done);
      resolve();
    }
    signal.addEventListener('abort', done, { once: true });
  });
}
