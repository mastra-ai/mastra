import type { SendNotificationSignalInput } from '@mastra/core/notifications';
import { SignalProvider } from '@mastra/core/signals';
import type { SignalProviderTarget } from '@mastra/core/signals';

import { MastraConnectError } from './errors.js';
import type { ConnectEventFilter, FilteredConnectEvent } from './event-filter.js';
import { ConnectEvents } from './events.js';
import type { ConnectEvent, ConnectEventsOptions } from './events.js';

export interface ConnectEventSignalsOptions<
  F extends ConnectEventFilter | undefined = undefined,
  U extends boolean = false,
> extends ConnectEventsOptions<F, U> {
  /** Where events go: one thread, or a thread per event. Return `undefined` to drop the event. */
  target: SignalProviderTarget | ((event: FilteredConnectEvent<F, U>) => SignalProviderTarget | undefined);
  /** Overrides fields of the default notification. Return `undefined` to keep the default. */
  notification?: (event: FilteredConnectEvent<F, U>) => Partial<SendNotificationSignalInput> | undefined;
  /**
   * Caps how many events of one connection can wake an idle agent: at most
   * `limit` per `windowMs`. Later events in the window are still stored on
   * the thread, marked `rateLimited` in their metadata, but don't start a
   * run; the agent sees them on its next one. Events whose target sets
   * `ifIdle.behavior` to `persist` or `discard` never wake the agent, so they
   * don't count. No limit by default.
   */
  rateLimit?: ConnectEventRateLimit;
}

export interface ConnectEventRateLimit {
  /** Events per connection that can wake the agent in each window. */
  limit: number;
  /** The window's length in milliseconds. */
  windowMs: number;
}

/**
 * Sends provider events from a project's Connect connections to an agent as
 * notification signals. Pass it to `Agent({ signals: [...] })`; it subscribes
 * when the agent is created and stays subscribed until `stop()`.
 *
 * @example
 * ```ts
 * const signals = new ConnectEventSignals({
 *   events: { github: ['pull_request.opened'], linear: true },
 *   target: { threadId: 'ops', resourceId: 'team-ops' },
 *   notification: event =>
 *     event.provider === 'github' ? { summary: `PR opened: ${event.payload.pull_request.title}` } : undefined,
 *   rateLimit: { limit: 5, windowMs: 60_000 },
 * });
 *
 * const agent = new Agent({ id: 'ops', name: 'Ops', instructions, model, signals: [signals] });
 * ```
 */
export class ConnectEventSignals<
  const F extends ConnectEventFilter | undefined = undefined,
  U extends boolean = false,
> extends SignalProvider<'connect-events'> {
  readonly id = 'connect-events';
  readonly name = 'Connect events';

  readonly #options: ConnectEventSignalsOptions<F, U>;
  #events?: ConnectEvents<F, U>;
  #windowStart = 0;
  /** Wakes per connection in the current window. */
  readonly #wakes = new Map<string, number>();

  constructor(options: ConnectEventSignalsOptions<F, U>) {
    super();
    const { rateLimit } = options;
    if (
      rateLimit &&
      !(
        Number.isInteger(rateLimit.limit) &&
        rateLimit.limit >= 0 &&
        rateLimit.windowMs > 0 &&
        Number.isFinite(rateLimit.windowMs)
      )
    ) {
      throw new MastraConnectError(
        'invalid_options',
        'rateLimit needs a whole number limit of 0 or more and a positive, finite windowMs.',
      );
    }
    this.#options = options;
  }

  /** Subscribes to the project's Connect events. Called when the agent is created. */
  start(): void {
    if (this.#events) return;
    const { target: _target, notification: _notification, rateLimit: _rateLimit, ...rest } = this.#options;
    let events: ConnectEvents<F, U>;
    try {
      events = new ConnectEvents<F, U>(rest);
    } catch (error) {
      this.#logger.error('Connect event signals could not subscribe', { error });
      return;
    }
    this.#events = events;
    void this.#deliver(events);
  }

  /** Ends the subscription. Call `start()` to subscribe again. */
  stop(): void {
    super.stop();
    this.#events?.close();
    this.#events = undefined;
  }

  async #deliver(events: ConnectEvents<F, U>): Promise<void> {
    try {
      for await (const event of events) {
        await this.#handle(event);
      }
    } catch (error) {
      this.#logger.error('Connect event signals subscription ended', { error });
    } finally {
      if (this.#events === events) this.#events = undefined;
    }
  }

  async #handle(event: FilteredConnectEvent<F, U>): Promise<void> {
    try {
      const { target } = this.#options;
      const destination = typeof target === 'function' ? target(event) : target;
      if (!destination) return;
      const notification = { ...defaultNotification(event), ...this.#options.notification?.(event) };
      // A destination that never wakes an idle agent doesn't use up the connection's rate limit.
      const mayWakeIdle = destination.ifIdle?.behavior !== 'persist' && destination.ifIdle?.behavior !== 'discard';
      if (!mayWakeIdle || this.#mayWake(event.connectionId)) {
        await this.notify(notification, destination);
      } else {
        await this.notify(
          { ...notification, metadata: { ...notification.metadata, rateLimited: true } },
          { ...destination, ifIdle: { ...destination.ifIdle, behavior: 'persist' } },
        );
      }
    } catch (error) {
      // One event that can't be delivered must not end the subscription.
      this.#logger.error('Connect event signal could not be delivered', {
        error,
        eventId: event.id,
        provider: event.provider,
        eventType: event.eventType,
      });
    }
  }

  /** Counts a wake against the connection's rate limit, if it has one left. */
  #mayWake(connectionId: string): boolean {
    const { rateLimit } = this.#options;
    if (!rateLimit) return true;
    const now = Date.now();
    if (now - this.#windowStart >= rateLimit.windowMs) {
      this.#windowStart = now;
      this.#wakes.clear();
    }
    const wakes = this.#wakes.get(connectionId) ?? 0;
    if (wakes >= rateLimit.limit) return false;
    this.#wakes.set(connectionId, wakes + 1);
    return true;
  }

  get #logger(): Pick<Console, 'error'> {
    return this.mastra?.getLogger() ?? console;
  }
}

function defaultNotification(event: ConnectEvent): SendNotificationSignalInput {
  const unverified = event.unverified ? ' (unverified)' : '';
  return {
    source: 'connect',
    kind: `${event.provider}:${event.eventType}`,
    summary: `${event.provider} ${event.eventType}${unverified}`,
    payload: event.payload,
    // Redelivered webhooks keep their source event id, so they don't notify twice.
    dedupeKey: `connect:${event.provider}:${event.sourceEventId ?? event.id}`,
    metadata: {
      connectionId: event.connectionId,
      ...(event.resourceId ? { resourceId: event.resourceId } : {}),
      eventId: event.id,
      provider: event.provider,
      eventType: event.eventType,
      ...(event.unverified ? { unverified: true } : {}),
    },
  };
}
