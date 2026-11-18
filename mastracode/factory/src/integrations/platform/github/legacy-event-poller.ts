import { isLeaseProvider, NoopLeaseProvider } from '@mastra/core/events';
import type { LeaseProvider, PubSub } from '@mastra/core/events';
import { MastraWorker } from '@mastra/core/worker';
import type { WorkerDeps } from '@mastra/core/worker';

import type { IntegrationStorageHandle } from '../../../storage/domains/integrations/base.js';
import { platformErrorStatus, platformRetryDelayMs } from '../platform-connect.js';
import type { GithubEventLogger } from './events.js';
import type { LegacyGithubEvent } from './legacy-events.js';
import type { LegacyGithubEventCursor, LegacyGithubTransport } from './legacy-transport.js';

const DEFAULT_POLL_INTERVAL_MS = 20_000;
const EVENT_PAGE_SIZE = 500;
const MIN_LEASE_TTL_MS = 30_000;
const DEFAULT_RETRY_DELAY_MS = 1_000;
const HANDLER_ATTEMPTS = 3;
// Unchanged from the worker this replaces, so a deployment resumes from its saved cursors.
const CURSOR_ORG_ID = '__platform_github_event_worker__';
const CURSOR_USER_ID = 'worker';

type PollerSettings = { version: 1; repositories: Record<string, LegacyGithubEventCursor> };

export type PlatformGithubLegacyEventStorage = IntegrationStorageHandle<
  Record<string, unknown>,
  PollerSettings,
  Record<string, unknown>
>;

export interface PlatformGithubLegacyEventPollerConfig {
  transport: Pick<LegacyGithubTransport, 'listRepositoryEvents'>;
  storage: PlatformGithubLegacyEventStorage;
  /** The repositories Factory projects link; only their logs are read. */
  repositoryIds(): Promise<number[]>;
  /** Handles one event. Must be idempotent: delivery is at-least-once. */
  handle(event: LegacyGithubEvent, logger?: GithubEventLogger): Promise<void>;
  /** Repairs what an event that could not be handled left behind. */
  reconcile(): void;
  intervalMs?: number;
  /** First delay between handler attempts; doubles per attempt. */
  retryDelayMs?: number;
  now?: () => number;
}

/**
 * Reads the legacy GitHub App's webhooks from each linked repository's
 * platform event log (`/v1/server/github-app/repositories/:id/events`) and
 * hands them to Platform GitHub's handler.
 *
 * One replica polls at a time (lease). Each repository keeps its own cursor,
 * saved after each handled event, so delivery is at-least-once. A repository
 * read for the first time starts at the time this poller started. A handler
 * that still fails after three attempts is skipped, and the integration
 * reconciles.
 */
export class PlatformGithubLegacyEventPoller extends MastraWorker {
  readonly name = 'platform-github-events';

  readonly #config: PlatformGithubLegacyEventPollerConfig;
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
  #startedAt = 0;
  #settings: PollerSettings = { version: 1, repositories: {} };
  #handlerFailures = 0;

  constructor(config: PlatformGithubLegacyEventPollerConfig) {
    super();
    this.#config = config;
    this.#intervalMs = config.intervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    if (!Number.isFinite(this.#intervalMs) || this.#intervalMs <= 0) {
      throw new Error('Platform GitHub event polling interval must be a positive number.');
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
    if (!this.deps) throw new Error('PlatformGithubLegacyEventPoller: call init() before start()');
    this.#startedAt = this.#now() - 1;
    this.#running = true;
    this.deps.logger.debug('Platform GitHub event polling started', { intervalMs: this.#intervalMs });
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
      repositories: Object.keys(this.#settings.repositories).length,
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
      this.deps?.logger.error('Platform GitHub event polling cycle failed', {
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
    this.#settings = normalizeSettings(await this.#config.storage.settings.get(CURSOR_ORG_ID, CURSOR_USER_ID));
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
            this.deps?.logger.warn('Platform GitHub event polling lease renewal failed', {
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
    for (const repositoryId of await this.#config.repositoryIds()) {
      if (!this.#running || !this.#hasLease) break;
      try {
        await this.#pollRepository(repositoryId);
      } catch (error) {
        const delay = platformRetryDelayMs(error, this.#intervalMs);
        retryInMs = Math.max(retryInMs, delay);
        this.deps?.logger.error('Platform GitHub repository event polling failed', {
          repositoryId,
          error: error instanceof Error ? error.message : String(error),
          retryInMs: delay,
        });
        if (platformErrorStatus(error) === 429) break;
      }
    }
    return retryInMs;
  }

  async #pollRepository(repositoryId: number): Promise<void> {
    const key = String(repositoryId);
    if (!this.#settings.repositories[key]) await this.#saveCursor(key, { afterTimestamp: this.#startedAt });
    while (this.#running && this.#hasLease) {
      const cursor = this.#settings.repositories[key]!;
      const page = await this.#config.transport.listRepositoryEvents(repositoryId, cursor, EVENT_PAGE_SIZE);
      for (const entry of page.events) {
        // A replica that lost its lease must not move a cursor the new holder owns.
        if (!this.#running || !this.#hasLease) return;
        await this.#deliver(repositoryId, {
          id: entry.id,
          timestamp: streamIdTime(entry.id) ?? this.#now(),
          event: entry.event,
          deliveryId: entry.deliveryId,
          payload: entry.payload,
        });
        await this.#saveCursor(key, { afterEventId: entry.id });
      }
      if (page.events.length < EVENT_PAGE_SIZE || !page.nextCursor) return;
    }
  }

  async #deliver(repositoryId: number, event: LegacyGithubEvent): Promise<void> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        await this.#config.handle(event, this.deps?.logger);
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (attempt >= HANDLER_ATTEMPTS) {
          this.#handlerFailures += 1;
          this.deps?.logger.error('Platform GitHub events: giving up on an event; reconciling to repair it', {
            repositoryId,
            eventId: event.id,
            deliveryId: event.deliveryId,
            attempts: attempt,
            error: message,
          });
          this.#config.reconcile();
          return;
        }
        this.deps?.logger.warn('Platform GitHub events: event handler failed; retrying', {
          repositoryId,
          eventId: event.id,
          attempt,
          error: message,
        });
        await new Promise(resolve => setTimeout(resolve, this.#retryDelayMs * 2 ** (attempt - 1)));
      }
    }
  }

  async #saveCursor(key: string, cursor: LegacyGithubEventCursor): Promise<void> {
    this.#settings.repositories[key] = cursor;
    await this.#config.storage.settings.save(CURSOR_ORG_ID, CURSOR_USER_ID, this.#settings);
  }

  #leaseKey(): string {
    return `${this.name}:${this.#config.storage.integrationId}`;
  }
}

/** The Unix milliseconds a Redis stream id (`<ms>-<sequence>`) was minted at. */
function streamIdTime(id: string): number | undefined {
  const match = /^(\d+)-\d+$/.exec(id);
  return match ? Number(match[1]) : undefined;
}

function normalizeSettings(value: PollerSettings | null): PollerSettings {
  if (!value || value.version !== 1 || !value.repositories || typeof value.repositories !== 'object') {
    return { version: 1, repositories: {} };
  }
  return { version: 1, repositories: { ...value.repositories } };
}

function getLeaseProvider(pubsub: PubSub): LeaseProvider {
  const getProvider = (pubsub as PubSub & { getLeaseProvider?: () => LeaseProvider | undefined }).getLeaseProvider;
  if (typeof getProvider === 'function') return getProvider.call(pubsub) ?? NoopLeaseProvider;
  return isLeaseProvider(pubsub) ? pubsub : NoopLeaseProvider;
}
