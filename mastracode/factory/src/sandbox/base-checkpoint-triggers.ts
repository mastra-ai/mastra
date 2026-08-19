/**
 * Trigger surface for base-checkpoint builds.
 *
 * Three entry points feed the {@link BaseCheckpointBuilder}:
 *   - repo connect: the projects route calls `onProjectRepositoryLinked` right
 *     after `projectRepositories.link()` succeeds — the initial build.
 *   - webhooks: `onWebhookEvent` classifies merged PRs and pushes targeting the
 *     repository's default branch and requests a rebuild for every factory
 *     project linked to that external repository.
 *   - reconcile sweep: `sweep()` walks configured repositories and rebuilds any
 *     whose checkpoint is missing or whose setup command changed since it was
 *     built (webhooks can be missed; setup edits invalidate metadata).
 *
 * Every trigger is fire-and-forget relative to its caller: classification
 * errors log, builds coalesce inside the builder, and nothing here ever blocks
 * webhook dispatch, route responses, or the sweep lease.
 */

import type { IMastraLogger } from '@mastra/core/logger';
import type { RepositoryAccess } from '../capabilities/version-control.js';
import type { ParsedGithubWebhook } from '../integrations/github/webhook.js';
import type {
  ExternalRepositoryProjectTarget,
  ProjectRepository,
  SourceControlStorageHandle,
} from '../storage/domains/source-control/base.js';
import type { BaseCheckpointBuilder, BaseCheckpointJob } from './base-checkpoint.js';
import { hashSetupCommand } from './base-checkpoint.js';
import type { SandboxFleet } from './fleet.js';

/** The slice of the GitHub integration the triggers need. */
export interface BaseCheckpointGithubSource {
  readonly sourceControlStorage: SourceControlStorageHandle;
  readonly versionControl?: {
    getRepositoryAccess(input: { orgId: string; repositoryId: string }): Promise<RepositoryAccess>;
  };
}

export interface BaseCheckpointTriggers {
  /** Kick the initial build after a repo is linked to a factory project. */
  onProjectRepositoryLinked(args: { orgId: string; projectRepository: ProjectRepository }): void;
  /** Classify a webhook and request rebuilds for default-branch updates. */
  onWebhookEvent(parsed: ParsedGithubWebhook): void;
  /** Rebuild stale/missing checkpoints for all configured repositories. */
  sweep(): Promise<void>;
}

/**
 * True when the webhook is a merged pull request into — or a push to — the
 * repository's default branch. Returns the external id pair used to find the
 * linked factory projects, or null when the event is not a rebuild trigger.
 */
export function classifyDefaultBranchUpdate(
  parsed: ParsedGithubWebhook,
): { installationExternalId: string; repositoryExternalId: string } | null {
  const payload = parsed.payload;
  const repository = asRecord(payload.repository);
  const installation = asRecord(payload.installation);
  const installationId = idString(installation?.id);
  const repositoryId = idString(repository?.id);
  const defaultBranch = typeof repository?.default_branch === 'string' ? repository.default_branch : null;
  if (!installationId || !repositoryId || !defaultBranch) return null;

  if (parsed.event === 'pull_request' && payload.action === 'closed') {
    const pullRequest = asRecord(payload.pull_request);
    const base = asRecord(pullRequest?.base);
    if (pullRequest?.merged === true && base?.ref === defaultBranch) {
      return { installationExternalId: installationId, repositoryExternalId: repositoryId };
    }
    return null;
  }
  if (parsed.event === 'push' && payload.ref === `refs/heads/${defaultBranch}`) {
    return { installationExternalId: installationId, repositoryExternalId: repositoryId };
  }
  return null;
}

/**
 * Rebuild sweep age bound: even when webhooks are healthy, a checkpoint older
 * than this is rebuilt so a missed default-branch webhook cannot pin sessions
 * to an old commit indefinitely.
 */
export const BASE_CHECKPOINT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** How many sweep-triggered checkpoint builds may run at once. */
const SWEEP_BUILD_CONCURRENCY = 3;

/**
 * A checkpoint is stale when absent, built against a different setup command,
 * or older than {@link BASE_CHECKPOINT_MAX_AGE_MS}.
 */
export function baseCheckpointIsStale(projectRepository: ProjectRepository, now: Date = new Date()): boolean {
  const checkpoint = projectRepository.baseCheckpoint;
  if (!checkpoint) return true;
  if (checkpoint.setupCommandHash !== hashSetupCommand(projectRepository.setupCommand)) return true;
  return now.getTime() - checkpoint.builtAt.getTime() > BASE_CHECKPOINT_MAX_AGE_MS;
}

export function createBaseCheckpointTriggers(options: {
  builder: BaseCheckpointBuilder;
  fleet: SandboxFleet;
  github: BaseCheckpointGithubSource;
  logger?: IMastraLogger;
}): BaseCheckpointTriggers {
  const { builder, fleet, github, logger } = options;
  const storage = github.sourceControlStorage;

  const jobFor = async (orgId: string, projectRepository: ProjectRepository): Promise<BaseCheckpointJob | null> => {
    const getRepositoryAccess = github.versionControl?.getRepositoryAccess.bind(github.versionControl);
    if (!fleet.enabled || !getRepositoryAccess) return null;
    const repository = await storage.repositories.get({ orgId, id: projectRepository.repositoryId });
    if (!repository) return null;
    return {
      projectRepositoryId: projectRepository.id,
      repoFullName: repository.slug,
      defaultBranch: repository.defaultBranch,
      setupCommand: projectRepository.setupCommand,
      workdir: fleet.computeWorkdir(repository.slug),
      getToken: async () => {
        const access = await getRepositoryAccess({ orgId, repositoryId: repository.id });
        const token = access.authorization?.token;
        if (!token) throw new Error(`No installation token available for ${repository.slug}`);
        return token;
      },
      storage,
    };
  };

  const request = async (orgId: string, projectRepository: ProjectRepository): Promise<void> => {
    const job = await jobFor(orgId, projectRepository);
    if (job) await builder.request(job);
  };

  const requestTargets = async (targets: ExternalRepositoryProjectTarget[]): Promise<void> => {
    for (const target of targets) {
      await request(target.orgId, target.projectRepository);
    }
  };

  const warn = (context: string, error: unknown) => {
    logger?.warn?.(
      `Base-checkpoint trigger failed (${context}): ${error instanceof Error ? error.message : String(error)}`,
    );
  };

  return {
    onProjectRepositoryLinked({ orgId, projectRepository }) {
      void request(orgId, projectRepository).catch(error => warn('repo-connect', error));
    },
    onWebhookEvent(parsed) {
      const key = classifyDefaultBranchUpdate(parsed);
      if (!key) return;
      void storage.projectRepositories
        .listByExternalRepository(key)
        .then(targets => requestTargets(targets))
        .catch(error => warn('webhook', error));
    },
    async sweep() {
      try {
        const keys = await storage.projectRepositories.listConfiguredExternalKeys();
        const stale: ExternalRepositoryProjectTarget[] = [];
        for (const key of keys) {
          const targets = await storage.projectRepositories.listByExternalRepository(key);
          stale.push(...targets.filter(target => baseCheckpointIsStale(target.projectRepository)));
        }
        // Builds run for minutes each; a sequential walk over many stale repos
        // would overrun the sweep lease TTL. Run them with bounded concurrency
        // so one sweep still finishes promptly without stampeding the fleet.
        const queue = [...stale];
        const workers = Array.from({ length: Math.min(SWEEP_BUILD_CONCURRENCY, queue.length) }, async () => {
          for (let target = queue.shift(); target; target = queue.shift()) {
            await request(target.orgId, target.projectRepository).catch(error => warn('sweep-build', error));
          }
        });
        await Promise.all(workers);
      } catch (error) {
        warn('sweep', error);
      }
    },
  };
}

/**
 * Wrap a webhook ingest callback so every parsed event also feeds the
 * base-checkpoint triggers. Trigger dispatch is fire-and-forget; the wrapped
 * ingest keeps its original awaited semantics.
 */
export function withBaseCheckpointWebhookTrigger(
  ingest: ((event: ParsedGithubWebhook) => Promise<unknown>) | undefined,
  triggers: BaseCheckpointTriggers | undefined,
): ((event: ParsedGithubWebhook) => Promise<unknown>) | undefined {
  if (!triggers) return ingest;
  return async event => {
    triggers.onWebhookEvent(event);
    return ingest ? ingest(event) : undefined;
  };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function idString(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string' && value) return value;
  return null;
}
