import { randomUUID } from 'node:crypto';

import { isLeaseProvider, NoopLeaseProvider } from '@mastra/core/events';
import type { LeaseProvider, PubSub } from '@mastra/core/events';
import { MastraWorker } from '@mastra/core/worker';
import type { WorkerDeps } from '@mastra/core/worker';

import type {
  ConfiguredExternalRepositoryKey,
  ExternalRepositoryProjectTarget,
  SourceControlRepository,
} from '../../storage/domains/source-control/base.js';
import type { GithubIssueReconciler } from './issue-reconciler.js';
import type { GithubPullRequestReconciler, ReconcileRepository } from './rules.js';

// Webhooks are the primary sync; the sweeps only catch drift, so hourly.
export const DEFAULT_GITHUB_RECONCILE_INTERVAL_MS = 60 * 60_000;
const MIN_LEASE_TTL_MS = 30_000;
const LEASE_KEY = 'github:pull-request-reconcile';

/** Storage slice the sweep needs to turn configured repositories into targets. */
export interface GithubReconcileRepositorySource {
  projectRepositories: {
    listConfiguredExternalKeys(): Promise<ConfiguredExternalRepositoryKey[]>;
    listByExternalRepository(args: {
      installationExternalId: string;
      repositoryExternalId: string;
    }): Promise<ExternalRepositoryProjectTarget[]>;
  };
  repositories: {
    findByExternalId(args: { orgId: string; externalId: string }): Promise<SourceControlRepository | null>;
  };
}

export interface GithubReconcileWorkerConfig {
  reconcile?: GithubPullRequestReconciler;
  reconcileIssues?: GithubIssueReconciler;
  sourceControl: GithubReconcileRepositorySource;
  intervalMs?: number;
  issueIntervalMs?: number;
  now?: () => number;
}

/**
 * Periodic GitHub state sweeps for the self-hosted integration. Pull requests
 * drive review cards and issues drive work cards, but both share discovery and
 * a lease so replicas never sweep the same configured repositories together.
 */
export class GithubReconcileWorker extends MastraWorker {
  readonly name = 'github-pull-request-reconcile';

  readonly #reconcile: GithubPullRequestReconciler | undefined;
  readonly #reconcileIssues: GithubIssueReconciler | undefined;
  readonly #sourceControl: GithubReconcileRepositorySource;
  readonly #intervalMs: number;
  readonly #issueIntervalMs: number;
  readonly #leaseTtlMs: number;
  readonly #leaseOwner = randomUUID();
  readonly #now: () => number;

  #running = false;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #inFlight: Promise<void> | undefined;
  #leaseProvider: LeaseProvider = NoopLeaseProvider;
  #nextPullRequestReconcileAt = 0;
  #nextIssueReconcileAt = 0;

  constructor(config: GithubReconcileWorkerConfig) {
    super();
    if (!config.reconcile && !config.reconcileIssues) {
      throw new Error('GitHub reconcile worker requires a pull request or issue reconciler.');
    }
    this.#reconcile = config.reconcile;
    this.#reconcileIssues = config.reconcileIssues;
    this.#sourceControl = config.sourceControl;
    this.#intervalMs = config.intervalMs ?? DEFAULT_GITHUB_RECONCILE_INTERVAL_MS;
    this.#issueIntervalMs = config.issueIntervalMs ?? this.#intervalMs;
    if (!Number.isFinite(this.#intervalMs) || this.#intervalMs <= 0) {
      throw new Error('GitHub pull request reconcile interval must be a positive number.');
    }
    if (!Number.isFinite(this.#issueIntervalMs) || this.#issueIntervalMs <= 0) {
      throw new Error('GitHub issue reconcile interval must be a positive number.');
    }
    this.#leaseTtlMs = Math.max(MIN_LEASE_TTL_MS, Math.min(this.#intervalMs, this.#issueIntervalMs) * 3);
    this.#now = config.now ?? Date.now;
  }

  async init(deps: WorkerDeps): Promise<void> {
    await super.init(deps);
    this.#leaseProvider = getLeaseProvider(deps.pubsub);
  }

  async start(): Promise<void> {
    if (this.#running) return;
    if (!this.deps) throw new Error('GithubReconcileWorker: call init() before start()');
    this.#running = true;
    this.deps.logger.info('GitHub reconcile worker started', {
      pullRequestIntervalMs: this.#reconcile ? this.#intervalMs : undefined,
      issueIntervalMs: this.#reconcileIssues ? this.#issueIntervalMs : undefined,
    });
    // Sweep on boot: a restart is exactly when webhooks were most likely missed.
    this.#schedule(0);
  }

  async stop(): Promise<void> {
    if (!this.#running) return;
    this.#running = false;
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = undefined;
    await this.#inFlight;
  }

  get isRunning(): boolean {
    return this.#running;
  }

  #schedule(delayMs: number): void {
    if (!this.#running) return;
    this.#timer = setTimeout(() => {
      this.#timer = undefined;
      const run = this.#tick().finally(() => {
        this.#inFlight = undefined;
        this.#schedule(this.#nextDelay());
      });
      this.#inFlight = run;
    }, delayMs);
    this.#timer.unref?.();
  }

  #nextDelay(): number {
    const now = this.#now();
    const due = [
      this.#reconcile ? this.#nextPullRequestReconcileAt : undefined,
      this.#reconcileIssues ? this.#nextIssueReconcileAt : undefined,
    ].filter((at): at is number => at !== undefined);
    return Math.max(0, Math.min(...due) - now);
  }

  async #tick(): Promise<void> {
    const now = this.#now();
    const reconcilePullRequests = Boolean(this.#reconcile && now >= this.#nextPullRequestReconcileAt);
    const reconcileIssues = Boolean(this.#reconcileIssues && now >= this.#nextIssueReconcileAt);
    if (!reconcilePullRequests && !reconcileIssues) return;
    if (reconcilePullRequests) this.#nextPullRequestReconcileAt = now + this.#intervalMs;
    if (reconcileIssues) this.#nextIssueReconcileAt = now + this.#issueIntervalMs;

    // Replicas share one sweep: the ingress dedupes duplicate writes, but the
    // reads still burn the installation's rate limit.
    const lease = await this.#leaseProvider
      .acquireLease(LEASE_KEY, this.#leaseOwner, this.#leaseTtlMs)
      .catch(() => ({ acquired: false }));
    if (!lease.acquired) return;

    let hasLease = true;
    const renewalTimer = setInterval(
      () => {
        void this.#leaseProvider
          .renewLease(LEASE_KEY, this.#leaseOwner, this.#leaseTtlMs)
          .then(renewed => {
            if (!renewed) {
              hasLease = false;
              clearInterval(renewalTimer);
              this.deps?.logger.warn('GitHub reconcile lease was lost mid-sweep; aborting further writes');
            }
          })
          .catch(error => {
            hasLease = false;
            clearInterval(renewalTimer);
            this.deps?.logger.warn('GitHub reconcile lease renewal failed; aborting further writes', {
              error: error instanceof Error ? error.message : String(error),
            });
          });
      },
      Math.max(1_000, Math.floor(this.#leaseTtlMs / 3)),
    );
    renewalTimer.unref?.();

    try {
      const targets = await this.#targets();
      if (targets.length === 0) return;

      if (reconcilePullRequests && this.#reconcile) {
        const startedAt = Date.now();
        try {
          const { errors, ...counts } = await this.#reconcile(targets);
          const context = { ...counts, candidateRepositories: targets.length, durationMs: Date.now() - startedAt };
          if (counts.failed > 0) {
            this.deps?.logger.warn('GitHub pull request reconcile sweep completed with failures', { ...context, errors });
          } else if (counts.merged > 0 || counts.closed > 0) {
            this.deps?.logger.info('GitHub pull request reconcile replayed missed merges/closes', context);
          } else {
            this.deps?.logger.debug('GitHub pull request reconcile sweep completed', context);
          }
        } catch (error) {
          this.deps?.logger.warn('GitHub pull request reconcile sweep failed', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      if (reconcileIssues && this.#reconcileIssues && hasLease) {
        const startedAt = Date.now();
        try {
          const { errors, ...counts } = await this.#reconcileIssues(targets);
          const context = { ...counts, candidateRepositories: targets.length, durationMs: Date.now() - startedAt };
          if (counts.failed > 0) {
            this.deps?.logger.warn('GitHub issue reconcile sweep completed with failures', { ...context, errors });
          } else if (counts.closed > 0) {
            this.deps?.logger.info('GitHub issue reconcile replayed closed work items', context);
          } else if (counts.updated > 0) {
            this.deps?.logger.info('GitHub issue reconcile patched stale metadata', context);
          } else {
            this.deps?.logger.debug('GitHub issue reconcile sweep completed', context);
          }
        } catch (error) {
          this.deps?.logger.warn('GitHub issue reconcile sweep failed', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      } else if (reconcileIssues && this.#reconcileIssues && !hasLease) {
        this.deps?.logger.debug('GitHub issue reconcile skipped: lease lost during pull-request sweep');
      }

    } finally {
      clearInterval(renewalTimer);
      if (hasLease) {
        await this.#leaseProvider.releaseLease(LEASE_KEY, this.#leaseOwner).catch(() => undefined);
      }
    }
  }

  /**
   * Configured (installation, repository) pairs resolved to the numeric ids and
   * slug the sweep addresses GitHub with. A pair whose repository row is gone
   * is skipped rather than failing the sweep for the others.
   */
  async #targets(): Promise<ReconcileRepository[]> {
    const keys = await this.#sourceControl.projectRepositories.listConfiguredExternalKeys();
    const targets: ReconcileRepository[] = [];
    for (const key of keys) {
      const installationId = Number(key.installationExternalId);
      const repositoryId = Number(key.repositoryExternalId);
      if (!Number.isSafeInteger(installationId) || !Number.isSafeInteger(repositoryId)) continue;
      const projects = await this.#sourceControl.projectRepositories.listByExternalRepository(key);
      const orgId = projects[0]?.orgId;
      if (!orgId) continue;
      const repository = await this.#sourceControl.repositories.findByExternalId({
        orgId,
        externalId: key.repositoryExternalId,
      });
      if (!repository?.slug) continue;
      targets.push({ id: repositoryId, fullName: repository.slug, installationId });
    }
    return targets;
  }
}

function getLeaseProvider(pubsub: PubSub): LeaseProvider {
  const getProvider = (pubsub as PubSub & { getLeaseProvider?: () => LeaseProvider | undefined }).getLeaseProvider;
  if (typeof getProvider === 'function') return getProvider.call(pubsub) ?? NoopLeaseProvider;
  return isLeaseProvider(pubsub) ? pubsub : NoopLeaseProvider;
}
