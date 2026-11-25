import type { IMastraLogger } from '@mastra/core/logger';
import type { Mastra } from '@mastra/core/mastra';
import { MastraWorker } from '@mastra/core/worker';
import type { WorkerStopOptions } from '@mastra/core/worker';

import { ConnectClient } from './connect-client.js';
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

/** Handles one event. Throwing logs the error, and the worker moves on to the next event. */
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

export interface ConnectEventWorkerOptions<U extends boolean = false> extends Omit<
  ConnectEventsOptions<undefined, U>,
  'events'
> {
  /** Per-request timeout for `connect`, in milliseconds. Defaults to 15000. */
  timeoutMs?: number;
}

type AnyHandler = ConnectEventHandler<ConnectEvent>;

/** Events read ahead of their handlers, across all connections, before the worker waits for one to finish. */
const MAX_PENDING_EVENTS = 100;

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
  readonly #store: EventCursorStore | undefined;
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

  constructor(store: EventCursorStore | undefined, logger: IMastraLogger) {
    this.#store = store;
    this.#logger = logger;
  }

  /** The store to give the subscription. */
  get cursorStore(): EventCursorStore | undefined {
    const store = this.#store;
    if (!store) return undefined;
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

  /** Queues `handle` behind the connection's earlier events. Waits while too many events are pending. */
  async dispatch(connectionId: string, handle: () => Promise<void>): Promise<void> {
    while (this.#pending.size >= MAX_PENDING_EVENTS) {
      await new Promise<void>(resolve => this.#waiters.push(resolve));
    }
    const order = this.#read++;
    this.#pending.add(order);
    const done: Promise<void> = (this.#tails.get(connectionId) ?? Promise.resolve()).then(handle).finally(() => {
      this.#pending.delete(order);
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
    if (!store) return;
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
 * handled, so a handler can see an event again after a restart. Run the
 * worker in one process.
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
  #events?: ConnectEvents<ConnectEventFilter, boolean>;
  #delivery?: Promise<void>;

  constructor(handlers: ConnectEventHandlers<H, U>, options: ConnectEventWorkerOptions<U> = {}) {
    super();
    this.#handlers = handlers as Record<string, AnyHandler | Record<string, AnyHandler>>;
    this.#options = options;
  }

  get isRunning(): boolean {
    return this.#events !== undefined;
  }

  /** Subscribes to the project's Connect events. Called when Mastra starts its workers. */
  async start(): Promise<void> {
    if (this.#events) return;
    const mastra = this.mastra;
    if (!mastra) {
      console.error('Connect event worker is not registered on a Mastra, so it is not listening');
      return;
    }
    const events = this.#filter();
    if (Object.keys(events).length === 0) return;

    const logger = mastra.getLogger();
    const dispatcher = new Dispatcher(this.#options.cursorStore, logger);
    let subscription: ConnectEvents<ConnectEventFilter, boolean>;
    let connect: ConnectClient;
    try {
      connect = new ConnectClient(this.#options);
      subscription = new ConnectEvents<ConnectEventFilter, boolean>({
        ...this.#options,
        cursorStore: dispatcher.cursorStore,
        events,
      });
    } catch (error) {
      logger.error('Connect event worker could not subscribe', { error });
      return;
    }
    this.#events = subscription;
    this.#delivery = this.#deliver(subscription, dispatcher, { mastra, logger, connect });
  }

  /** Ends the subscription and waits for the events being handled, up to `drainTimeout` ms. */
  async stop(options?: WorkerStopOptions): Promise<void> {
    const events = this.#events;
    const delivery = this.#delivery;
    this.#events = undefined;
    this.#delivery = undefined;
    events?.close();
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

  async #handle(event: ConnectEvent, context: Omit<ConnectEventHandlerContext<ConnectEvent>, 'event'>) {
    try {
      const connect = event.resourceId ? context.connect.withResource(event.resourceId) : context.connect;
      await this.#handler(event)?.({ ...context, connect, event });
    } catch (error) {
      // One failing event must not end the subscription.
      context.logger.error('Connect event handler failed', {
        error,
        eventId: event.id,
        provider: event.provider,
        eventType: event.eventType,
      });
    }
  }

  async #deliver(
    events: ConnectEvents<ConnectEventFilter, boolean>,
    dispatcher: Dispatcher,
    context: Omit<ConnectEventHandlerContext<ConnectEvent>, 'event'>,
  ): Promise<void> {
    try {
      for await (const event of events as AsyncIterable<ConnectEvent>) {
        await dispatcher.dispatch(event.connectionId, () => this.#handle(event, context));
      }
    } catch (error) {
      context.logger.error('Connect event worker subscription ended', { error });
    } finally {
      await dispatcher.drain();
      if (this.#events === events) {
        this.#events = undefined;
        this.#delivery = undefined;
      }
    }
  }
}
