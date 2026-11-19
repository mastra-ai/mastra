import { isLeaseProvider, NoopLeaseProvider } from '@mastra/core/events';
import type { LeaseProvider, PubSub } from '@mastra/core/events';
import { MastraWorker } from '@mastra/core/worker';
import type { WorkerDeps } from '@mastra/core/worker';

import type { IntegrationStorageHandle } from '../../../storage/domains/integrations/base.js';
import { platformErrorStatus, platformRetryDelayMs } from '../platform-connect.js';
import type { PlatformConnectEventRoute } from './connect-events.js';

/** Integration-storage id the deployment's Connect event poller keeps its cursors under. */
export const PLATFORM_CONNECT_EVENT_POLLER_STORAGE_ID = 'platform-connect-event-poller';

const DEFAULT_POLL_INTERVAL_MS = 20_000;
const EVENT_PAGE_SIZE = 500;
/**
 * Pages drained per connection per cycle. A connection that never runs dry
 * hands over to the next after this many pages and resumes next cycle.
 */
const MAX_PAGES_PER_CONNECTION_PER_CYCLE = 10;
const MIN_LEASE_TTL_MS = 30_000;
const DEFAULT_RETRY_DELAY_MS = 1_000;
const HANDLER_ATTEMPTS = 3;
const CURSOR_ORG_ID = '__platform_connect_event_poller__';
const CURSOR_USER_ID = 'worker';

type PollerSettings = { version: 1; connections: Record<string, { afterEventId: string }> };

export type PlatformConnectEventPollerStorage = IntegrationStorageHandle<
  Record<string, unknown>,
  PollerSettings,
  Record<string, unknown>
>;

/** One row of a connection's platform event log (`GET /v2/connections/:id/events`). */
interface ConnectionEventEntry {
  id: string;
  timestamp: number;
  integrationId: string;
  eventType: string;
  sourceEventId: string | null;
  payload: unknown;
  /** Set when the forwarder skipped the provider's signature check. Not every platform version logs it. */
  unverified?: boolean;
}

export interface PlatformConnectEventPollerConfig {
  storage: PlatformConnectEventPollerStorage;
  routes: readonly PlatformConnectEventRoute[];
  /** Defaults to the shortest `pollIntervalMs` the routes ask for, else 20 s. */
  intervalMs?: number;
  /** First delay between handler attempts; doubles per attempt. */
  retryDelayMs?: number;
  now?: () => number;
}

/**
 * Reads each routed integration's active connections' platform event logs,
 * through the integration's own Connect client, and
 * hands every event to the integration's route. It is how Platform
 * integrations receive provider webhooks until they read the events service.
 *
 * One replica polls at a time (lease). Each connection keeps its own cursor,
 * saved after each handled event, so delivery is at-least-once: handlers
 * dedupe on `dedupeKey`. A connection read for the first time starts at the
 * present and asks its integration to reconcile once, since events from
 * before then are not read.
 *
 * The event log carries no verification flag, so events reach handlers with
 * `unverified: false`. That doesn't prove the platform checked the signature.
 */
export class PlatformConnectEventPoller extends MastraWorker {
  readonly name = 'platform-connect-event-poller';

  readonly #storage: PlatformConnectEventPollerStorage;
  readonly #routes: readonly PlatformConnectEventRoute[];
  readonly #intervalMs: number;
  readonly #retryDelayMs: number;
  readonly #now: () => number;
  readonly #leaseTtlMs: number;
  readonly #leaseOwner = globalThis.crypto.randomUUID();

  #running = false;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #leaseRenewalTimer: ReturnType<typeof setInterval> | undefined;
  #inFlight: Promise<void> | undefined;
  #leaseProvider: LeaseProvider = NoopLeaseProvider;
  #hasLease = false;
  #settings: PollerSettings = { version: 1, connections: {} };
  #handlerFailures = 0;

  constructor(config: PlatformConnectEventPollerConfig) {
    super();
    this.#storage = config.storage;
    this.#routes = config.routes;
    const asked = config.routes.flatMap(route => (route.pollIntervalMs === undefined ? [] : [route.pollIntervalMs]));
    this.#intervalMs = config.intervalMs ?? (asked.length > 0 ? Math.min(...asked) : DEFAULT_POLL_INTERVAL_MS);
    if (!Number.isFinite(this.#intervalMs) || this.#intervalMs <= 0) {
      throw new Error('Platform Connect event polling interval must be a positive number.');
    }
    this.#retryDelayMs = config.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
    this.#leaseTtlMs = Math.max(MIN_LEASE_TTL_MS, this.#intervalMs * 3);
    this.#now = config.now ?? Date.now;
  }

  async init(deps: WorkerDeps): Promise<void> {
    await super.init(deps);
    this.#leaseProvider = getLeaseProvider(deps.pubsub);
  }

  async start(): Promise<void> {
    if (this.#running) return;
    if (!this.deps) throw new Error('PlatformConnectEventPoller: call init() before start()');
    this.#running = true;
    this.deps.logger.debug('Platform Connect event polling started', {
      intervalMs: this.#intervalMs,
      integrations: this.#routes.map(route => route.binding.integrationId),
    });
    this.#schedule(0);
  }

  async stop(): Promise<void> {
    if (!this.#running) return;
    this.#running = false;
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = undefined;
    this.#stopLeaseRenewal();
    await this.#inFlight;
    if (this.#hasLease) {
      await this.#leaseProvider.releaseLease(this.#leaseKey(), this.#leaseOwner).catch(() => undefined);
      this.#hasLease = false;
    }
  }

  get isRunning(): boolean {
    return this.#running;
  }

  diagnostics(): Record<string, unknown> {
    return {
      polling: this.#running,
      hasLease: this.#hasLease,
      connections: Object.keys(this.#settings.connections).length,
      handlerFailures: this.#handlerFailures,
    };
  }

  #schedule(delayMs: number): void {
    if (!this.#running) return;
    this.#timer = setTimeout(() => {
      this.#timer = undefined;
      const run = this.#tick();
      this.#inFlight = run;
      void run.finally(() => {
        if (this.#inFlight === run) this.#inFlight = undefined;
      });
    }, delayMs);
    this.#timer.unref?.();
  }

  async #tick(): Promise<void> {
    let nextDelay = this.#intervalMs;
    try {
      if (!(await this.#ensureLease())) return;
      nextDelay = await this.#poll();
    } catch (error) {
      nextDelay = platformRetryDelayMs(error, this.#intervalMs);
      this.deps?.logger.error('Platform Connect event polling cycle failed', {
        error: error instanceof Error ? error.message : String(error),
        retryInMs: nextDelay,
      });
    } finally {
      this.#schedule(nextDelay);
    }
  }

  async #ensureLease(): Promise<boolean> {
    if (this.#hasLease) return true;
    const result = await this.#leaseProvider.acquireLease(this.#leaseKey(), this.#leaseOwner, this.#leaseTtlMs);
    if (!result.acquired) return false;
    // Another replica may have advanced the cursors while this one waited.
    this.#settings = normalizeSettings(await this.#storage.settings.get(CURSOR_ORG_ID, CURSOR_USER_ID));
    this.#hasLease = true;
    this.#startLeaseRenewal();
    return true;
  }

  #startLeaseRenewal(): void {
    if (this.#leaseRenewalTimer) return;
    this.#leaseRenewalTimer = setInterval(
      () => {
        void this.#leaseProvider
          .renewLease(this.#leaseKey(), this.#leaseOwner, this.#leaseTtlMs)
          .then(renewed => {
            if (!renewed) this.#loseLease();
          })
          .catch(error => {
            this.#loseLease();
            this.deps?.logger.warn('Platform Connect event polling lease renewal failed', {
              error: error instanceof Error ? error.message : String(error),
            });
          });
      },
      Math.floor(this.#leaseTtlMs / 3),
    );
    this.#leaseRenewalTimer.unref?.();
  }

  #loseLease(): void {
    this.#hasLease = false;
    this.#stopLeaseRenewal();
  }

  #stopLeaseRenewal(): void {
    if (this.#leaseRenewalTimer) clearInterval(this.#leaseRenewalTimer);
    this.#leaseRenewalTimer = undefined;
  }

  async #poll(): Promise<number> {
    let retryInMs = this.#intervalMs;
    const seen = new Set<string>();
    for (const route of this.#routes) {
      let connections;
      try {
        connections = await route.binding.activeConnections();
      } catch (error) {
        this.deps?.logger.warn('Platform Connect event polling could not list connections', {
          integration: route.binding.integrationId,
          error: error instanceof Error ? error.message : String(error),
        });
        retryInMs = Math.max(retryInMs, platformRetryDelayMs(error, this.#intervalMs));
        continue;
      }
      for (const connection of connections) {
        if (!this.#running || !this.#hasLease) return retryInMs;
        // End-user connections carry tokens, not the integration's webhooks.
        if (connection.resourceId) continue;
        if (route.eventProviderKeys && !route.eventProviderKeys.includes(connection.integrationId)) continue;
        if (seen.has(connection.id)) continue;
        seen.add(connection.id);
        try {
          await this.#pollConnection(route, connection.id);
        } catch (error) {
          const status = platformErrorStatus(error);
          if (status === 401 || status === 404) {
            // The platform no longer serves this connection; its listing will
            // say so. The other connections keep flowing.
            this.deps?.logger.warn('Platform Connect connection is unavailable; skipped this cycle', {
              integration: route.binding.integrationId,
              connectionId: connection.id,
              status,
            });
            continue;
          }
          const delay = platformRetryDelayMs(error, this.#intervalMs);
          retryInMs = Math.max(retryInMs, delay);
          this.deps?.logger.error('Platform Connect connection event polling failed', {
            integration: route.binding.integrationId,
            connectionId: connection.id,
            error: error instanceof Error ? error.message : String(error),
            retryInMs: delay,
          });
          if (status === 429) return retryInMs;
        }
      }
    }
    return retryInMs;
  }

  async #pollConnection(route: PlatformConnectEventRoute, connectionId: string): Promise<void> {
    if (!this.#settings.connections[connectionId]) {
      // Log ids are Redis stream ids (`<unix ms>-<sequence>`), so this starts
      // at the present. What came before is covered by a reconcile.
      await this.#saveCursor(connectionId, `${this.#now()}-0`);
      route.reconcile();
    }
    for (let page = 0; page < MAX_PAGES_PER_CONNECTION_PER_CYCLE; page += 1) {
      if (!this.#running || !this.#hasLease) return;
      const after = this.#settings.connections[connectionId]!.afterEventId;
      const query = new URLSearchParams({ afterEventId: after, limit: String(EVENT_PAGE_SIZE) });
      const result = await route.binding.connect.request<{ events: ConnectionEventEntry[]; nextCursor: string | null }>(
        'GET',
        `/v2/connections/${encodeURIComponent(connectionId)}/events?${query}`,
      );
      for (const entry of result.events) {
        // A replica that lost its lease must not move a cursor the new holder owns.
        if (!this.#running || !this.#hasLease) return;
        await this.#deliver(route, connectionId, entry);
        // The lease can lapse while a handler runs; the event is then the new holder's to deliver again.
        if (!this.#running || !this.#hasLease) return;
        await this.#saveCursor(connectionId, entry.id);
      }
      if (result.events.length < EVENT_PAGE_SIZE) return;
    }
  }

  /**
   * Runs the handler, retrying with backoff. An event that still fails is
   * logged and skipped, and its integration reconciles now.
   */
  async #deliver(route: PlatformConnectEventRoute, connectionId: string, entry: ConnectionEventEntry): Promise<void> {
    const sourceEventId = entry.sourceEventId || null;
    const delivery = {
      id: entry.id,
      timestamp: entry.timestamp,
      connectionId,
      integrationId: entry.integrationId,
      eventType: entry.eventType,
      sourceEventId,
      payload: entry.payload,
      unverified: entry.unverified === true,
      dedupeKey: sourceEventId ?? entry.id,
    };
    for (let attempt = 1; ; attempt += 1) {
      try {
        await route.handle(delivery);
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (attempt >= HANDLER_ATTEMPTS) {
          this.#handlerFailures += 1;
          this.deps?.logger.error('Platform Connect events: giving up on an event; reconciling to repair it', {
            integration: route.binding.integrationId,
            connectionId,
            eventId: entry.id,
            attempts: attempt,
            error: message,
          });
          route.reconcile();
          return;
        }
        this.deps?.logger.warn('Platform Connect events: event handler failed; retrying', {
          integration: route.binding.integrationId,
          connectionId,
          eventId: entry.id,
          attempt,
          error: message,
        });
        await new Promise(resolve => setTimeout(resolve, this.#retryDelayMs * 2 ** (attempt - 1)));
      }
    }
  }

  async #saveCursor(connectionId: string, afterEventId: string): Promise<void> {
    const next = {
      ...this.#settings,
      connections: { ...this.#settings.connections, [connectionId]: { afterEventId } },
    };
    await this.#storage.settings.save(CURSOR_ORG_ID, CURSOR_USER_ID, next);
    // Only a saved cursor moves: if the save fails, the next cycle delivers the event again.
    this.#settings = next;
  }

  #leaseKey(): string {
    return `${this.name}:${this.#storage.integrationId}`;
  }
}

function getLeaseProvider(pubsub: PubSub): LeaseProvider {
  const getProvider = (pubsub as PubSub & { getLeaseProvider?: () => LeaseProvider | undefined }).getLeaseProvider;
  if (typeof getProvider === 'function') return getProvider.call(pubsub) ?? NoopLeaseProvider;
  return isLeaseProvider(pubsub) ? pubsub : NoopLeaseProvider;
}

function normalizeSettings(value: PollerSettings | null): PollerSettings {
  if (!value || value.version !== 1 || !value.connections || typeof value.connections !== 'object') {
    return { version: 1, connections: {} };
  }
  const connections: PollerSettings['connections'] = {};
  for (const [connectionId, cursor] of Object.entries(value.connections)) {
    if (typeof cursor?.afterEventId === 'string' && cursor.afterEventId.length > 0) {
      connections[connectionId] = { afterEventId: cursor.afterEventId };
    }
  }
  return { version: 1, connections };
}
