import { connectEventTypes } from './event-payloads/event-types.generated.js';
import type {
  ConnectEvent,
  ConnectEventProvider,
  ConnectEventType,
  TypedEventsOf,
  UntypedConnectEvent,
} from './events.js';

type ShippedEventTypes = typeof connectEventTypes;

/**
 * The providers Connect ships payload types for. Only these are filtered by
 * event type at runtime: a provider added with `declare module` isn't, so
 * `true` treats it as untyped.
 */
type ShippedProvider = keyof ShippedEventTypes & ConnectEventProvider;

/** The event types `true` delivers for a shipped provider. */
type ShippedEventType<P extends ShippedProvider> = ShippedEventTypes[P][number];

/** The typed events a provider delivers without listing event types. */
type ShippedConnectEvent = { [P in ShippedProvider]: TypedEventsOf<P, ShippedEventType<P>> }[ShippedProvider];

/**
 * Which providers' events to take: `true` for every event of a provider, or a
 * list of its event types. Providers without typed payloads take any string.
 */
export type ConnectEventFilter = {
  readonly [P in ConnectEventProvider]?: true | readonly ConnectEventType<P>[];
} & {
  readonly [provider: string]: true | readonly string[] | undefined;
};

/** An unverified event of a listed type. Its payload may be forged, so it isn't typed. */
type UnverifiedEvent<P extends string, E extends string> = UntypedConnectEvent & {
  provider: P;
  eventType: E;
  payloadParseError?: undefined;
  unverified: true;
};

/** An event of a provider without typed payloads. */
type UntypedEvent<P extends string, E extends string, U extends boolean> = UntypedConnectEvent & {
  provider: P;
  eventType: E;
  unverified: U extends true ? boolean : false;
};

type SelectedEvent<P extends string, S, U extends boolean> = S extends readonly (infer E extends string)[]
  ? P extends ConnectEventProvider
    ? TypedEventsOf<P, E> | (U extends true ? UnverifiedEvent<P, E> : never)
    : UntypedEvent<P, E, U> & { payloadParseError?: undefined }
  : S extends true
    ? P extends ShippedProvider
      ? TypedEventsOf<P, ShippedEventType<P>> | (U extends true ? UnverifiedEvent<P, ShippedEventType<P>> : never)
      : UntypedEvent<P, string, U>
    : never;

/**
 * The events a filter `F` selects. A typed provider only delivers events
 * whose payload type is known, so checking `provider` and `eventType`
 * narrows `payload`. With `includeUnverified`, check `unverified` first.
 *
 * Without a filter, providers without typed payloads come through too, as
 * `UntypedConnectEvent`s whose `provider` is any string, so `payload` can't be
 * narrowed. List the providers you want to get typed payloads.
 */
export type FilteredConnectEvent<
  F extends ConnectEventFilter | undefined = undefined,
  U extends boolean = false,
> = F extends ConnectEventFilter
  ? { [P in keyof F & string]: SelectedEvent<P, Exclude<F[P], undefined>, U> }[keyof F & string]
  : U extends true
    ? ConnectEvent
    : ShippedConnectEvent | (UntypedConnectEvent & { unverified: false });

/** The filter options shared by `ConnectEvents` and `ConnectEventSignals`. */
export interface ConnectEventFilterOptions<
  F extends ConnectEventFilter | undefined = undefined,
  U extends boolean = false,
> {
  /**
   * Which providers and event types to take. Omit it to take every event.
   *
   * A provider with typed payloads only delivers the event types Connect has
   * types for, and only payloads that parsed as JSON. To get an event type
   * you added to `ConnectEventPayloads` yourself, list it. A provider you
   * added yourself isn't filtered by event type, so `true` delivers all of
   * its events, untyped; list its event types to get typed payloads.
   */
  events?: F;
  /**
   * Take events whose signature the platform couldn't verify. Their payloads
   * may be forged, so they're dropped by default, and their payloads aren't
   * typed.
   */
  includeUnverified?: U;
}

const typedEventTypes = new Map<string, ReadonlySet<string>>(
  Object.entries(connectEventTypes).map(([provider, types]) => [provider, new Set<string>(types)]),
);

/**
 * Returns whether the filter options select an event. See
 * {@link ConnectEventFilterOptions}. The filter is copied, so changing it
 * afterwards can't deliver events its type doesn't describe.
 */
export function connectEventSelector({
  events,
  includeUnverified,
}: ConnectEventFilterOptions<ConnectEventFilter | undefined, boolean>): (event: ConnectEvent) => boolean {
  const filter =
    events &&
    new Map<string, true | ReadonlySet<string>>(
      Object.entries(events).flatMap(([provider, selected]): [string, true | ReadonlySet<string>][] =>
        selected === true ? [[provider, true]] : selected ? [[provider, new Set(selected)]] : [],
      ),
    );
  return event => {
    if (event.unverified && !includeUnverified) return false;
    const selected = filter ? filter.get(event.provider) : true;
    if (!selected) return false;
    if (selected !== true) return !event.payloadParseError && selected.has(event.eventType);
    const typed = typedEventTypes.get(event.provider);
    return !typed || (!event.payloadParseError && typed.has(event.eventType));
  };
}
