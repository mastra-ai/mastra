import { isLeaseProvider, NoopLeaseProvider } from '@mastra/core/events';
import type { LeaseProvider, PubSub } from '@mastra/core/events';
import { MastraWorker } from '@mastra/core/worker';
import type { WorkerDeps } from '@mastra/core/worker';

import { recordReconcileSweep, recordSweepWorkerStarted } from '../../metrics/intake.js';
import type {
  ConfiguredExternalRepositoryKey,
  ExternalRepositoryProjectTarget,
  SourceControlRepository,
} from '../../storage/domains/source-control/base.js';
import type { DependabotSync } from '../dependabot/sync.js';
import type { GithubIssueReconciler } from './issue-reconciler.js';
import type { GithubPullRequestDiscovery, GithubPullRequestReconciler, ReconcileRepository } from './rules.js';

// Webhooks are the primary sync; the sweeps only catch drift, so hourly.
export const DEFAULT_GITHUB_RECONCILE_INTERVAL_MS = 60 * 60_000;
// Missed-open discovery costs one listing per repository, not a fetch per card,
// so it runs at the issue sweep's cadence: a lost `opened` webhook surfaces in minutes.
export const DEFAULT_GITHUB_PR_DISCOVERY_INTERVAL_MS = 5 * 60_000;
const MIN_LEASE_TTL_MS = 30_000;
const DEFAULT_NAME = 'github-pull-request-reconcile';
const DEFAULT_LEASE_KEY = 'github:pull-request-reconcile';
/** Bursts of requested runs (e.g. Dependabot alert events) collapse into one sweep. */
const DEFAULT_REQUEST_DEBOUNCE_MS = 5_000;

/** A sweep `requestRun` can ask for. */
export type GithubReconcileSweep = 'pull-requests' | 'issues' | 'discovery' | 'dependabot';

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
  /** Worker name. Defaults to `github-pull-request-reconcile`. */
  name?: string;
  /** Lease shared by replicas. Two integrations in one deployment must not share one. */
  leaseKey?: string;
  reconcile?: GithubPullRequestReconciler;
  reconcileIssues?: GithubIssueReconciler;
  discover?: GithubPullRequestDiscovery;
  syncDependabot?: DependabotSync;
  /** Runs before a pull request or issue sweep, with the targets it will sweep (e.g. to refresh renamed slugs). */
  beforeSweep?: (targets: ReconcileRepository[]) => Promise<void>;
  sourceControl: GithubReconcileRepositorySource;
  intervalMs?: number;
  issueIntervalMs?: number;
  /** Defaults to five minutes, or the pull request interval when that is shorter. */
  discoveryIntervalMs?: number;
  /** Defaults to the pull request interval. */
  dependabotIntervalMs?: number;
  /** How long `requestRun` waits for more requests before sweeping. */
  requestDebounceMs?: number;
  now?: () => number;
}

/**
 * Periodic GitHub state sweeps for the self-hosted integration. Pull requests
 * drive review cards and issues drive work cards, but both share discovery and
 * a lease so replicas never sweep the same configured repositories together.
 */
export class GithubReconcileWorker extends MastraWorker {
  readonly name: string;

  readonly #leaseKey: string;
  readonly #reconcile: GithubPullRequestReconciler | undefined;
  readonly #reconcileIssues: GithubIssueReconciler | undefined;
  readonly #discover: GithubPullRequestDiscovery | undefined;
  readonly #syncDependabot: DependabotSync | undefined;
  readonly #beforeSweep: ((targets: ReconcileRepository[]) => Promise<void>) | undefined;
  readonly #sourceControl: GithubReconcileRepositorySource;
  readonly #intervalMs: number;
  readonly #issueIntervalMs: number;
  readonly #discoveryIntervalMs: number;
  readonly #dependabotIntervalMs: number;
  readonly #requestDebounceMs: number;
  readonly #leaseTtlMs: number;
  readonly #leaseOwner = globalThis.crypto.randomUUID();
  readonly #now: () => number;

  #running = false;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #inFlight: Promise<void> | undefined;
  #leaseProvider: LeaseProvider = NoopLeaseProvider;
  #nextPullRequestReconcileAt = 0;
  #nextIssueReconcileAt = 0;
  #nextDiscoveryAt = 0;
  #nextDependabotAt = 0;
  #requestTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(config: GithubReconcileWorkerConfig) {
    super();
    if (!config.reconcile && !config.reconcileIssues && !config.discover && !config.syncDependabot) {
      throw new Error('GitHub reconcile worker requires a pull request or issue reconciler.');
    }
    this.name = config.name ?? DEFAULT_NAME;
    this.#leaseKey = config.leaseKey ?? DEFAULT_LEASE_KEY;
    this.#reconcile = config.reconcile;
    this.#reconcileIssues = config.reconcileIssues;
    this.#discover = config.discover;
    this.#syncDependabot = config.syncDependabot;
    this.#beforeSweep = config.beforeSweep;
    this.#sourceControl = config.sourceControl;
    this.#intervalMs = config.intervalMs ?? DEFAULT_GITHUB_RECONCILE_INTERVAL_MS;
    this.#issueIntervalMs = config.issueIntervalMs ?? this.#intervalMs;
    this.#discoveryIntervalMs =
      config.discoveryIntervalMs ?? Math.min(DEFAULT_GITHUB_PR_DISCOVERY_INTERVAL_MS, this.#intervalMs);
    if (!Number.isFinite(this.#intervalMs) || this.#intervalMs <= 0) {
      throw new Error('GitHub pull request reconcile interval must be a positive number.');
    }
    if (!Number.isFinite(this.#issueIntervalMs) || this.#issueIntervalMs <= 0) {
      throw new Error('GitHub issue reconcile interval must be a positive number.');
    }
    if (!Number.isFinite(this.#discoveryIntervalMs) || this.#discoveryIntervalMs <= 0) {
      throw new Error('GitHub pull request discovery interval must be a positive number.');
    }
    this.#dependabotIntervalMs = config.dependabotIntervalMs ?? this.#intervalMs;
    if (!Number.isFinite(this.#dependabotIntervalMs) || this.#dependabotIntervalMs <= 0) {
      throw new Error('GitHub Dependabot sync interval must be a positive number.');
    }
    this.#requestDebounceMs = config.requestDebounceMs ?? DEFAULT_REQUEST_DEBOUNCE_MS;
    this.#leaseTtlMs = Math.max(
      MIN_LEASE_TTL_MS,
      Math.min(this.#intervalMs, this.#issueIntervalMs, this.#discoveryIntervalMs, this.#dependabotIntervalMs) * 3,
    );
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
    this.deps.logger.debug('GitHub reconcile worker started', {
      pullRequestIntervalMs: this.#reconcile ? this.#intervalMs : undefined,
      issueIntervalMs: this.#reconcileIssues ? this.#issueIntervalMs : undefined,
      pullRequestDiscoveryIntervalMs: this.#discover ? this.#discoveryIntervalMs : undefined,
      dependabotIntervalMs: this.#syncDependabot ? this.#dependabotIntervalMs : undefined,
    });
    // Sweep on boot: a restart is exactly when webhooks were most likely missed.
    if (this.#reconcile) recordSweepWorkerStarted('github', 'merge_close');
    if (this.#discover) recordSweepWorkerStarted('github', 'open');
    this.#schedule(0);
  }

  async stop(): Promise<void> {
    if (!this.#running) return;
    this.#running = false;
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = undefined;
    if (this.#requestTimer) clearTimeout(this.#requestTimer);
    this.#requestTimer = undefined;
    await this.#inFlight;
  }

  /**
   * Makes the named sweeps (every configured one by default) due now and
   * sweeps after a short debounce, so a burst of requests runs one sweep.
   */
  requestRun(sweeps?: readonly GithubReconcileSweep[]): void {
    const due = new Set(sweeps ?? ['pull-requests', 'issues', 'discovery', 'dependabot']);
    const now = this.#now();
    if (due.has('pull-requests')) this.#nextPullRequestReconcileAt = Math.min(this.#nextPullRequestReconcileAt, now);
    if (due.has('issues')) this.#nextIssueReconcileAt = Math.min(this.#nextIssueReconcileAt, now);
    if (due.has('discovery')) this.#nextDiscoveryAt = Math.min(this.#nextDiscoveryAt, now);
    if (due.has('dependabot')) this.#nextDependabotAt = Math.min(this.#nextDependabotAt, now);
    if (!this.#running || this.#inFlight || this.#requestTimer) return;
    this.#requestTimer = setTimeout(() => {
      this.#requestTimer = undefined;
      if (!this.#running || this.#inFlight) return;
      if (this.#timer) clearTimeout(this.#timer);
      this.#timer = undefined;
      this.#run();
    }, this.#requestDebounceMs);
    this.#requestTimer.unref?.();
  }

  get isRunning(): boolean {
    return this.#running;
  }

  #schedule(delayMs: number): void {
    if (!this.#running) return;
    this.#timer = setTimeout(() => {
      this.#timer = undefined;
      this.#run();
    }, delayMs);
    this.#timer.unref?.();
  }

  #run(): void {
    this.#inFlight = this.#tick().finally(() => {
      this.#inFlight = undefined;
      this.#schedule(this.#nextDelay());
    });
  }

  #nextDelay(): number {
    const now = this.#now();
    const due = [
      this.#reconcile ? this.#nextPullRequestReconcileAt : undefined,
      this.#reconcileIssues ? this.#nextIssueReconcileAt : undefined,
      this.#discover ? this.#nextDiscoveryAt : undefined,
      this.#syncDependabot ? this.#nextDependabotAt : undefined,
    ].filter((at): at is number => at !== undefined);
    return Math.max(0, Math.min(...due) - now);
  }

  async #tick(): Promise<void> {
    const now = this.#now();
    const reconcilePullRequests = Boolean(this.#reconcile && now >= this.#nextPullRequestReconcileAt);
    const reconcileIssues = Boolean(this.#reconcileIssues && now >= this.#nextIssueReconcileAt);
    const discoverPullRequests = Boolean(this.#discover && now >= this.#nextDiscoveryAt);
    const syncDependabot = Boolean(this.#syncDependabot && now >= this.#nextDependabotAt);
    if (!reconcilePullRequests && !reconcileIssues && !discoverPullRequests && !syncDependabot) return;
    if (reconcilePullRequests) this.#nextPullRequestReconcileAt = now + this.#intervalMs;
    if (reconcileIssues) this.#nextIssueReconcileAt = now + this.#issueIntervalMs;
    if (discoverPullRequests) this.#nextDiscoveryAt = now + this.#discoveryIntervalMs;
    if (syncDependabot) this.#nextDependabotAt = now + this.#dependabotIntervalMs;

    // Replicas share one sweep: the ingress dedupes duplicate writes, but the
    // reads still burn the installation's rate limit.
    const lease = await this.#leaseProvider
      .acquireLease(this.#leaseKey, this.#leaseOwner, this.#leaseTtlMs)
      .catch(() => ({ acquired: false }));
    if (!lease.acquired) return;

    let hasLease = true;
    const renewalTimer = setInterval(
      () => {
        void this.#leaseProvider
          .renewLease(this.#leaseKey, this.#leaseOwner, this.#leaseTtlMs)
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
      if (targets.length === 0) {
        // Nothing to sweep is a clean sweep, not a stalled one.
        if (reconcilePullRequests) recordReconcileSweep('github', 'merge_close', { replayed: 0, ok: true });
        if (discoverPullRequests) recordReconcileSweep('github', 'open', { replayed: 0, ok: true });
        return;
      }

      if ((reconcilePullRequests || reconcileIssues) && this.#beforeSweep) {
        await this.#beforeSweep(targets).catch(error => {
          this.deps?.logger.warn('GitHub reconcile pre-sweep hook failed', {
            error: error instanceof Error ? error.message : String(error),
          });
        });
      }

      if (syncDependabot && this.#syncDependabot) {
        const startedAt = Date.now();
        try {
          const { errors, ...counts } = await this.#syncDependabot(targets);
          const context = { ...counts, candidateRepositories: targets.length, durationMs: Date.now() - startedAt };
          if (counts.failed > 0) {
            this.deps?.logger.warn('GitHub Dependabot sync completed with failures', { ...context, errors });
          } else {
            this.deps?.logger.info('GitHub Dependabot sync completed', context);
          }
        } catch (error) {
          this.deps?.logger.warn('GitHub Dependabot sync failed', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      if (reconcilePullRequests && this.#reconcile && hasLease) {
        const startedAt = Date.now();
        try {
          const { errors, ...counts } = await this.#reconcile(targets);
          recordReconcileSweep('github', 'merge_close', {
            replayed: counts.merged + counts.closed,
            ok: counts.failed === 0,
          });
          const context = { ...counts, candidateRepositories: targets.length, durationMs: Date.now() - startedAt };
          if (counts.failed > 0) {
            this.deps?.logger.warn('GitHub pull request reconcile sweep completed with failures', {
              ...context,
              errors,
            });
          } else if (counts.merged > 0 || counts.closed > 0) {
            this.deps?.logger.info('GitHub pull request reconcile replayed missed merges/closes', context);
          } else {
            this.deps?.logger.debug('GitHub pull request reconcile sweep completed', context);
          }
        } catch (error) {
          recordReconcileSweep('github', 'merge_close', { replayed: 0, ok: false });
          this.deps?.logger.warn('GitHub pull request reconcile sweep failed', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      if (discoverPullRequests && this.#discover && hasLease) {
        const startedAt = Date.now();
        try {
          const { errors, ...counts } = await this.#discover(targets);
          recordReconcileSweep('github', 'open', {
            replayed: counts.created + counts.repaired,
            ok: counts.failed === 0,
          });
          const context = { ...counts, candidateRepositories: targets.length, durationMs: Date.now() - startedAt };
          if (counts.failed > 0) {
            this.deps?.logger.warn('GitHub pull request discovery completed with failures', { ...context, errors });
          } else if (counts.created > 0 || counts.repaired > 0) {
            this.deps?.logger.info('GitHub pull request discovery replayed missed opens', context);
          } else {
            this.deps?.logger.debug('GitHub pull request discovery completed', context);
          }
        } catch (error) {
          recordReconcileSweep('github', 'open', { replayed: 0, ok: false });
          this.deps?.logger.warn('GitHub pull request discovery failed', {
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
          } else if (counts.relabeled > 0) {
            this.deps?.logger.info('GitHub issue reconcile re-applied label routing', context);
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
        await this.#leaseProvider.releaseLease(this.#leaseKey, this.#leaseOwner).catch(() => undefined);
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
