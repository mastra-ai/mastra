/**
 * Base-checkpoint build job.
 *
 * Keeps a continuously-refreshed "base checkpoint" per connected repo: a
 * sandbox filesystem with the default branch already cloned and the repo's
 * setup command already run, snapshotted under `repo-<projectRepositoryId>`.
 * New sessions boot from this checkpoint and only pay `git fetch` + branch
 * checkout instead of a cold clone + install.
 *
 * Builds are triggered on repo connect, merges/pushes to the default branch,
 * and the reconcile sweep. Rapid triggers coalesce: only one build runs per
 * repo at a time, and a trigger arriving mid-build marks it dirty so exactly
 * one follow-up build runs afterwards.
 *
 * Providers without real checkpoint support (capability-driven via
 * `supportsCheckpoints`) skip the snapshot — sessions keep using the cold
 * path. A failed build never blocks sessions either; it only logs, and the
 * reconcile sweep retries later.
 */

import { createHash } from 'node:crypto';
import type { IMastraLogger } from '@mastra/core/logger';
import { materializeRepo, runWorktreeSetup, sh, shellQuote } from '../integrations/github/sandbox.js';
import type { SourceControlStorageHandle } from '../storage/domains/source-control/base.js';
import type { MaterializationSandbox, SandboxBindingStore, SandboxFleet } from './fleet.js';

/** Provider checkpoint name for a repo's warm base image. */
export function baseCheckpointName(projectRepositoryId: string): string {
  return `repo-${projectRepositoryId}`;
}

/** Stable hash of the setup command, used to invalidate stale checkpoints. */
export function hashSetupCommand(setupCommand: string | null): string | null {
  if (!setupCommand) return null;
  return createHash('sha256').update(setupCommand).digest('hex');
}

/** Everything one build run needs; resolved by the trigger before enqueueing. */
export interface BaseCheckpointJob {
  projectRepositoryId: string;
  repoFullName: string;
  defaultBranch: string;
  setupCommand: string | null;
  /** Workdir the clone lives at — must match what sessions use. */
  workdir: string;
  /** Mint a fresh short-lived installation token for git operations. */
  getToken(): Promise<string>;
  storage: SourceControlStorageHandle;
  actingUserId?: string;
}

/**
 * Coalescing runner for base-checkpoint builds. One instance per server;
 * `request()` is fire-and-forget safe (never throws).
 */
export class BaseCheckpointBuilder {
  readonly #fleet: SandboxFleet;
  readonly #logger?: IMastraLogger;
  /** In-flight build per projectRepositoryId. */
  readonly #inflight = new Map<string, Promise<void>>();
  /** Repos re-triggered mid-build: run exactly one follow-up build. */
  readonly #dirty = new Map<string, BaseCheckpointJob>();

  constructor(options: { fleet: SandboxFleet; logger?: IMastraLogger }) {
    this.#fleet = options.fleet;
    this.#logger = options.logger;
  }

  /** True when a build for this repo is currently running. */
  isBuilding(projectRepositoryId: string): boolean {
    return this.#inflight.has(projectRepositoryId);
  }

  /**
   * Request a (re)build of the repo's base checkpoint. Coalesces with any
   * in-flight build for the same repo. Resolves when this request's build
   * (or the follow-up build it folded into) settles. Never rejects.
   */
  request(job: BaseCheckpointJob): Promise<void> {
    const key = job.projectRepositoryId;
    const existing = this.#inflight.get(key);
    if (existing) {
      // Fold into the in-flight build: remember the latest job so one
      // follow-up rebuild runs with fresh inputs once the current one ends.
      this.#dirty.set(key, job);
      return existing.then(() => {
        const pending = this.#inflight.get(key);
        return pending ?? Promise.resolve();
      });
    }

    const run = this.#buildSafely(job).then(() => {
      this.#inflight.delete(key);
      const followUp = this.#dirty.get(key);
      if (followUp) {
        this.#dirty.delete(key);
        return this.request(followUp);
      }
    });
    this.#inflight.set(key, run);
    return run;
  }

  /** One build attempt; logs failures instead of throwing. */
  async #buildSafely(job: BaseCheckpointJob): Promise<void> {
    try {
      await this.#build(job);
    } catch (error) {
      this.#logger?.warn?.(
        `Base-checkpoint build failed for ${job.repoFullName} (${job.projectRepositoryId}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async #build(job: BaseCheckpointJob): Promise<void> {
    if (!this.#fleet.enabled) return;

    const checkpointName = baseCheckpointName(job.projectRepositoryId);
    // Ephemeral binding: the builder VM is never reattached to — it exists
    // only to produce the checkpoint. Incremental rebuilds still happen
    // because the provider seeds the fresh VM from the previous checkpoint
    // (same `checkpointName`), so materializeRepo pulls instead of cloning.
    let boundSandboxId: string | null = null;
    const binding: SandboxBindingStore = {
      get sandboxId() {
        return boundSandboxId;
      },
      checkpointName,
      setSandboxId: async id => {
        boundSandboxId = id;
      },
      clear: async () => {
        boundSandboxId = null;
      },
    };

    const token = await job.getToken();
    let sandbox: MaterializationSandbox | undefined;
    try {
      sandbox = await this.#fleet.ensureSandbox(binding, { GH_TOKEN: token }, undefined, {
        workingDirectory: job.workdir,
        ...(job.actingUserId ? { actingUserId: job.actingUserId } : {}),
      });

      if (!sandbox.supportsCheckpoints || !sandbox.snapshot) {
        // No real checkpoint support — nothing to build; sessions use the
        // existing cold path.
        return;
      }

      // Clone (cold) or pull (VM seeded from the previous checkpoint).
      await materializeRepo({
        row: { id: job.projectRepositoryId, sandboxWorkdir: job.workdir, materializedAt: null },
        repoInfo: { repoFullName: job.repoFullName, defaultBranch: job.defaultBranch },
        sandbox,
        token,
        storage: { markMaterialized: async () => {} },
      });

      if (job.setupCommand) {
        await runWorktreeSetup(sandbox, job.workdir, job.setupCommand);
      }

      const head = await sh(sandbox, `git -C ${shellQuote(job.workdir)} rev-parse HEAD`);
      if (head.exitCode !== 0) {
        throw new Error(`Failed to read HEAD after materialize: ${head.stderr}`);
      }
      const sha = head.stdout.trim();

      await sandbox.snapshot();

      await job.storage.projectRepositories.setBaseCheckpoint({
        id: job.projectRepositoryId,
        checkpoint: {
          name: checkpointName,
          sha,
          builtAt: new Date(),
          setupCommandHash: hashSetupCommand(job.setupCommand),
        },
        expectedSetupCommand: job.setupCommand,
      });
    } finally {
      // Best-effort teardown: the builder VM is single-use. Route cleanup
      // through the fleet so the live-sandbox budget is released as well.
      await this.#fleet.teardownSandbox(binding, sandbox).catch(() => {});
    }
  }
}
