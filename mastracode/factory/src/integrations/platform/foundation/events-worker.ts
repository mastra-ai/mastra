import { MastraConnectError } from '@mastra/connect';
import type {
  ConnectEvent,
  EventCursor,
  EventCursorStore,
  EventsClient,
  EventStreamGap,
  EventSubscription,
  TopicEvent,
} from '@mastra/connect';
import { isLeaseProvider, NoopLeaseProvider } from '@mastra/core/events';
import type { LeaseProvider, PubSub } from '@mastra/core/events';
import { MastraWorker } from '@mastra/core/worker';
import type { WorkerDeps } from '@mastra/core/worker';

import type { IntegrationStorageHandle } from '../../../storage/domains/integrations/base.js';
import type { IntegrationContext } from '../../base.js';
import type { PlatformConnectBinding } from './connect-binding.js';

/** Integration-storage id the deployment's events worker keeps its cursors under. */
export const PLATFORM_EVENTS_STORAGE_ID = 'platform-events';

const CURSOR_ORG_ID = '__platform_events_worker__';
const CURSOR_USER_ID = 'worker';
const CONNECT_TOPIC = 'connect';
const DEFAULT_LEASE_TTL_MS = 60_000;
const DEFAULT_RETRY_DELAY_MS = 1_000;
const DEFAULT_RESUBSCRIBE_DELAY_MS = 30_000;
const HANDLER_ATTEMPTS = 3;

/** A `connect`-topic event handed to an integration. */
export interface PlatformConnectEventDelivery extends ConnectEvent {
  /** `sourceEventId ?? id`: the provider's delivery id when known, else the event id. Prefix it per integration. */
  dedupeKey: string;
}

/** How one integration receives `connect`-topic events. */
export interface PlatformConnectEventRoute {
  /** The integration's binding: its provider keys route events, its project listing vets connections. */
  binding: PlatformConnectBinding;
  /** Handles one event. Must be idempotent: delivery is at-least-once. */
  handle(event: PlatformConnectEventDelivery): Promise<void>;
  /** Asks the integration to reconcile once, to cover events the worker may have missed. */
  reconcile(): void;
}

/** An integration that may receive `connect`-topic events. */
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

/** An additional topic the worker reads, with its own cursor. */
export interface PlatformTopicSubscription {
  topic: string;
  /** Handles one event. Must be idempotent: delivery is at-least-once. */
  route(event: TopicEvent): Promise<void>;
  /** Called when the topic is read without a cursor, or after a gap, to cover what may have been missed. */
  reconcile?(): void;
}

type EventsWorkerSettings = { version: 1; cursors: Record<string, EventCursor> };

export type PlatformEventsWorkerStorage = IntegrationStorageHandle<
  Record<string, unknown>,
  EventsWorkerSettings,
  Record<string, unknown>
>;

export interface PlatformEventsWorkerConfig {
  events: EventsClient;
  storage: PlatformEventsWorkerStorage;
  routes: readonly PlatformConnectEventRoute[];
  topics?: readonly PlatformTopicSubscription[];
  leaseTtlMs?: number;
  /** First delay between handler attempts; doubles per attempt. */
  retryDelayMs?: number;
  /** Delay before resubscribing after a failed subscription, or before retrying the lease. */
  resubscribeDelayMs?: number;
  now?: () => number;
}

interface TopicDiagnostics {
  connected: boolean;
  cursor: string | null;
  lastEventAt: number | null;
  lagMs: number | null;
  handlerFailures: number;
}

type StreamEvent = { id: string; timestamp: number };

interface StreamOptions {
  cursorStore: EventCursorStore;
  onGap(gap: EventStreamGap): void;
  signal: AbortSignal;
}

interface TopicRunner {
  topic: string;
  subscribe(options: StreamOptions): EventSubscription<StreamEvent>;
  handle(event: StreamEvent): Promise<void>;
  reconcile(): void;
  diagnostics: TopicDiagnostics;
}

/** Pairs a subscription with the handler for its event type. */
function topicRunner<T extends StreamEvent>(
  topic: string,
  subscribe: (options: StreamOptions) => EventSubscription<T>,
  handle: (event: T) => Promise<void>,
  reconcile: () => void,
): TopicRunner {
  return {
    topic,
    subscribe,
    // Only events from `subscribe` reach `handle`, so they are always a T.
    handle: event => handle(event as T),
    reconcile,
    diagnostics: emptyDiagnostics(),
  };
}

/**
 * Reads the Factory project's `connect` topic from the platform events
 * service and hands each provider event to the integration that owns its
 * connection. One replica holds the subscription (lease). The events client
 * saves each topic's cursor (id and time) through a store backed by
 * integration settings once an event's handler settles, so a crash replays
 * the event; handlers dedupe on `dedupeKey`. Reading without a cursor (first
 * boot, or after the service rejected a stale one) and a gap the service
 * reports both ask every routed integration to reconcile once, so nothing
 * between the last read and the live tail is lost.
 */
export class PlatformEventsWorker extends MastraWorker {
  readonly name = 'platform-events';

  readonly #events: EventsClient;
  readonly #storage: PlatformEventsWorkerStorage;
  readonly #routes = new Map<string, PlatformConnectEventRoute>();
  readonly #runners: TopicRunner[];
  readonly #leaseTtlMs: number;
  readonly #retryDelayMs: number;
  readonly #resubscribeDelayMs: number;
  readonly #now: () => number;
  readonly #leaseOwner = globalThis.crypto.randomUUID();

  #running = false;
  #leaseProvider: LeaseProvider = NoopLeaseProvider;
  #hasLease = false;
  #leaseRenewalTimer: ReturnType<typeof setInterval> | undefined;
  #leaseRetryTimer: ReturnType<typeof setTimeout> | undefined;
  #abort: AbortController | undefined;
  #loops: Promise<void>[] = [];
  #settings: EventsWorkerSettings = { version: 1, cursors: {} };
  #saving: Promise<void> = Promise.resolve();

  constructor(config: PlatformEventsWorkerConfig) {
    super();
    this.#events = config.events;
    this.#storage = config.storage;
    for (const route of config.routes) {
      for (const key of route.binding.providerKeys) {
        const existing = this.#routes.get(key);
        if (existing) {
          throw new Error(
            `Platform events: provider key '${key}' is claimed by both ${existing.binding.integrationId} and ${route.binding.integrationId}.`,
          );
        }
        this.#routes.set(key, route);
      }
    }
    this.#leaseTtlMs = config.leaseTtlMs ?? DEFAULT_LEASE_TTL_MS;
    this.#retryDelayMs = config.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
    this.#resubscribeDelayMs = config.resubscribeDelayMs ?? DEFAULT_RESUBSCRIBE_DELAY_MS;
    this.#now = config.now ?? Date.now;

    const routes = [...new Set(this.#routes.values())];
    this.#runners = [
      topicRunner(
        CONNECT_TOPIC,
        options => this.#events.connectEvents(options),
        event => this.#handleConnectEvent(event),
        () => {
          for (const route of routes) route.reconcile();
        },
      ),
      ...(config.topics ?? []).map(subscription =>
        topicRunner(
          subscription.topic,
          options => this.#events.subscribe(subscription.topic, options),
          event => subscription.route(event),
          () => subscription.reconcile?.(),
        ),
      ),
    ];
  }

  async init(deps: WorkerDeps): Promise<void> {
    await super.init(deps);
    this.#leaseProvider = getLeaseProvider(deps.pubsub);
  }

  async start(): Promise<void> {
    if (this.#running) return;
    if (!this.deps) throw new Error('PlatformEventsWorker: call init() before start()');
    this.#settings = normalizeSettings(await this.#storage.settings.get(CURSOR_ORG_ID, CURSOR_USER_ID));
    this.#running = true;
    this.deps.logger.info('Platform events worker started', {
      topics: this.#runners.map(runner => runner.topic),
      integrations: [...new Set([...this.#routes.values()].map(route => route.binding.integrationId))],
    });
    void this.#acquire();
  }

  async stop(): Promise<void> {
    if (!this.#running) return;
    this.#running = false;
    if (this.#leaseRetryTimer) clearTimeout(this.#leaseRetryTimer);
    this.#leaseRetryTimer = undefined;
    await this.#closeSubscriptions();
    if (this.#hasLease) {
      await this.#leaseProvider.releaseLease(this.#leaseKey(), this.#leaseOwner).catch(() => undefined);
      this.#hasLease = false;
    }
  }

  get isRunning(): boolean {
    return this.#running;
  }

  /** Whether this replica holds the subscription. */
  get hasLease(): boolean {
    return this.#hasLease;
  }

  diagnostics(): Record<string, unknown> {
    const now = this.#now();
    return {
      worker: this.name,
      hasLease: this.#hasLease,
      integrations: [...new Set([...this.#routes.values()].map(route => route.binding.integrationId))],
      topics: Object.fromEntries(
        this.#runners.map(runner => [
          runner.topic,
          {
            ...runner.diagnostics,
            cursor: this.#settings.cursors[runner.topic]?.eventId ?? null,
            lagMs: runner.diagnostics.lastEventAt === null ? null : runner.diagnostics.lagMs,
            idleMs: runner.diagnostics.lastEventAt === null ? null : now - runner.diagnostics.lastEventAt,
          },
        ]),
      ),
    };
  }

  async #acquire(): Promise<void> {
    if (!this.#running) return;
    const lease = await this.#leaseProvider
      .acquireLease(this.#leaseKey(), this.#leaseOwner, this.#leaseTtlMs)
      .catch(() => ({ acquired: false }));
    if (!this.#running) {
      if (lease.acquired) await this.#leaseProvider.releaseLease(this.#leaseKey(), this.#leaseOwner).catch(() => {});
      return;
    }
    if (!lease.acquired) {
      this.#leaseRetryTimer = setTimeout(() => void this.#acquire(), Math.floor(this.#leaseTtlMs / 2));
      this.#leaseRetryTimer.unref?.();
      return;
    }
    this.#hasLease = true;
    this.#startLeaseRenewal();
    const abort = new AbortController();
    this.#abort = abort;
    this.#loops = this.#runners.map(runner => this.#run(runner, abort.signal));
  }

  #startLeaseRenewal(): void {
    this.#leaseRenewalTimer = setInterval(
      () => {
        void this.#leaseProvider
          .renewLease(this.#leaseKey(), this.#leaseOwner, this.#leaseTtlMs)
          .then(renewed => {
            if (!renewed) this.#loseLease('not renewed');
          })
          .catch(error => this.#loseLease(error instanceof Error ? error.message : String(error)));
      },
      Math.max(1_000, Math.floor(this.#leaseTtlMs / 3)),
    );
    this.#leaseRenewalTimer.unref?.();
  }

  #loseLease(reason: string): void {
    if (!this.#hasLease) return;
    this.deps?.logger.warn('Platform events worker lost its lease; closing the subscription', { reason });
    void this.#closeSubscriptions().then(() => {
      if (this.#running) void this.#acquire();
    });
  }

  async #closeSubscriptions(): Promise<void> {
    this.#hasLease = false;
    if (this.#leaseRenewalTimer) clearInterval(this.#leaseRenewalTimer);
    this.#leaseRenewalTimer = undefined;
    this.#abort?.abort();
    this.#abort = undefined;
    await Promise.allSettled(this.#loops);
    this.#loops = [];
  }

  /** Reads one topic until the worker stops or loses its lease, resubscribing as needed. */
  async #run(runner: TopicRunner, signal: AbortSignal): Promise<void> {
    while (!signal.aborted) {
      const stored = this.#settings.cursors[runner.topic];
      let subscription: EventSubscription<StreamEvent> | undefined;
      try {
        // Inside the try: a client that can't subscribe at all (no project id,
        // bad options) is logged and retried like a failed stream.
        subscription = runner.subscribe({
          cursorStore: {
            load: () => stored ?? null,
            save: cursor => {
              // After losing the lease another replica owns the cursor; this event replays there.
              if (signal.aborted) return;
              return this.#saveCursor(runner.topic, cursor);
            },
          },
          onGap: gap => {
            this.deps?.logger.warn('Platform events: events were missed; reconciling once', {
              topic: runner.topic,
              ...gap,
            });
            runner.reconcile();
          },
          signal,
        });
        if (stored === undefined) {
          // Reading from the live tail: reconcile what came before it.
          void subscription.ready.then(
            () => {
              if (signal.aborted) return;
              this.deps?.logger.info('Platform events: reading from the live tail; reconciling once', {
                topic: runner.topic,
              });
              runner.reconcile();
            },
            () => {},
          );
        }
        runner.diagnostics.connected = true;
        for await (const event of subscription) {
          if (signal.aborted) break;
          await this.#deliver(runner, event);
        }
      } catch (error) {
        if (signal.aborted) break;
        if (error instanceof MastraConnectError && error.code === 'invalid_cursor') {
          this.deps?.logger.warn('Platform events: the stored cursor was rejected; restarting from the live tail', {
            topic: runner.topic,
            cursor: stored?.eventId,
          });
          await this.#clearCursor(runner.topic);
          continue;
        }
        this.deps?.logger.error('Platform events subscription failed', {
          topic: runner.topic,
          error: error instanceof Error ? error.message : String(error),
          retryInMs: this.#resubscribeDelayMs,
        });
        runner.diagnostics.connected = false;
        await sleep(this.#resubscribeDelayMs, signal);
      } finally {
        runner.diagnostics.connected = false;
        subscription?.close();
      }
    }
  }

  /** Runs the handler, retrying with backoff; a poison event is logged and skipped. */
  async #deliver(runner: TopicRunner, event: StreamEvent): Promise<void> {
    runner.diagnostics.lastEventAt = this.#now();
    runner.diagnostics.lagMs = Math.max(0, this.#now() - event.timestamp);
    for (let attempt = 1; ; attempt += 1) {
      try {
        await runner.handle(event);
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (attempt >= HANDLER_ATTEMPTS) {
          runner.diagnostics.handlerFailures += 1;
          this.deps?.logger.error('Platform events: giving up on an event; the next reconcile repairs it', {
            topic: runner.topic,
            eventId: event.id,
            attempts: attempt,
            error: message,
          });
          return;
        }
        this.deps?.logger.warn('Platform events: event handler failed; retrying', {
          topic: runner.topic,
          eventId: event.id,
          attempt,
          error: message,
        });
        await sleep(this.#retryDelayMs * 2 ** (attempt - 1), this.#abort?.signal);
        if (!this.#abort || this.#abort.signal.aborted) throw error;
      }
    }
  }

  async #handleConnectEvent(event: ConnectEvent): Promise<void> {
    if (!event.connectionId || !event.integrationId) {
      this.deps?.logger.warn('Platform events: skipped a connect event without a connection or integration id', {
        eventId: event.id,
      });
      return;
    }
    const route = this.#routes.get(event.integrationId);
    if (!route) {
      this.deps?.logger.debug('Platform events: no integration handles this provider; skipped', {
        eventId: event.id,
        integrationId: event.integrationId,
      });
      return;
    }
    if (!(await this.#ownsConnection(route.binding, event.connectionId))) {
      this.deps?.logger.warn("Platform events: skipped an event for a connection outside the Factory's project", {
        eventId: event.id,
        integrationId: event.integrationId,
        connectionId: event.connectionId,
      });
      return;
    }
    await route.handle({ ...event, dedupeKey: event.sourceEventId ?? event.id });
  }

  async #ownsConnection(binding: PlatformConnectBinding, connectionId: string): Promise<boolean> {
    const has = (connections: { id: string }[]) => connections.some(connection => connection.id === connectionId);
    if (has(await binding.listConnections())) return true;
    return has(await binding.listConnections({ fresh: true }));
  }

  async #saveCursor(topic: string, cursor: EventCursor): Promise<void> {
    this.#settings.cursors[topic] = cursor;
    await this.#persist();
  }

  async #clearCursor(topic: string): Promise<void> {
    delete this.#settings.cursors[topic];
    await this.#persist();
  }

  /** Writes are chained so a slower earlier save never lands after a later one. */
  #persist(): Promise<void> {
    const snapshot: EventsWorkerSettings = { version: 1, cursors: { ...this.#settings.cursors } };
    this.#saving = this.#saving
      .catch(() => {})
      .then(() => this.#storage.settings.save(CURSOR_ORG_ID, CURSOR_USER_ID, snapshot));
    return this.#saving;
  }

  #leaseKey(): string {
    return `${this.name}:${this.#storage.integrationId}`;
  }
}

function emptyDiagnostics(): TopicDiagnostics {
  return { connected: false, cursor: null, lastEventAt: null, lagMs: null, handlerFailures: 0 };
}

const CURSOR_ID = /^-?\d{1,20}$/;

/** Drops anything malformed, so a bad row restarts from the live tail (and reconciles) instead of failing. */
function normalizeSettings(value: EventsWorkerSettings | null): EventsWorkerSettings {
  const cursors: Record<string, EventCursor> = {};
  if (value?.version === 1 && value.cursors && typeof value.cursors === 'object') {
    for (const [topic, raw] of Object.entries(value.cursors as Record<string, unknown>)) {
      if (!raw || typeof raw !== 'object') continue;
      const { eventId, timestamp } = raw as { eventId?: unknown; timestamp?: unknown };
      const cursor: EventCursor = {};
      if (typeof eventId === 'string' && CURSOR_ID.test(eventId)) cursor.eventId = eventId;
      if (typeof timestamp === 'number' && Number.isSafeInteger(timestamp) && timestamp >= 0) {
        cursor.timestamp = timestamp;
      }
      if (cursor.eventId !== undefined || cursor.timestamp !== undefined) cursors[topic] = cursor;
    }
  }
  return { version: 1, cursors };
}

function sleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise(resolve => {
    if (signal?.aborted) return resolve();
    const timer = setTimeout(done, ms);
    timer.unref?.();
    function done() {
      clearTimeout(timer);
      signal?.removeEventListener('abort', done);
      resolve();
    }
    signal?.addEventListener('abort', done, { once: true });
  });
}

function getLeaseProvider(pubsub: PubSub): LeaseProvider {
  const getProvider = (pubsub as PubSub & { getLeaseProvider?: () => LeaseProvider | undefined }).getLeaseProvider;
  if (typeof getProvider === 'function') return getProvider.call(pubsub) ?? NoopLeaseProvider;
  return isLeaseProvider(pubsub) ? pubsub : ((pubsub as PubSub & { lease?: LeaseProvider }).lease ?? NoopLeaseProvider);
}
