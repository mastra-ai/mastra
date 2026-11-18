import { ConnectEventWorker } from '@mastra/connect';
import type {
  ConnectEventHandlerContext,
  ConnectEventWorkerOptions,
  EventStreamGap,
  UntypedConnectEvent,
} from '@mastra/connect';
import type { IMastraLogger } from '@mastra/core/logger';

import type { IntegrationContext } from '../../base.js';
import type { PlatformConnectBinding } from './connect-binding.js';

/** Times a route's handler is called for one event before its integration reconciles instead. */
const HANDLER_ATTEMPTS = 3;

/** A provider event for one of an integration's connections. */
export interface PlatformConnectEventDelivery extends UntypedConnectEvent {
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

export type PlatformEventsWorkerOptions = Omit<ConnectEventWorkerOptions<true>, 'includeUnverified'>;

type Handler = (context: ConnectEventHandlerContext<UntypedConnectEvent>) => Promise<void>;

/**
 * Reads the Factory project's Connect events and hands each to the
 * integrations whose provider keys it carries, after checking the event's
 * connection is one of the integration's own. Unverified events are passed
 * on too: each integration decides whether to act on one or only re-read
 * what it names.
 *
 * Every replica reads every event, keeping its cursor in memory, so handlers
 * must be idempotent (they dedupe on `dedupeKey`). Each integration
 * reconciles when the worker starts, since events from before then aren't
 * read; when the events service reports a gap; and when a handler still
 * fails after its retries.
 */
export class PlatformEventsWorker extends ConnectEventWorker<Record<string, unknown>, true> {
  readonly #routes: readonly PlatformConnectEventRoute[];

  constructor(routes: readonly PlatformConnectEventRoute[], options: PlatformEventsWorkerOptions = {}) {
    super(handlersFor(routes), {
      ...options,
      includeUnverified: true,
      retry: { ...options.retry, attempts: HANDLER_ATTEMPTS },
      onGap: async (gap: EventStreamGap) => {
        for (const route of routes) route.reconcile();
        await options.onGap?.(gap);
      },
    });
    this.#routes = routes;
  }

  override async start(): Promise<void> {
    const wasRunning = this.isRunning;
    await super.start();
    if (wasRunning || !this.isRunning) return;
    // Reading starts at the newest event: reconcile what came before.
    for (const route of this.#routes) route.reconcile();
  }
}

function handlersFor(routes: readonly PlatformConnectEventRoute[]): Record<string, Handler> {
  const byProvider = new Map<string, PlatformConnectEventRoute[]>();
  for (const route of routes) {
    for (const provider of route.eventProviderKeys ?? route.binding.providerKeys) {
      byProvider.set(provider, [...(byProvider.get(provider) ?? []), route]);
    }
  }
  const failures = new Map<string, number>();
  return Object.fromEntries(
    [...byProvider].map(([provider, providerRoutes]): [string, Handler] => [
      provider,
      async ({ event, logger }) => {
        for (const route of providerRoutes) await deliver(route, event, logger, failures);
      },
    ]),
  );
}

async function deliver(
  route: PlatformConnectEventRoute,
  event: UntypedConnectEvent,
  logger: IMastraLogger,
  failures: Map<string, number>,
): Promise<void> {
  // End-user connections carry users' tokens, not the integration's webhooks.
  if (event.resourceId) return;
  if (!(await ownsConnection(route.binding, event.connectionId))) {
    logger.warn("Platform events: skipped an event for a connection outside the Factory's project", {
      integration: route.binding.integrationId,
      eventId: event.id,
      provider: event.provider,
      connectionId: event.connectionId,
    });
    return;
  }
  const key = `${route.binding.integrationId}:${event.id}`;
  try {
    await route.handle({ ...event, dedupeKey: event.sourceEventId ?? event.id });
    failures.delete(key);
  } catch (error) {
    const attempt = (failures.get(key) ?? 0) + 1;
    if (attempt >= HANDLER_ATTEMPTS) {
      failures.delete(key);
      // The worker skips the event after this attempt: reconcile to repair what it would have changed.
      route.reconcile();
    } else {
      failures.set(key, attempt);
    }
    throw error;
  }
}

async function ownsConnection(binding: PlatformConnectBinding, connectionId: string): Promise<boolean> {
  const has = (connections: { id: string }[]) => connections.some(connection => connection.id === connectionId);
  if (has(await binding.listConnections())) return true;
  // A connection linked since the listing was cached.
  return has(await binding.listConnections({ fresh: true }));
}
