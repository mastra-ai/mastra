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

export const DEFAULT_GITHUB_RECONCILE_INTERVAL_MS = 5 * 60_000;
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
  reconcile: GithubPullRequestReconciler;
  /**
   * Optional issue-metadata sweep. When provided, the worker folds it into the
   * same tick as the PR reconciler, sharing the lease and the same
   * `ReconcileRepository` target discovery. Mirrors how webhook-driven ingress
   * flows both issues and PRs through one path.
   */
  reconcileIssues?: GithubIssueReconciler;
  sourceControl: GithubReconcileRepositorySource;
  intervalMs?: number;
}

/**
 * Periodic merge-state sweep for the self-hosted GitHub integration: webhooks
 * are the only other writer of merge state, and a deployment GitHub cannot
 * reach never receives one, so cards would stay open forever.
 */
export class GithubReconcileWorker extends MastraWorker {
  readonly name = 'github-pull-request-reconcile';

  readonly #reconcile: GithubPullRequestReconciler;
  readonly #reconcileIssues: GithubIssueReconciler | undefined;
  readonly #sourceControl: GithubReconcileRepositorySource;
  readonly #intervalMs: number;
  readonly #leaseTtlMs: number;
  readonly #leaseOwner = randomUUID();

  #running = false;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #inFlight: Promise<void> | undefined;
  #leaseProvider: LeaseProvider = NoopLeaseProvider;

  constructor(config: GithubReconcileWorkerConfig) {
    super();
    this.#reconcile = config.reconcile;
    this.#reconcileIssues = config.reconcileIssues;
    this.#sourceControl = config.sourceControl;
    this.#intervalMs = config.intervalMs ?? DEFAULT_GITHUB_RECONCILE_INTERVAL_MS;
    if (!Number.isFinite(this.#intervalMs) || this.#intervalMs <= 0) {
      throw new Error('GitHub pull request reconcile interval must be a positive number.');
    }
    this.#leaseTtlMs = Math.max(MIN_LEASE_TTL_MS, this.#intervalMs * 3);
  }

  async init(deps: WorkerDeps): Promise<void> {
    await super.init(deps);
    this.#leaseProvider = getLeaseProvider(deps.pubsub);
  }

  async start(): Promise<void> {
    if (this.#running) return;
    if (!this.deps) throw new Error('GithubReconcileWorker: call init() before start()');
    this.#running = true;
    this.deps.logger.info('GitHub pull request reconcile worker started', { intervalMs: this.#intervalMs });
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
        this.#schedule(this.#intervalMs);
      });
      this.#inFlight = run;
    }, delayMs);
    this.#timer.unref?.();
  }

  async #tick(): Promise<void> {
    // Replicas share one sweep: the ingress dedupes duplicate writes, but the
    // reads still burn the installation's rate limit.
    const lease = await this.#leaseProvider
      .acquireLease(LEASE_KEY, this.#leaseOwner, this.#leaseTtlMs)
      .catch(() => ({ acquired: false }));
    if (!lease.acquired) return;

    // Track whether this owner still holds the lease. A `renewLease` result
    // of `false` (or a renewal error) means another replica has taken the
    // lease. Once that happens the folded issue sweep must not run — it
    // would race the new owner's writes.
    let hasLease = true;
    // Folding the issue sweep into the same tick extends how long we hold the
    // lease. Renew periodically so a replica can't grab the expired lease and
    // start an overlapping sweep partway through this one.
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
      const startedAt = Date.now();
      const { errors, ...counts } = await this.#reconcile(targets);
      const context = { ...counts, candidateRepositories: targets.length, durationMs: Date.now() - startedAt };
      if (counts.failed > 0) {
        this.deps?.logger.warn('GitHub pull request reconcile sweep completed with failures', { ...context, errors });
      } else if (counts.merged > 0 || counts.closed > 0) {
        this.deps?.logger.info('GitHub pull request reconcile replayed missed merges/closes', context);
      } else {
        this.deps?.logger.debug('GitHub pull request reconcile sweep completed', context);
      }
      // Fold the issue-metadata sweep into the same tick so a single lease
      // covers both writers of card state for these repositories. Skip it
      // if the lease was lost during the PR sweep — running would race a
      // replica that already re-acquired the lease.
      if (this.#reconcileIssues && hasLease) {
        const issueStartedAt = Date.now();
        try {
          const { errors: issueErrors, ...issueCounts } = await this.#reconcileIssues(targets);
          const issueContext = {
            ...issueCounts,
            candidateRepositories: targets.length,
            durationMs: Date.now() - issueStartedAt,
          };
          if (issueCounts.failed > 0) {
            this.deps?.logger.warn('GitHub issue reconcile sweep completed with failures', {
              ...issueContext,
              errors: issueErrors,
            });
          } else if (issueCounts.updated > 0) {
            this.deps?.logger.info('GitHub issue reconcile patched stale metadata', issueContext);
          } else {
            this.deps?.logger.debug('GitHub issue reconcile sweep completed', issueContext);
          }
        } catch (issueError) {
          this.deps?.logger.warn('GitHub issue reconcile sweep failed', {
            error: issueError instanceof Error ? issueError.message : String(issueError),
          });
        }
      } else if (this.#reconcileIssues && !hasLease) {
        this.deps?.logger.debug('GitHub issue reconcile skipped: lease lost during pull-request sweep');
      }
    } catch (error) {
      this.deps?.logger.warn('GitHub pull request reconcile sweep failed', {
        error: error instanceof Error ? error.message : String(error),
      });
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
