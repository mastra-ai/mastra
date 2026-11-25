import { connectEventTypes } from './event-payloads/event-types.generated.js';
import type {
  ConnectEvent,
  ConnectEventOf,
  ConnectEventProvider,
  ConnectEventType,
  KnownConnectEvent,
  UntypedConnectEvent,
} from './events.js';

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
    ? ConnectEventOf<P, Extract<E, ConnectEventType<P>>> | (U extends true ? UnverifiedEvent<P, E> : never)
    : UntypedEvent<P, E, U> & { payloadParseError?: undefined }
  : S extends true
    ? P extends ConnectEventProvider
      ? ConnectEventOf<P> | (U extends true ? UnverifiedEvent<P, ConnectEventType<P>> : never)
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
    : KnownConnectEvent | (UntypedConnectEvent & { unverified: false });

/** The filter options shared by `ConnectEvents`, `ConnectEventSignals` and `ConnectEventWorker` triggers. */
export interface ConnectEventFilterOptions<
  F extends ConnectEventFilter | undefined = undefined,
  U extends boolean = false,
> {
  /**
   * Which providers and event types to take. Omit it to take every event.
   *
   * A provider with typed payloads only delivers the event types Connect has
   * types for, and only payloads that parsed as JSON. To get an event type
   * you added to `ConnectEventPayloads` yourself, list it.
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

/** Whether `filter` selects `event`. See {@link ConnectEventFilterOptions}. */
export function selectsConnectEvent(
  { events: filter, includeUnverified }: ConnectEventFilterOptions<ConnectEventFilter | undefined, boolean>,
  event: ConnectEvent,
): boolean {
  if (event.unverified && !includeUnverified) return false;
  const selected = !filter ? true : Object.hasOwn(filter, event.provider) ? filter[event.provider] : undefined;
  if (!selected) return false;
  if (selected !== true) return !event.payloadParseError && selected.includes(event.eventType);
  const typed = typedEventTypes.get(event.provider);
  return !typed || (!event.payloadParseError && typed.has(event.eventType));
}
