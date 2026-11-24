import type { SendNotificationSignalInput } from '@mastra/core/notifications';
import { SignalProvider } from '@mastra/core/signals';
import type { SignalProviderTarget } from '@mastra/core/signals';

import { ConnectEvents } from './events.js';
import type {
  ConnectEvent,
  ConnectEventOf,
  ConnectEventProvider,
  ConnectEventsOptions,
  ConnectEventType,
  KnownConnectEvent,
  UntypedConnectEvent,
} from './events.js';

/**
 * Which providers' events reach the agent: `true` for every event of a
 * provider, or a list of its event types. Providers without typed payloads
 * take any string.
 */
export type ConnectEventFilter = {
  readonly [P in ConnectEventProvider]?: true | readonly ConnectEventType<P>[];
} & {
  readonly [provider: string]: true | readonly string[] | undefined;
};

type VerifiedAs<U extends boolean> = U extends true ? boolean : false;

/** An event of a listed type whose payload parsed but isn't typed. */
type ListedEvent<P extends string, E extends string, Unverified extends boolean> = UntypedConnectEvent & {
  provider: P;
  eventType: E;
  payloadParseError?: undefined;
  unverified: Unverified;
};

type SelectedEvent<P extends string, S, U extends boolean> = S extends readonly (infer E extends string)[]
  ?
      | (P extends ConnectEventProvider ? ConnectEventOf<P, Extract<E, ConnectEventType<P>>> : ListedEvent<P, E, false>)
      | (U extends true ? ListedEvent<P, E, true> : never)
  : S extends true
    ?
        | (P extends ConnectEventProvider ? ConnectEventOf<P> : never)
        | (UntypedConnectEvent & { provider: P; unverified: VerifiedAs<U> })
    : never;

/**
 * The events a {@link ConnectEventSignals} with filter `F` delivers. Listed
 * event types of a typed provider have typed payloads; with
 * `includeUnverified`, check `unverified` first to narrow them.
 */
export type FilteredConnectEvent<
  F extends ConnectEventFilter | undefined = undefined,
  U extends boolean = false,
> = F extends ConnectEventFilter
  ? { [P in keyof F & string]: SelectedEvent<P, Exclude<F[P], undefined>, U> }[keyof F & string]
  : U extends true
    ? ConnectEvent
    : KnownConnectEvent | (UntypedConnectEvent & { unverified: false });

export interface ConnectEventSignalsOptions<
  F extends ConnectEventFilter | undefined = undefined,
  U extends boolean = false,
> extends ConnectEventsOptions {
  /**
   * Which providers and event types reach the agent. Omit it to send every
   * event. Listing event types also drops events whose payload wasn't JSON,
   * so their payloads have the documented type.
   */
  events?: F;
  /** Where events go: one thread, or a thread per event. Return `undefined` to drop the event. */
  target: SignalProviderTarget | ((event: FilteredConnectEvent<F, U>) => SignalProviderTarget | undefined);
  /** Overrides fields of the default notification. Return `undefined` to keep the default. */
  notification?: (event: FilteredConnectEvent<F, U>) => Partial<SendNotificationSignalInput> | undefined;
  /**
   * Deliver events whose signature the platform couldn't verify. Their
   * payloads may be forged, so they're dropped by default.
   */
  includeUnverified?: U;
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
  #events?: ConnectEvents;

  constructor(options: ConnectEventSignalsOptions<F, U>) {
    super();
    this.#options = options;
  }

  /** Subscribes to the project's Connect events. Called when the agent is created. */
  start(): void {
    if (this.#events) return;
    const {
      events: _filter,
      target: _target,
      notification: _notification,
      includeUnverified: _u,
      ...rest
    } = this.#options;
    let events: ConnectEvents;
    try {
      events = new ConnectEvents(rest);
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

  async #deliver(events: ConnectEvents): Promise<void> {
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

  async #handle(event: ConnectEvent): Promise<void> {
    try {
      if (event.unverified && !this.#options.includeUnverified) return;
      if (!this.#selects(event)) return;
      const selected = event as FilteredConnectEvent<F, U>;
      const { target } = this.#options;
      const destination = typeof target === 'function' ? target(selected) : target;
      if (!destination) return;
      const notification = { ...defaultNotification(event), ...this.#options.notification?.(selected) };
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

  #selects(event: ConnectEvent): boolean {
    const filter = this.#options.events;
    if (!filter) return true;
    if (!Object.hasOwn(filter, event.provider)) return false;
    const selected = filter[event.provider];
    if (selected === true) return true;
    if (!selected) return false;
    return !event.payloadParseError && selected.includes(event.eventType);
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
      eventId: event.id,
      provider: event.provider,
      eventType: event.eventType,
      ...(event.unverified ? { unverified: true } : {}),
    },
  };
}
