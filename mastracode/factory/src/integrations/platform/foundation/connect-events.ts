import type { ConnectEvent } from '@mastra/connect';

import type { IntegrationContext } from '../../base.js';
import type { PlatformConnectBinding } from './connect-binding.js';

/** A provider event for one of an integration's connections. */
export interface PlatformConnectEventDelivery extends ConnectEvent {
  /** `sourceEventId ?? id`: the provider's delivery id when known, else the event id. Prefix it per integration. */
  dedupeKey: string;
}

/** How one integration receives its connections' provider events. */
export interface PlatformConnectEventRoute {
  /** The integration's binding: its connections are the ones whose events it receives. */
  binding: PlatformConnectBinding;
  /** Handles one event. Must be idempotent: delivery is at-least-once. */
  handle(event: PlatformConnectEventDelivery): Promise<void>;
  /** Asks the integration to reconcile once, to cover events that may have been missed. */
  reconcile(): void;
  /**
   * The provider keys whose connections send events the integration handles.
   * Defaults to every provider key of the binding.
   */
  eventProviderKeys?: readonly string[];
  /** How often the integration wants its connections' events read. The poller reads at the shortest asked for. */
  pollIntervalMs?: number;
}

/** An integration that may receive its connections' provider events. */
export interface PlatformConnectEventSource {
  /** The integration's route, or null when it takes no events in this context. */
  connectEventRoute(ctx: IntegrationContext): PlatformConnectEventRoute | null;
}

export function isPlatformConnectEventSource(value: unknown): value is PlatformConnectEventSource {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { connectEventRoute?: unknown }).connectEventRoute === 'function'
  );
}
