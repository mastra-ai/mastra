import { MastraWorker } from '@mastra/core/worker';

import type { VersionControl } from '../capabilities/version-control.js';
import type { FactoryProject, FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { SourceControlStorageHandle } from '../storage/domains/source-control/base.js';
import { resolveProjectEnvironment } from '../workspace.js';
import { capWindow, pendingTrigger } from './build-triggers.js';
import { runEnvironmentBuild } from './build.js';
import { headsChanged, resolveCurrentHeads, type EnvironmentHeads } from './heads.js';
import type { SandboxTemplateFactory } from './types.js';

export const DEFAULT_BUILD_WORKER_INTERVAL_MS = 60_000;
/** A claim this old belongs to a worker that died mid-build and may be taken over. */
export const STALE_BUILD_CLAIM_MS = 30 * 60_000;

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

  async stop(): Promise<void> {
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
      await this.#options.projects.update({
        orgId: event.orgId,
        id: event.factoryProjectId,
        input: { lastPushAt: this.#now() },
      });
      return true;
    }
    return false;
  }

  /** One sweep over every platform project; exposed for tests and the rig. */
  async tick(): Promise<void> {
    const projects = await this.#options.projects.listAll();
    for (const project of projects) {
      if (project.sandboxProvider !== 'platform') continue;
      try {
        await this.#consider(project);
      } catch (error) {
        this.deps?.logger.error('environment build sweep failed for a project', {
          factoryProjectId: project.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  async #consider(project: FactoryProject): Promise<void> {
    const now = this.#now();
    const reason = pendingTrigger(project, now);
    if (!reason) return;
    const environment = await resolveProjectEnvironment(this.#options.sourceControl.storage, project);
    if (!environment) return;

    const heads: EnvironmentHeads = await resolveCurrentHeads(this.#options.sourceControl, {
      orgId: project.orgId,
      repositories: environment.repos.map(repo => ({
        id: repo.repositoryId,
        slug: repo.slug,
        branch: repo.defaultBranch,
      })),
    });
    if (reason === 'schedule' && !headsChanged(project.activeTemplateHeads, heads)) {
      this.deps?.logger.info('environment build skipped: heads unchanged', { factoryProjectId: project.id });
      await this.#options.projects.update({
        orgId: project.orgId,
        id: project.id,
        input: { lastBuildAttemptedAt: now },
      });
      return;
    }

    const claimed = await this.#options.projects.claimBuild({
      orgId: project.orgId,
      id: project.id,
      now,
      staleAfterMs: STALE_BUILD_CLAIM_MS,
    });
    if (!claimed) return;

    if (reason === 'push') {
      const window = capWindow(project, now);
      await this.#options.projects.update({
        orgId: project.orgId,
        id: project.id,
        input: { buildWindowStartedAt: window.startedAt, buildWindowCount: window.count + 1 },
      });
    }
    this.deps?.logger.info('environment build starting', { factoryProjectId: project.id, reason });
    const outcome = await runEnvironmentBuild(
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
    );
    if (outcome.status === 'skipped') {
      // A skipped build records nothing itself; release the claim so the
      // project is not stuck `building` until the lease goes stale.
      await this.#options.projects.recordBuild({
        orgId: project.orgId,
        id: project.id,
        input: {
          now: this.#now(),
          claimedAt: now,
          result: {
            status: 'failed',
            error:
              outcome.reason === 'no_template'
                ? 'The host provides no environment template for this factory.'
                : 'No repository is in the environment.',
          },
        },
      });
    }
  }
}
