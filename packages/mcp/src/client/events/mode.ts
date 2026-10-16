import type { MastraError } from '@mastra/core/error';
import type { EventOccurrence } from '../../shared/events';
import { eventsError } from './errors';
import type { EventsPort, MCPEventDeliveryMode } from './types';

/** Subscription settings with defaults applied. */
export interface ResolvedDeliveryOptions {
  maxAgeMs?: number;
  maxEvents?: number;
  minPollIntervalMs: number;
  heartbeatTimeoutMs: number;
  streamOpenTimeoutMs: number;
}

/** What a delivery driver can see and do for one subscription. */
export interface DeliveryContext {
  readonly port: EventsPort;
  readonly name: string;
  readonly arguments: Record<string, unknown> | undefined;
  readonly options: ResolvedDeliveryOptions;
  /** Aborted when the subscription is cancelled. */
  readonly signal: AbortSignal;
  /** Cursor to resume from. */
  readonly cursor: string | null;
  /** Hands an occurrence to the subscriber (de-duplicated by `eventId`). */
  deliver(occurrence: EventOccurrence): void;
  /** Records the position the server confirmed. An absent cursor is `null`: no replay. */
  setPosition(cursor: string | null | undefined, truncated?: boolean): void;
  /** Signals that the server accepted the subscription during this session. */
  established(): void;
  reportError(error: MastraError): void;
  /** Waits, resolving early if the subscription is cancelled. */
  sleep(ms: number): Promise<void>;
}

/**
 * Drives one delivery session. Returning or throwing ends the session; the subscription then
 * backs off and starts another from the last cursor, unless the error is fatal. A webhook driver
 * (SEP-3415 `events/subscribe`) implements this same interface.
 */
export interface DeliveryDriver {
  readonly mode: MCPEventDeliveryMode;
  session(context: DeliveryContext): Promise<void>;
}

/**
 * Modes this client can drive, most preferred first. The SEP orders webhook before push when the
 * caller configured a receiver; a webhook driver slots in at the front of this list.
 */
const DELIVERY_PREFERENCE: readonly MCPEventDeliveryMode[] = ['push', 'poll'];

/**
 * Picks the delivery mode for a subscription from the modes the event descriptor advertises.
 * Modes this client does not know (from newer SEP revisions) are ignored.
 */
export function selectDeliveryMode(
  advertised: readonly string[],
  forced: MCPEventDeliveryMode | undefined,
  details: { serverName: string; eventName: string },
): MCPEventDeliveryMode {
  if (forced) {
    if (advertised.includes(forced)) return forced;
    throw eventsError(
      'MCP_EVENTS_NO_COMPATIBLE_DELIVERY_MODE',
      `Event '${details.eventName}' on server '${details.serverName}' does not offer '${forced}' delivery (offers: ${advertised.join(', ')})`,
      { ...details, requested: forced, advertised: advertised.join(',') },
    );
  }
  const mode = DELIVERY_PREFERENCE.find(candidate => advertised.includes(candidate));
  if (mode) return mode;
  throw eventsError(
    'MCP_EVENTS_NO_COMPATIBLE_DELIVERY_MODE',
    `Event '${details.eventName}' on server '${details.serverName}' offers no delivery mode this client supports (offers: ${advertised.join(', ')})`,
    { ...details, advertised: advertised.join(',') },
  );
}
