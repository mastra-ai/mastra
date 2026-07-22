import { randomUUID } from 'node:crypto';

import type { MountedMastraCode } from '@mastra/code-sdk';
import { isLeaseProvider, NoopLeaseProvider } from '@mastra/core/events';
import type { LeaseProvider, PubSub } from '@mastra/core/events';
import { MastraWorker } from '@mastra/core/worker';
import type { WorkerDeps } from '@mastra/core/worker';

import type { IntegrationStorageHandle } from '../../../storage/domains/integrations/base.js';
import type { GithubRepositoryPermission } from '../../github/integration.js';
import { listPullRequestSubscriptionsForWebhook, retirePullRequestSubscription } from '../../github/subscriptions.js';
import type { GithubSubscriptionStorage } from '../../github/subscriptions.js';
import { dispatchGithubWebhook } from '../../github/webhook.js';
import type { GithubWebhookNotification, ParsedGithubWebhook } from '../../github/webhook.js';
import type { PlatformApiClient } from '../api-client.js';
import { PlatformApiError } from '../api-client.js';

const API_PREFIX = '/v1/server/github-app';
const DEFAULT_POLL_INTERVAL_MS = 5_000;
const EVENT_PAGE_SIZE = 500;
const MIN_LEASE_TTL_MS = 30_000;
const CURSOR_ORG_ID = '__platform_github_event_worker__';
const CURSOR_USER_ID = 'worker';
const SUPPORTED_EVENTS = new Set([
  'issues',
  'issue_comment',
  'pull_request',
  'pull_request_review',
  'pull_request_review_comment',
]);
const AUTHOR_GATED_KINDS = new Set([
  'issue-comment',
  'pull-request-comment',
  'pull-request-review',
  'pull-request-review-comment',
]);
const AUTHORIZED_BOTS = new Set(['coderabbitai[bot]', 'devin-ai-integration[bot]']);
const AUTHORIZED_PERMISSIONS = new Set<GithubRepositoryPermission>(['admin', 'maintain', 'write']);
const PERMISSION_CHECK_TIMEOUT_MS = 5_000;

type EventCursor = { afterEventId: string } | { afterTimestamp: number };
type PlatformGithubEventWorkerSettings = {
  version: 1;
  repositories: Record<string, EventCursor>;
};

export type PlatformGithubEventStorage = IntegrationStorageHandle<
  Record<string, unknown>,
  PlatformGithubEventWorkerSettings,
  Record<string, unknown>
>;

type EventLogEntry = {
  id: string;
  deliveryId: string;
  event: string;
  payload: unknown;
};

type Repository = { id: number };

export interface PlatformGithubEventDispatchIntegration {
  readonly integrationStorage: GithubSubscriptionStorage;
  getRepositoryCollaboratorPermission(
    installationId: number,
    repoFullName: string,
    username: string,
    signal?: AbortSignal,
  ): Promise<GithubRepositoryPermission | undefined>;
}

export interface PlatformGithubEventWorkerConfig {
  client: PlatformApiClient;
  controller: MountedMastraCode['controller'];
  github: PlatformGithubEventDispatchIntegration;
  storage: PlatformGithubEventStorage;
  ingestFactoryEvent?: (event: ParsedGithubWebhook) => Promise<unknown>;
  intervalMs?: number;
  now?: () => number;
  dispatch?: typeof dispatchGithubWebhook;
}

export class PlatformGithubEventWorker extends MastraWorker {
  readonly name = 'platform-github-events';

  readonly #client: PlatformApiClient;
  readonly #controller: MountedMastraCode['controller'];
  readonly #github: PlatformGithubEventDispatchIntegration;
  readonly #storage: PlatformGithubEventStorage;
  readonly #ingestFactoryEvent: ((event: ParsedGithubWebhook) => Promise<unknown>) | undefined;
  readonly #intervalMs: number;
  readonly #now: () => number;
  readonly #dispatch: typeof dispatchGithubWebhook;
  readonly #leaseOwner = randomUUID();

  #running = false;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #leaseRenewalTimer: ReturnType<typeof setInterval> | undefined;
  #inFlight: Promise<void> | undefined;
  #leaseProvider: LeaseProvider = NoopLeaseProvider;
  #leaseTtlMs: number;
  #hasLease = false;
  #startedAt = 0;
  #settings: PlatformGithubEventWorkerSettings = { version: 1, repositories: {} };

  constructor(config: PlatformGithubEventWorkerConfig) {
    super();
    this.#client = config.client;
    this.#controller = config.controller;
    this.#github = config.github;
    this.#storage = config.storage;
    this.#ingestFactoryEvent = config.ingestFactoryEvent;
    this.#intervalMs = config.intervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    if (!Number.isFinite(this.#intervalMs) || this.#intervalMs <= 0) {
      throw new Error('Platform GitHub event polling interval must be a positive number.');
    }
    this.#leaseTtlMs = Math.max(MIN_LEASE_TTL_MS, this.#intervalMs * 3);
    this.#now = config.now ?? Date.now;
    this.#dispatch = config.dispatch ?? dispatchGithubWebhook;
  }

  async init(deps: WorkerDeps): Promise<void> {
    await super.init(deps);
    this.#leaseProvider = getLeaseProvider(deps.pubsub);
  }

  async start(): Promise<void> {
    if (this.#running) return;
    if (!this.deps) throw new Error('PlatformGithubEventWorker: call init() before start()');

    this.#startedAt = this.#now() - 1;
    this.#settings = normalizeSettings(await this.#storage.settings.get(CURSOR_ORG_ID, CURSOR_USER_ID));
    this.#running = true;
    this.deps.logger.info('Platform GitHub event polling started', {
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
            this.deps?.logger.warn('Platform GitHub event polling lease renewal failed', {
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
    const repositories = await this.#discoverRepositories();
    let retryInMs = this.#intervalMs;

    for (const repository of repositories) {
      if (!this.#running || !this.#hasLease) break;
      try {
        await this.#pollRepository(repository.id);
      } catch (error) {
        const delay = retryDelay(error, this.#intervalMs);
        retryInMs = Math.max(retryInMs, delay);
        this.deps?.logger.error('Platform GitHub repository event polling failed', {
          repositoryId: repository.id,
          error: error instanceof Error ? error.message : String(error),
          retryInMs: delay,
        });
        if (error instanceof PlatformApiError && error.status === 429) break;
      }
    }

    return retryInMs;
  }

  async #discoverRepositories(): Promise<Repository[]> {
    const result = await this.#client.request<{
      installations: Array<{
        installationId: number;
        usable: boolean;
        suspendedAt: string | null;
      }>;
    }>('GET', `${API_PREFIX}/installations`);
    const repositories = new Map<number, Repository>();

    for (const installation of result.installations) {
      if (!installation.usable || installation.suspendedAt) continue;
      const page = await this.#client.request<{ repositories: Repository[] }>(
        'GET',
        `${API_PREFIX}/installations/${installation.installationId}/repositories`,
      );
      for (const repository of page.repositories) repositories.set(repository.id, repository);
    }

    return [...repositories.values()];
  }

  async #pollRepository(repositoryId: number): Promise<void> {
    const key = String(repositoryId);
    if (!this.#settings.repositories[key]) {
      this.#settings.repositories[key] = { afterTimestamp: this.#startedAt };
      await this.#saveSettings();
    }

    while (this.#running && this.#hasLease) {
      const cursor: EventCursor = this.#settings.repositories[key]!;
      const query = new URLSearchParams({ limit: String(EVENT_PAGE_SIZE) });
      if ('afterEventId' in cursor) query.set('afterEventId', cursor.afterEventId);
      else query.set('afterTimestamp', String(cursor.afterTimestamp));

      const page = await this.#client.request<{ events: EventLogEntry[]; nextCursor: string | null }>(
        'GET',
        `${API_PREFIX}/repositories/${repositoryId}/events?${query}`,
      );
      if (page.events.length === 0 || !page.nextCursor) return;

      for (const event of page.events) {
        if (!this.#running || !this.#hasLease) return;
        const parsed = parseEvent(event);
        if (!parsed) {
          this.deps?.logger.warn('Platform GitHub event log returned a malformed event', {
            repositoryId,
            eventId: event.id,
          });
          continue;
        }
        if (isFactoryClosureEvent(parsed)) {
          await this.#ingestFactoryEvent?.(parsed);
        }
        const result = await this.#dispatch(parsed, {
          controller: this.#controller,
          listSubscriptions: (target, options) =>
            listPullRequestSubscriptionsForWebhook(target, options, this.#github.integrationStorage),
          retireSubscription: (id, status) =>
            retirePullRequestSubscription(id, status, this.#github.integrationStorage),
          isAuthorizedSender: notification => this.#isAuthorizedSender(notification),
          onTargetError: (subscription, error) => {
            this.deps?.logger.error('Platform GitHub event delivery failed for a subscription', {
              subscriptionId: subscription.id,
              resourceId: subscription.resourceId,
              threadId: subscription.threadId,
              error: error instanceof Error ? error.message : String(error),
            });
          },
        });
        if (result.failed > 0) {
          throw new Error(
            `Platform GitHub event ${event.deliveryId} failed for ${result.failed} subscribed target(s).`,
          );
        }
      }

      if (page.nextCursor === ('afterEventId' in cursor ? cursor.afterEventId : undefined)) return;
      this.#settings.repositories[key] = { afterEventId: page.nextCursor };
      await this.#saveSettings();
    }
  }

  async #isAuthorizedSender(notification: GithubWebhookNotification): Promise<boolean> {
    if (!AUTHOR_GATED_KINDS.has(notification.kind)) return true;
    const sender = notification.metadata.sender;
    const repository = notification.metadata.repository;
    if (!sender || !repository) return false;
    if (AUTHORIZED_BOTS.has(sender)) return true;

    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), PERMISSION_CHECK_TIMEOUT_MS);
    try {
      const permission = await this.#github.getRepositoryCollaboratorPermission(
        notification.metadata.installationId,
        repository,
        sender,
        abortController.signal,
      );
      return permission !== undefined && AUTHORIZED_PERMISSIONS.has(permission);
    } catch {
      return false;
    } finally {
      clearTimeout(timeout);
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

function normalizeSettings(value: PlatformGithubEventWorkerSettings | null): PlatformGithubEventWorkerSettings {
  if (!value || value.version !== 1 || !value.repositories || typeof value.repositories !== 'object') {
    return { version: 1, repositories: {} };
  }
  return { version: 1, repositories: { ...value.repositories } };
}

function isFactoryClosureEvent(event: ParsedGithubWebhook): boolean {
  return (event.event === 'issues' || event.event === 'pull_request') && event.payload.action === 'closed';
}

function parseEvent(event: EventLogEntry): ParsedGithubWebhook | null {
  if (
    !event.id ||
    !event.deliveryId ||
    !SUPPORTED_EVENTS.has(event.event) ||
    !event.payload ||
    typeof event.payload !== 'object' ||
    Array.isArray(event.payload)
  ) {
    return null;
  }
  return {
    event: event.event,
    deliveryId: event.deliveryId,
    payload: event.payload as Record<string, unknown>,
  };
}

function retryDelay(error: unknown, fallbackMs: number): number {
  if (error instanceof PlatformApiError && error.status === 429 && error.retryAfterSeconds !== null) {
    return Math.max(fallbackMs, error.retryAfterSeconds * 1_000);
  }
  return fallbackMs;
}
