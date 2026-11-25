import type { IMastraLogger } from '@mastra/core/logger';
import type { Mastra } from '@mastra/core/mastra';
import { MastraWorker } from '@mastra/core/worker';
import type { WorkerStopOptions } from '@mastra/core/worker';

import { ConnectClient } from './connect-client.js';
import type { ConnectEventFilter, FilteredConnectEvent } from './event-filter.js';
import { ConnectEvents } from './events.js';
import type { ConnectEvent, ConnectEventProvider, ConnectEventsOptions, ConnectEventType } from './events.js';

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
   * Use `connect.withResource(event.resourceId)` to act as the end user an
   * event's connection belongs to.
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

/**
 * Handles provider events on a project's Connect connections. Pass it to
 * `new Mastra({ workers: [...] })`; it subscribes when Mastra starts its
 * workers, and only to the providers and event types it has handlers for.
 *
 * Delivery is at least once and in order: the cursor moves past an event
 * once its handler returns, so a handler can see an event again after a
 * restart. Run the worker in one process.
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

    let subscription: ConnectEvents<ConnectEventFilter, boolean>;
    let connect: ConnectClient;
    try {
      connect = new ConnectClient(this.#options);
      subscription = new ConnectEvents<ConnectEventFilter, boolean>({ ...this.#options, events });
    } catch (error) {
      mastra.getLogger().error('Connect event worker could not subscribe', { error });
      return;
    }
    this.#events = subscription;
    this.#delivery = this.#deliver(subscription, { mastra, logger: mastra.getLogger(), connect });
  }

  /** Ends the subscription and waits for the event being handled, up to `drainTimeout` ms. */
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

  async #deliver(
    events: ConnectEvents<ConnectEventFilter, boolean>,
    context: Omit<ConnectEventHandlerContext<ConnectEvent>, 'event'>,
  ): Promise<void> {
    try {
      for await (const event of events as AsyncIterable<ConnectEvent>) {
        try {
          await this.#handler(event)?.({ ...context, event });
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
    } catch (error) {
      context.logger.error('Connect event worker subscription ended', { error });
    } finally {
      if (this.#events === events) {
        this.#events = undefined;
        this.#delivery = undefined;
      }
    }
  }
}
