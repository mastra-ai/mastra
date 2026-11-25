import type { SendNotificationSignalInput } from '@mastra/core/notifications';
import { SignalProvider } from '@mastra/core/signals';
import type { SignalProviderTarget } from '@mastra/core/signals';

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

  constructor(options: ConnectEventSignalsOptions<F, U>) {
    super();
    this.#options = options;
  }

  /** Subscribes to the project's Connect events. Called when the agent is created. */
  start(): void {
    if (this.#events) return;
    const { target: _target, notification: _notification, ...rest } = this.#options;
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
      await this.notify(notification, destination);
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
