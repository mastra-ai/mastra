import { MastraWorker } from '@mastra/core/worker';

import type { VersionControl } from '../capabilities/version-control.js';
import type {
  FactoryProject,
  FactoryProjectsStorage,
  RecordFactoryProjectBuildInput,
} from '../storage/domains/projects/base.js';
import type { SourceControlStorageHandle } from '../storage/domains/source-control/base.js';
import { resolveProjectEnvironment } from '../workspace.js';
import { pendingTrigger, type BuildTriggerReason } from './build-triggers.js';
import { runEnvironmentBuild } from './build.js';
import { headsChanged, resolveCurrentHeads, type EnvironmentHeads } from './heads.js';
import { redactCredentials } from './redact.js';
import type { SandboxTemplateFactory } from './types.js';

export const DEFAULT_BUILD_WORKER_INTERVAL_MS = 60_000;
/**
 * A claim this old belongs to a worker that died mid-build and may be taken
 * over. Wider than the build runner's own 30 min bound, so a slow but live
 * build is never overtaken (and `recordBuild` refuses a stale holder anyway).
 */
export const STALE_BUILD_CLAIM_MS = 45 * 60_000;
const SWEEP_CONCURRENCY = 4;

export interface EnvironmentBuildSourceControl {
  storage: Pick<SourceControlStorageHandle, 'projectRepositories' | 'repositories'>;
  versionControl: Pick<VersionControl, 'getRepositoryAccess'>;
}

export interface EnvironmentPushEvent {
  orgId: string;
  factoryProjectId: string;
  repositoryExternalId: string;
  /** `refs/heads/<branch>` */
  ref: string;
  after: string;
}

export interface FactoryEnvironmentBuildWorkerOptions {
  projects: Pick<FactoryProjectsStorage, 'listAll' | 'get' | 'update' | 'claimBuild' | 'recordBuild'>;
  sourceControl: EnvironmentBuildSourceControl;
  sandboxTemplate: SandboxTemplateFactory;
  intervalMs?: number;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
  maxWaitMs?: number;
}

/**
 * Rebuilds platform environments on the triggers the factory configures:
 * an explicit request (config change, Build now), a push to a base branch
 * after the debounce and under the cap, or the schedule when a head moved.
 * Runs on every replica; `projects.claimBuild` (one `updateAtomic`) keeps
 * it to one build per factory.
 */
export class FactoryEnvironmentBuildWorker extends MastraWorker {
  readonly name = 'factory-environment-build';

  readonly #options: FactoryEnvironmentBuildWorkerOptions;
  readonly #intervalMs: number;
  readonly #now: () => Date;
  #running = false;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #inFlight: Promise<void> | undefined;
  /** Builds this replica is running, by project id; they outlive the tick that started them. */
  readonly #builds = new Map<string, Promise<void>>();

  constructor(options: FactoryEnvironmentBuildWorkerOptions) {
    super();
    this.#options = options;
    this.#intervalMs = options.intervalMs ?? DEFAULT_BUILD_WORKER_INTERVAL_MS;
    this.#now = options.now ?? (() => new Date());
  }

  async start(): Promise<void> {
    if (this.#running) return;
    if (!this.deps) throw new Error('FactoryEnvironmentBuildWorker: call init() before start()');
    this.#running = true;
    this.#schedule(0);
  }

  /**
   * Stops the sweep and waits for builds in flight. A build is bounded by
   * the runner (30 min); a host that exits sooner leaves the claim to go
   * stale and be taken over.
   */
  async stop(): Promise<void> {
    this.#running = false;
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = undefined;
    await this.#inFlight;
    await Promise.allSettled([...this.#builds.values()]);
  }

  /** Builds this replica is running right now; exposed for tests. */
  get activeBuilds(): number {
    return this.#builds.size;
  }

  get isRunning(): boolean {
    return this.#running;
  }

  #schedule(delayMs: number): void {
    if (!this.#running) return;
    this.#timer = setTimeout(() => {
      this.#timer = undefined;
      this.#inFlight = this.tick()
        .catch(error => this.deps?.logger.error('Factory environment build sweep failed', { error }))
        .finally(() => {
          this.#inFlight = undefined;
          this.#schedule(this.#intervalMs);
        });
    }, delayMs);
    this.#timer.unref?.();
  }

  /**
   * Record a push to a project's repository. Only a push to the link's pinned
   * ref (its branch, else the repository default) counts, and the only effect
   * is `last_push_at = now`: the next tick turns it into a build once the
   * debounce elapses, so a restart between the two loses nothing.
   */
  async notePush(event: EnvironmentPushEvent): Promise<boolean> {
    const { storage } = this.#options.sourceControl;
    const links = await storage.projectRepositories.listByProject({
      orgId: event.orgId,
      factoryProjectId: event.factoryProjectId,
    });
    for (const link of links) {
      if (!link.inEnvironment) continue;
      const repository = await storage.repositories.get({ orgId: event.orgId, id: link.repositoryId });
      if (!repository || repository.externalId !== event.repositoryExternalId) continue;
      if (event.ref !== `refs/heads/${link.branch || repository.defaultBranch}`) return false;
      // A branch deletion arrives as a push whose `after` is the zero sha.
      if (/^0+$/.test(event.after)) return false;
      await this.#options.projects.update({
        orgId: event.orgId,
        id: event.factoryProjectId,
        input: { lastPushAt: this.#now() },
      });
      return true;
    }
    return false;
  }

  /**
   * One sweep over every platform project; exposed for tests and the rig.
   * Projects are considered a few at a time and a build runs detached, so
   * one factory's long build never delays another's triggers.
   */
  async tick(): Promise<void> {
    const projects = (await this.#options.projects.listAll()).filter(project => project.sandboxProvider === 'platform');
    let index = 0;
    const next = async (): Promise<void> => {
      while (index < projects.length) {
        const project = projects[index++]!;
        if (this.#builds.has(project.id)) continue;
        try {
          await this.#consider(project);
        } catch (error) {
          this.deps?.logger.error('environment build sweep failed for a project', {
            factoryProjectId: project.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(SWEEP_CONCURRENCY, projects.length) }, next));
  }

  async #consider(project: FactoryProject): Promise<void> {
    const now = this.#now();
    if (!pendingTrigger(project, now)) return;

    // Claim first: the trigger is re-read on the locked row (the listing may
    // be minutes old), and the head lookups below run under the lease so no
    // replica calls GitHub for a project another one is building.
    let reason: BuildTriggerReason | null = null;
    let statusBeforeClaim: FactoryProject['lastBuildStatus'] = null;
    const claimed = await this.#options.projects.claimBuild({
      orgId: project.orgId,
      id: project.id,
      now,
      staleAfterMs: STALE_BUILD_CLAIM_MS,
      when: current => {
        reason = pendingTrigger(current, now);
        statusBeforeClaim = current.lastBuildStatus;
        return reason !== null;
      },
    });
    if (!claimed || !reason) return;
    const record = (result: RecordFactoryProjectBuildInput['result']) =>
      this.#options.projects.recordBuild({
        orgId: project.orgId,
        id: project.id,
        input: { now: this.#now(), claimedAt: now, result },
      });

    const environment = await resolveProjectEnvironment(this.#options.sourceControl.storage, claimed);
    if (!environment) {
      await record({ status: 'failed', error: 'No repository is in the environment.' });
      return;
    }
    let heads: EnvironmentHeads;
    try {
      heads = await resolveCurrentHeads(this.#options.sourceControl, {
        orgId: project.orgId,
        repositories: environment.repos.map(repo => ({
          id: repo.repositoryId,
          slug: repo.slug,
          branch: repo.defaultBranch,
        })),
      });
    } catch (error) {
      await record({
        status: 'failed',
        error: redactCredentials(error instanceof Error ? error.message : String(error)),
      });
      return;
    }
    // Unchanged heads only excuse a schedule tick from rebuilding a template
    // that is good; a failed or partial last build is retried once its backoff
    // has passed, since its heads already equal the ones it failed on.
    const lastBuildGood = statusBeforeClaim === 'ready' || statusBeforeClaim === null;
    if (reason === 'schedule' && lastBuildGood && !headsChanged(claimed.activeTemplateHeads, heads)) {
      this.deps?.logger.info('environment build skipped: heads unchanged', { factoryProjectId: project.id });
      await record({ status: 'skipped', lastBuildStatus: statusBeforeClaim });
      return;
    }

    this.deps?.logger.info('environment build starting', { factoryProjectId: project.id, reason });
    const build = runEnvironmentBuild(
      {
        projects: this.#options.projects,
        sourceControl: this.#options.sourceControl,
        sandboxTemplate: this.#options.sandboxTemplate,
        logger: this.deps?.logger,
        now: this.#now,
        ...(this.#options.sleep ? { sleep: this.#options.sleep } : {}),
        ...(this.#options.maxWaitMs !== undefined ? { maxWaitMs: this.#options.maxWaitMs } : {}),
      },
      { project: claimed, claimedAt: now, heads },
    )
      .then(async outcome => {
        if (outcome.status === 'skipped') {
          // The runner records nothing for a skipped build; release the claim
          // with the reason so the project is not stuck `building`.
          await record({
            status: 'failed',
            error:
              outcome.reason === 'no_template'
                ? 'The host provides no environment template for this factory.'
                : 'No repository is in the environment.',
          });
        }
      })
      .catch(error =>
        this.deps?.logger.error('environment build failed to record', {
          factoryProjectId: project.id,
          error: error instanceof Error ? error.message : String(error),
        }),
      )
      .finally(() => this.#builds.delete(project.id));
    this.#builds.set(project.id, build);
  }
}
