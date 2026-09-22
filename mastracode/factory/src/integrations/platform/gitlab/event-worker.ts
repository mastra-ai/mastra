import { randomUUID } from 'node:crypto';

import type { MountedMastraCode } from '@mastra/code-sdk';
import { isLeaseProvider, NoopLeaseProvider } from '@mastra/core/events';
import type { LeaseProvider, PubSub } from '@mastra/core/events';
import { MastraWorker } from '@mastra/core/worker';
import type { WorkerDeps } from '@mastra/core/worker';

import type { IntegrationStorageHandle } from '../../../storage/domains/integrations/base.js';
import type { GitLabWebhookDispatchIntegration } from '../../gitlab/webhook-dispatch.js';
import { parseGitLabWebhookBody, processGitLabWebhook } from '../../gitlab/webhook.js';
import type { ParsedGitLabWebhook } from '../../gitlab/webhook.js';
import type { PlatformApiClient } from '../api-client.js';
import { PlatformApiError } from '../api-client.js';

const DEFAULT_POLL_INTERVAL_MS = 20_000;
const EVENT_PAGE_SIZE = 500;
const MIN_LEASE_TTL_MS = 30_000;
const CURSOR_ORG_ID = '__platform_gitlab_event_worker__';
const CURSOR_USER_ID = 'worker';
const DELIVERY_ID_PREFIX = 'platform';

type PlatformGitLabEventWorkerSettings = {
  version: 1;
  connections: Record<string, { afterEventId: string }>;
};

export type PlatformGitLabEventStorage = IntegrationStorageHandle<
  Record<string, unknown>,
  PlatformGitLabEventWorkerSettings,
  Record<string, unknown>
>;

/** One row of the Platform integration event log. */
export interface IntegrationEventEntry {
  id: string;
  timestamp: number;
  integrationId: string;
  eventType: string;
  sourceEventId: string | null;
  payload: unknown;
}

export interface PlatformGitLabEventConnection {
  id: string;
  status: 'active' | 'needs_reauth';
}

export type PlatformGitLabEventDispatchIntegration = GitLabWebhookDispatchIntegration;

export interface PlatformGitLabEventWorkerConfig {
  client: PlatformApiClient;
  controller: MountedMastraCode['controller'];
  gitlab: PlatformGitLabEventDispatchIntegration;
  storage: PlatformGitLabEventStorage;
  /** Platform connections to tail; only `active` ones are polled. */
  listConnections: () => Promise<PlatformGitLabEventConnection[]>;
  ingestFactoryEvent?: (event: ParsedGitLabWebhook) => Promise<unknown>;
  intervalMs?: number;
  now?: () => number;
  process?: typeof processGitLabWebhook;
}

/**
 * Tails the Platform event log for every active GitLab connection and feeds
 * each stored webhook body through the same ingress the direct
 * `/web/gitlab/webhook` route uses. A Platform-managed connection has no
 * project webhook pointing at Factory, so this is how issue, note, merge
 * request and push events reach the rules engine and subscribed sessions.
 *
 * One replica polls at a time (lease). Each connection keeps its own cursor,
 * persisted only after a whole page has been processed, so a crash mid-page
 * replays the page rather than losing it; replay handling in the rules ingress
 * and the delivery-id dedupe keys make that safe.
 */
export class PlatformGitLabEventWorker extends MastraWorker {
  readonly name = 'platform-gitlab-events';

  readonly #client: PlatformApiClient;
  readonly #controller: MountedMastraCode['controller'];
  readonly #gitlab: PlatformGitLabEventDispatchIntegration;
  readonly #storage: PlatformGitLabEventStorage;
  readonly #listConnections: () => Promise<PlatformGitLabEventConnection[]>;
  readonly #ingestFactoryEvent: ((event: ParsedGitLabWebhook) => Promise<unknown>) | undefined;
  readonly #intervalMs: number;
  readonly #now: () => number;
  readonly #process: typeof processGitLabWebhook;
  readonly #leaseOwner = randomUUID();

  #running = false;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #leaseRenewalTimer: ReturnType<typeof setInterval> | undefined;
  #inFlight: Promise<void> | undefined;
  #leaseProvider: LeaseProvider = NoopLeaseProvider;
  #leaseTtlMs: number;
  #hasLease = false;
  #startedAt = 0;
  #settings: PlatformGitLabEventWorkerSettings = { version: 1, connections: {} };

  constructor(config: PlatformGitLabEventWorkerConfig) {
    super();
    this.#client = config.client;
    this.#controller = config.controller;
    this.#gitlab = config.gitlab;
    this.#storage = config.storage;
    this.#listConnections = config.listConnections;
    this.#ingestFactoryEvent = config.ingestFactoryEvent;
    this.#intervalMs = config.intervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    if (!Number.isFinite(this.#intervalMs) || this.#intervalMs <= 0) {
      throw new Error('Platform GitLab event polling interval must be a positive number.');
    }
    this.#leaseTtlMs = Math.max(MIN_LEASE_TTL_MS, this.#intervalMs * 3);
    this.#now = config.now ?? Date.now;
    this.#process = config.process ?? processGitLabWebhook;
  }

  async init(deps: WorkerDeps): Promise<void> {
    await super.init(deps);
    this.#leaseProvider = getLeaseProvider(deps.pubsub);
  }

  async start(): Promise<void> {
    if (this.#running) return;
    if (!this.deps) throw new Error('PlatformGitLabEventWorker: call init() before start()');

    this.#startedAt = this.#now() - 1;
    this.#settings = normalizeSettings(await this.#storage.settings.get(CURSOR_ORG_ID, CURSOR_USER_ID));
    this.#running = true;
    this.deps.logger.info('Platform GitLab event polling started', {
      intervalMs: this.#intervalMs,
      leaseTtlMs: this.#leaseTtlMs,
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
      nextDelay = retryDelay(error, this.#intervalMs);
      this.deps?.logger.error('Platform GitLab event polling cycle failed', {
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
    this.#hasLease = result.acquired;
    if (this.#hasLease) this.#startLeaseRenewal();
    return this.#hasLease;
  }

  #startLeaseRenewal(): void {
    if (this.#leaseRenewalTimer) return;
    this.#leaseRenewalTimer = setInterval(
      () => {
        void this.#leaseProvider
          .renewLease(this.#leaseKey(), this.#leaseOwner, this.#leaseTtlMs)
          .then(renewed => {
            if (!renewed) {
              this.#hasLease = false;
              this.#stopLeaseRenewal();
            }
          })
          .catch(error => {
            this.#hasLease = false;
            this.#stopLeaseRenewal();
            this.deps?.logger.warn('Platform GitLab event polling lease renewal failed', {
              error: error instanceof Error ? error.message : String(error),
            });
          });
      },
      Math.floor(this.#leaseTtlMs / 3),
    );
    this.#leaseRenewalTimer.unref?.();
  }

  #stopLeaseRenewal(): void {
    if (this.#leaseRenewalTimer) clearInterval(this.#leaseRenewalTimer);
    this.#leaseRenewalTimer = undefined;
  }

  async #poll(): Promise<number> {
    const connections = (await this.#listConnections()).filter(connection => connection.status === 'active');
    let retryInMs = this.#intervalMs;

    for (const connection of connections) {
      if (!this.#running || !this.#hasLease) break;
      try {
        await this.#pollConnection(connection.id);
      } catch (error) {
        if (error instanceof PlatformApiError && (error.status === 401 || error.status === 404)) {
          // Platform no longer serves this connection (revoked, expired or
          // deleted). Its status will read needs_reauth on the next listing;
          // nothing to retry here, so the other connections keep flowing.
          this.deps?.logger.warn('Platform GitLab connection needs reauthorization; skipped this cycle', {
            connectionId: connection.id,
            status: error.status,
          });
          continue;
        }
        const delay = retryDelay(error, this.#intervalMs);
        retryInMs = Math.max(retryInMs, delay);
        this.deps?.logger.error('Platform GitLab connection event polling failed', {
          connectionId: connection.id,
          error: error instanceof Error ? error.message : String(error),
          retryInMs: delay,
        });
        if (error instanceof PlatformApiError && error.status === 429) break;
      }
    }
    return retryInMs;
  }

  async #pollConnection(connectionId: string): Promise<void> {
    if (!this.#settings.connections[connectionId]) {
      // Event ids are Redis stream ids (`<unix ms>-<sequence>`), so a
      // synthesized id at start time skips history the same way the GitHub
      // worker's start timestamp does. Events that arrived before Factory was
      // deployed are not work Factory was asked to do.
      this.#settings.connections[connectionId] = { afterEventId: `${this.#startedAt}-0` };
      await this.#saveSettings();
    }

    while (this.#running && this.#hasLease) {
      const cursor: { afterEventId: string } = this.#settings.connections[connectionId]!;
      const query = new URLSearchParams({ afterEventId: cursor.afterEventId, limit: String(EVENT_PAGE_SIZE) });
      const pollStartedAt = performance.now();
      const page = await this.#client.request<{ events: IntegrationEventEntry[]; nextCursor: string | null }>(
        'GET',
        `/v2/connections/${encodeURIComponent(connectionId)}/events?${query}`,
      );
      this.deps?.logger.debug('Platform GitLab connection event poll completed', {
        connectionId,
        eventCount: page.events.length,
        latencyMs: Math.round(performance.now() - pollStartedAt),
      });
      if (page.events.length === 0 || !page.nextCursor) return;

      for (const event of page.events) {
        if (!this.#running || !this.#hasLease) return;
        await this.#processEvent(connectionId, event);
      }

      if (page.nextCursor === cursor.afterEventId) return;
      this.#settings.connections[connectionId] = { afterEventId: page.nextCursor };
      await this.#saveSettings();
    }
  }

  async #processEvent(connectionId: string, event: IntegrationEventEntry): Promise<void> {
    if (!event.id) {
      this.deps?.logger.warn('Platform GitLab event log returned an event without an id', { connectionId });
      return;
    }
    const deliveryId = `${DELIVERY_ID_PREFIX}:${connectionId}:${event.id}`;
    const parsed = parseGitLabWebhookBody(event.payload, deliveryId);
    if (!parsed) {
      // Pipelines, deployments, wiki edits and the like: acknowledged and
      // dropped, exactly as the direct route treats an unsupported event header.
      this.deps?.logger.debug('Platform GitLab event ignored: unsupported or malformed body', {
        connectionId,
        eventId: event.id,
        eventType: event.eventType,
      });
      return;
    }

    const result = await this.#process(parsed, {
      ingestFactoryEvent: this.#ingestFactoryEvent,
      controller: this.#controller,
      // The integration supplies subscription storage and the project-member
      // trust check, so the dispatcher's default author gate applies unchanged.
      gitlab: this.#gitlab,
      onTargetSkipped: subscription => {
        // Routine when a subscription's thread belongs to another deployment,
        // so this stays at debug rather than warning on a loop.
        this.deps?.logger.debug('Platform GitLab event skipped: thread is not held here', {
          deliveryId,
          subscriptionId: subscription.id,
          threadId: subscription.threadId,
        });
      },
      onSenderRejected: notification => {
        this.deps?.logger.debug('Platform GitLab event dropped: sender not authorized', {
          deliveryId,
          repository: notification.metadata.projectPath,
          sender: notification.metadata.sender,
          kind: notification.kind,
        });
      },
      onTargetError: (subscription, error) => {
        this.deps?.logger.error('Platform GitLab event delivery failed for a subscription', {
          deliveryId,
          subscriptionId: subscription.id,
          resourceId: subscription.resourceId,
          threadId: subscription.threadId,
          error: error instanceof Error ? error.message : String(error),
        });
      },
    });
    if (result.status !== 202) {
      this.deps?.logger.warn('Platform GitLab event was not accepted by the webhook processor', {
        connectionId,
        deliveryId,
        status: result.status,
      });
    }
  }

  async #saveSettings(): Promise<void> {
    await this.#storage.settings.save(CURSOR_ORG_ID, CURSOR_USER_ID, this.#settings);
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

function normalizeSettings(value: PlatformGitLabEventWorkerSettings | null): PlatformGitLabEventWorkerSettings {
  if (!value || value.version !== 1 || !value.connections || typeof value.connections !== 'object') {
    return { version: 1, connections: {} };
  }
  const connections: PlatformGitLabEventWorkerSettings['connections'] = {};
  for (const [connectionId, cursor] of Object.entries(value.connections)) {
    if (typeof cursor?.afterEventId === 'string' && cursor.afterEventId.length > 0) {
      connections[connectionId] = { afterEventId: cursor.afterEventId };
    }
  }
  return { version: 1, connections };
}

function retryDelay(error: unknown, fallbackMs: number): number {
  if (error instanceof PlatformApiError && error.status === 429 && error.retryAfterSeconds !== null) {
    return Math.max(fallbackMs, error.retryAfterSeconds * 1_000);
  }
  return fallbackMs;
}
