import { randomUUID } from 'node:crypto';

import type { MountedMastraCode } from '@mastra/code-sdk';
import { isLeaseProvider, NoopLeaseProvider } from '@mastra/core/events';
import type { LeaseProvider, PubSub } from '@mastra/core/events';
import { MastraWorker } from '@mastra/core/worker';
import type { WorkerDeps } from '@mastra/core/worker';

import type { IntegrationStorageHandle } from '../../../storage/domains/integrations/base.js';
import type { GithubRepositoryPermission } from '../../github/integration.js';
import type { GithubIssueReconciler } from '../../github/issue-reconciler.js';
import type { GithubReconcileRepositorySource } from '../../github/reconcile-worker.js';
import type { GithubPullRequestReconciler, ReconcileRepository } from '../../github/rules.js';
import { listPullRequestSubscriptionsForWebhook, retirePullRequestSubscription } from '../../github/subscriptions.js';
import { dispatchGithubWebhook, isFactoryAppSender, resolveAuthorizedBots } from '../../github/webhook.js';
import type {
  GithubWebhookDispatchIntegration,
  GithubWebhookNotification,
  ParsedGithubWebhook,
} from '../../github/webhook.js';
import type { PlatformApiClient } from '../api-client.js';
import { PlatformApiError } from '../api-client.js';

const API_PREFIX = '/v1/server/github-app';
const DEFAULT_POLL_INTERVAL_MS = 20_000;
// Event polling is the primary sync; the sweeps only catch drift (missed
// events, cards ingested before polling was linked), so they run hourly.
const DEFAULT_RECONCILE_INTERVAL_MS = 60 * 60_000;
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
  // Pushes never reach the subscription dispatcher; they feed the factory
  // ingest path so base checkpoints rebuild on default-branch updates.
  'push',
]);
// Kinds emitted by `classifyGithubWebhook` that carry untrusted sender-authored
// content and must pass the sender authorization gate below.
const AUTHOR_GATED_KINDS = new Set([
  'issue-comment-created',
  'review-comment-created',
  'review-approved',
  'review-changes-requested',
  'review-submitted',
  'review-dismissed',
]);
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

type Repository = { id: number; fullName?: string; installationId: number };

export type PlatformGithubEventDispatchIntegration = GithubWebhookDispatchIntegration;

export interface PlatformGithubEventWorkerConfig {
  client: PlatformApiClient;
  controller: MountedMastraCode['controller'];
  github: PlatformGithubEventDispatchIntegration;
  storage: PlatformGithubEventStorage;
  /**
   * Source-control storage used to resolve the set of repositories the worker
   * should poll. The worker restricts itself to `(installation, repository)`
   * pairs linked to a factory project — the same set the reconciler uses —
   * so polling scales with Factory usage, not with the size of the underlying
   * GitHub org.
   */
  sourceControl: GithubReconcileRepositorySource;
  ingestFactoryEvent?: (event: ParsedGithubWebhook) => Promise<unknown>;
  reconcileFactoryState?: GithubPullRequestReconciler;
  reconcileIssuesFactoryState?: GithubIssueReconciler;
  /** When false the worker skips event tailing and only runs enabled reconciliation sweeps. */
  pollEventsEnabled?: boolean;
  intervalMs?: number;
  /** Legacy shared reconciliation cadence. */
  reconcileIntervalMs?: number;
  pullRequestReconcileIntervalMs?: number;
  issueReconcileIntervalMs?: number;
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
  readonly #reconcileFactoryState: GithubPullRequestReconciler | undefined;
  readonly #reconcileIssuesFactoryState: GithubIssueReconciler | undefined;
  readonly #pollEventsEnabled: boolean;
  readonly #pullRequestReconcileIntervalMs: number;
  readonly #issueReconcileIntervalMs: number;
  readonly #intervalMs: number;
  readonly #now: () => number;
  readonly #dispatch: typeof dispatchGithubWebhook;
  readonly #sourceControl: GithubReconcileRepositorySource;
  readonly #leaseOwner = randomUUID();

  #running = false;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #leaseRenewalTimer: ReturnType<typeof setInterval> | undefined;
  #inFlight: Promise<void> | undefined;
  #leaseProvider: LeaseProvider = NoopLeaseProvider;
  #leaseTtlMs: number;
  #hasLease = false;
  #startedAt = 0;
  // Negative infinity so the first tick always sweeps, whatever the clock reads.
  #lastPullRequestReconcileAt = Number.NEGATIVE_INFINITY;
  #lastIssueReconcileAt = Number.NEGATIVE_INFINITY;
  #settings: PlatformGithubEventWorkerSettings = { version: 1, repositories: {} };

  constructor(config: PlatformGithubEventWorkerConfig) {
    super();
    this.#client = config.client;
    this.#controller = config.controller;
    this.#github = config.github;
    this.#storage = config.storage;
    this.#ingestFactoryEvent = config.ingestFactoryEvent;
    this.#reconcileFactoryState = config.reconcileFactoryState;
    this.#reconcileIssuesFactoryState = config.reconcileIssuesFactoryState;
    this.#pollEventsEnabled = config.pollEventsEnabled ?? true;
    const legacyReconcileIntervalMs = config.reconcileIntervalMs ?? DEFAULT_RECONCILE_INTERVAL_MS;
    this.#pullRequestReconcileIntervalMs = config.pullRequestReconcileIntervalMs ?? legacyReconcileIntervalMs;
    this.#issueReconcileIntervalMs = config.issueReconcileIntervalMs ?? legacyReconcileIntervalMs;
    this.#intervalMs = config.intervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    if (!Number.isFinite(this.#intervalMs) || this.#intervalMs <= 0) {
      throw new Error('Platform GitHub event polling interval must be a positive number.');
    }
    if (!Number.isFinite(this.#pullRequestReconcileIntervalMs) || this.#pullRequestReconcileIntervalMs <= 0) {
      throw new Error('Platform GitHub pull request reconcile interval must be a positive number.');
    }
    if (!Number.isFinite(this.#issueReconcileIntervalMs) || this.#issueReconcileIntervalMs <= 0) {
      throw new Error('Platform GitHub issue reconcile interval must be a positive number.');
    }
    this.#leaseTtlMs = Math.max(
      MIN_LEASE_TTL_MS,
      Math.min(this.#intervalMs, this.#pullRequestReconcileIntervalMs, this.#issueReconcileIntervalMs) * 3,
    );
    this.#now = config.now ?? Date.now;
    this.#dispatch = config.dispatch ?? dispatchGithubWebhook;
    this.#sourceControl = config.sourceControl;
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
    let retryInMs = this.#pollEventsEnabled ? this.#intervalMs : this.#reconcileCadence();

    if (this.#pollEventsEnabled) {
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
    }

    await this.#maybeReconcile(repositories);
    return retryInMs;
  }

  #reconcileCadence(): number {
    const cadences = [
      this.#reconcileFactoryState ? this.#pullRequestReconcileIntervalMs : undefined,
      this.#reconcileIssuesFactoryState ? this.#issueReconcileIntervalMs : undefined,
    ].filter((interval): interval is number => interval !== undefined);
    return cadences.length > 0 ? Math.min(...cadences) : this.#intervalMs;
  }

  async #maybeReconcile(repositories: Repository[]): Promise<void> {
    if (!this.#running || !this.#hasLease) return;
    const now = this.#now();
    const reconcilePullRequests = Boolean(
      this.#reconcileFactoryState && now - this.#lastPullRequestReconcileAt >= this.#pullRequestReconcileIntervalMs,
    );
    const reconcileIssues = Boolean(
      this.#reconcileIssuesFactoryState && now - this.#lastIssueReconcileAt >= this.#issueReconcileIntervalMs,
    );
    if (!reconcilePullRequests && !reconcileIssues) return;
    if (reconcilePullRequests) this.#lastPullRequestReconcileAt = now;
    if (reconcileIssues) this.#lastIssueReconcileAt = now;

    const targets: ReconcileRepository[] = repositories.flatMap(repository =>
      repository.fullName
        ? [{ id: repository.id, fullName: repository.fullName, installationId: repository.installationId }]
        : [],
    );
    if (targets.length === 0) {
      this.deps?.logger.debug('Platform GitHub reconciliation skipped: no named repositories');
      return;
    }

    if (reconcilePullRequests && this.#reconcileFactoryState) {
      const startedAt = Date.now();
      try {
        const { errors, ...counts } = await this.#reconcileFactoryState(targets);
        const context = { ...counts, candidateRepositories: targets.length, durationMs: Date.now() - startedAt };
        if (counts.failed > 0) {
          this.deps?.logger.warn('Platform GitHub pull request reconcile sweep completed with failures', {
            ...context,
            errors,
          });
        } else if (counts.merged > 0 || counts.closed > 0) {
          this.deps?.logger.info('Platform GitHub pull request reconcile replayed missed merges/closes', context);
        } else {
          this.deps?.logger.info('Platform GitHub pull request reconcile sweep completed', context);
        }
      } catch (error) {
        this.deps?.logger.error('Platform GitHub pull request reconcile failed', {
          repositories: targets.length,
          durationMs: Date.now() - startedAt,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (reconcileIssues && this.#reconcileIssuesFactoryState && this.#hasLease) {
      const startedAt = Date.now();
      try {
        const { errors, ...counts } = await this.#reconcileIssuesFactoryState(targets);
        const context = { ...counts, candidateRepositories: targets.length, durationMs: Date.now() - startedAt };
        if (counts.failed > 0) {
          this.deps?.logger.warn('Platform GitHub issue reconcile sweep completed with failures', { ...context, errors });
        } else if (counts.closed > 0) {
          this.deps?.logger.info('Platform GitHub issue reconcile replayed closed work items', context);
        } else if (counts.updated > 0) {
          this.deps?.logger.info('Platform GitHub issue reconcile patched stale metadata', context);
        } else {
          this.deps?.logger.debug('Platform GitHub issue reconcile sweep completed', context);
        }
      } catch (error) {
        this.deps?.logger.error('Platform GitHub issue reconcile failed', {
          repositories: targets.length,
          durationMs: Date.now() - startedAt,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

  }

  /**
   * Configured `(installation, repository)` pairs — the same set the
   * reconciler sweeps — resolved to the numeric ids and slug the poll
   * addresses GitHub with. Repositories not linked to any factory project
   * cannot produce work for Factory, so polling and reconciling them is
   * wasted `/events` bandwidth and platform load.
   */
  async #discoverRepositories(): Promise<Repository[]> {
    const keys = await this.#sourceControl.projectRepositories.listConfiguredExternalKeys();
    const repositories = new Map<number, Repository>();
    for (const key of keys) {
      const installationId = Number(key.installationExternalId);
      const repositoryId = Number(key.repositoryExternalId);
      if (
        !Number.isSafeInteger(installationId) ||
        installationId <= 0 ||
        !Number.isSafeInteger(repositoryId) ||
        repositoryId <= 0
      ) {
        continue;
      }
      if (repositories.has(repositoryId)) continue;
      // A configured key exists per project link, so `listByExternalRepository`
      // always yields at least one row; the first row's orgId is enough to
      // look up the repository row for its slug.
      const projects = await this.#sourceControl.projectRepositories.listByExternalRepository(key);
      const orgId = projects[0]?.orgId;
      const repository = orgId
        ? await this.#sourceControl.repositories.findByExternalId({ orgId, externalId: key.repositoryExternalId })
        : null;
      repositories.set(repositoryId, {
        id: repositoryId,
        installationId,
        fullName: repository?.slug,
      });
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

      const pollStartedAt = performance.now();
      const page = await this.#client.request<{ events: EventLogEntry[]; nextCursor: string | null }>(
        'GET',
        `${API_PREFIX}/repositories/${repositoryId}/events?${query}`,
      );
      this.deps?.logger.debug('Platform GitHub repository event poll completed', {
        repositoryId,
        eventCount: page.events.length,
        latencyMs: Math.round(performance.now() - pollStartedAt),
      });
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
        if (isFactoryIngestedEvent(parsed)) {
          await this.#ingestFactoryEvent?.(parsed);
        }
        const result = await this.#dispatch(parsed, {
          controller: this.#controller,
          listSubscriptions: (target, options) =>
            listPullRequestSubscriptionsForWebhook(target, options, this.#github.integrationStorage),
          retireSubscription: (id, status) =>
            retirePullRequestSubscription(id, status, this.#github.integrationStorage),
          github: this.#github,
          isAuthorizedSender: notification => this.#isAuthorizedSender(notification),
          onTargetSkipped: subscription => {
            // Routine when a subscription's thread belongs to another
            // deployment, so this stays at debug rather than warning on a loop.
            this.deps?.logger.debug('Platform GitHub event skipped: thread is not held here', {
              deliveryId: event.deliveryId,
              subscriptionId: subscription.id,
              threadId: subscription.threadId,
            });
          },
          onSenderRejected: notification => {
            this.deps?.logger.debug('Platform GitHub event dropped: sender not authorized', {
              deliveryId: event.deliveryId,
              repository: notification.metadata.repository,
              sender: notification.metadata.sender,
              kind: notification.kind,
            });
          },
          onTargetError: (subscription, error) => {
            this.deps?.logger.error('Platform GitHub event delivery failed for a subscription', {
              deliveryId: event.deliveryId,
              subscriptionId: subscription.id,
              resourceId: subscription.resourceId,
              threadId: subscription.threadId,
              error: error instanceof Error ? error.message : String(error),
            });
          },
        });
        if (result.failed > 0) {
          this.deps?.logger.warn('Platform GitHub event completed with failed subscription deliveries', {
            repositoryId,
            deliveryId: event.deliveryId,
            delivered: result.delivered,
            failed: result.failed,
          });
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
    // Factory's own app has to clear the gate before the bot rules below, which
    // fail closed for every bot that is not explicitly allowlisted. GitHub
    // forbids an app from reviewing its own pull request, so `factory-review`
    // posts its verdict as a comment under this login and that comment is the
    // handoff the authoring agent wakes on.
    if (this.#github.identity?.matches(sender)) return true;
    if (isFactoryAppSender(sender, this.#github.slug)) return true;
    const normalizedSender = sender.toLowerCase();
    const authorizedBots = resolveAuthorizedBots(this.#github.authorizedBots);
    if (authorizedBots.has(normalizedSender)) return true;
    // Any other bot is gated purely by the allowlist: a GitHub App never holds a
    // collaborator permission under its sender login, so falling through to the
    // permission lookup would only fail closed after a wasted API call.
    if (notification.metadata.senderType?.toLowerCase() === 'bot' || normalizedSender.endsWith('[bot]')) {
      return false;
    }

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

// Events the polling worker forwards to the factory rules engine. Closures
// let the reconciler finalize cards; `synchronize` and `review_requested` on a
// pull request are the triggers the review board's re-review path listens for;
// submitted reviews and pull request comments are how review feedback reaches
// the agent that authored the branch. Direct-webhook consumers ingest every
// parsed event; the platform path gates because the remaining events (issue
// edits, comment edits and deletions) only interest the subscription
// dispatcher, not the factory rules.
function isFactoryIngestedEvent(event: ParsedGithubWebhook): boolean {
  if ((event.event === 'issues' || event.event === 'pull_request') && event.payload.action === 'closed') {
    return true;
  }
  if (event.event === 'pull_request') {
    const action = event.payload.action;
    // `opened` is what mints the Review card for a pull request. Without it a
    // factory-authored PR never gets reviewed on the polling path, which is the
    // only path a local deployment has.
    if (action === 'opened' || action === 'synchronize' || action === 'review_requested') return true;
  }
  if (event.event === 'pull_request_review' && event.payload.action === 'submitted') return true;
  if (event.event === 'issue_comment' && event.payload.action === 'created') return true;
  // Default-branch pushes drive base-checkpoint rebuilds
  // (`withBaseCheckpointWebhookTrigger` wraps the ingest callback).
  if (event.event === 'push') return true;
  return false;
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
