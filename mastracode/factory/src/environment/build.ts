/**
 * One proactive environment build: decide whether a trigger should build,
 * hand the sandbox's `builds` capability a context identical to a session's,
 * and record the started build on the project row. Polling the build to its
 * end and pinning the active template is the workflow's second step
 * (`build-workflow.ts`), so a request that only needs the start answer never
 * waits on the provider.
 */

import { createHash, randomUUID } from 'node:crypto';

import type { FactorySandbox, FactorySandboxContext } from '@mastra/core/workspace';
import type { VersionControl } from '../capabilities/version-control.js';
import type { FactoryProject, FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { SourceControlStorageHandle } from '../storage/domains/source-control/base.js';
import { environmentSandboxContext, resolveProjectEnvironment } from '../workspace.js';
import type { SessionEnvironment } from '../workspace.js';
import { headsChanged, recordedHeadResolver, resolveCurrentHeads } from './heads.js';
import type { EnvironmentHeads } from './heads.js';

export const ENVIRONMENT_BUILD_TRIGGERS = ['manual', 'schedule', 'push'] as const;
export type EnvironmentBuildTrigger = (typeof ENVIRONMENT_BUILD_TRIGGERS)[number];

export interface EnvironmentBuildSourceControl {
  storage: Pick<SourceControlStorageHandle, 'projectRepositories' | 'repositories'>;
  versionControl: Pick<VersionControl, 'getRepositoryAccess'>;
}

export interface EnvironmentBuildDeps {
  /** The factory's normalized sandbox; builds are unavailable without its `builds`. */
  sandbox: FactorySandbox | undefined;
  projects: Pick<
    FactoryProjectsStorage,
    'getById' | 'claimBuildAttempt' | 'claimBuildStart' | 'releaseBuildStart' | 'pinActiveTemplate'
  >;
  /** Absent when the factory has no source-control integration to resolve heads with. */
  sourceControl: EnvironmentBuildSourceControl | undefined;
  logger?: { info: (msg: string, meta?: Record<string, unknown>) => void };
  now?: () => Date;
}

export interface EnvironmentBuildOutcome {
  outcome: 'started' | 'skipped' | 'unavailable' | 'failed';
  buildId?: string;
  templateId?: string;
  /** Why nothing started: `debounced`, `starting` (another run is starting a build), `in_progress`, `unchanged`, `no_environment`, `no_builds`, `no_source_control`, or an error. */
  reason?: string;
  /** The heads the started build pins; the workflow stores them once the build is ready. */
  heads?: EnvironmentHeads;
}

/** The synthetic session id a project's build runs under; never a session. */
export function environmentBuildSessionId(projectId: string): string {
  return `environment-build:${projectId}`;
}

/**
 * A build or setup error may echo a clone URL or a token; strip URL userinfo
 * and GitHub token shapes before the message is stored, logged or shown.
 */
export function redactCredentials(message: string): string {
  return message.replace(/\/\/[^/\s@]+@/g, '//***@').replace(/\b(?:gh[pousr]|github_pat)_[A-Za-z0-9_]+/g, '***');
}

/** An error's message with credentials redacted, safe to log, store or return. */
export function errorReason(error: unknown): string {
  return redactCredentials(error instanceof Error ? error.message : String(error));
}

/**
 * The context an environment build (or a read of its status) hands the
 * provider: the same list form a session boots with, under the build's own
 * session id, with heads served from `heads` so the provider never resolves
 * them itself.
 */
export function environmentBuildContext(
  project: Pick<FactoryProject, 'id' | 'orgId'>,
  environment: SessionEnvironment,
  heads: EnvironmentHeads,
  versionControl: Pick<VersionControl, 'getRepositoryAccess'>,
): FactorySandboxContext {
  return {
    sessionId: environmentBuildSessionId(project.id),
    ...environmentSandboxContext(environment, {
      orgId: project.orgId,
      getRepositoryAccess: args => versionControl.getRepositoryAccess(args),
      resolveHead: recordedHeadResolver(heads),
    }),
  };
}

/**
 * Fingerprint of everything a build bakes into the template besides the
 * repository heads: provider settings, the repositories and their order,
 * their setup commands, the workspace setup command and the working
 * directory. A schedule or push skips a ready build only while this matches.
 */
export function environmentBuildInputs(environment: SessionEnvironment): string {
  const inputs = {
    settings: environment.settings,
    workspaceSetupCommand: environment.workspaceSetupCommand ?? null,
    workingDirectory: environment.workingDirectory ?? null,
    repos: environment.repos.map(repo => ({
      repositoryId: repo.repositoryId,
      templateBranch: repo.templateBranch,
      setupCommand: repo.setupCommand ?? null,
    })),
  };
  return createHash('sha256').update(JSON.stringify(inputs)).digest('hex');
}

/**
 * The current head of every environment repository's template branch, keyed
 * by slug. The template clones the repository default branch (a link's own
 * branch is the session's base, checked out after boot), so that is the
 * branch a build pins; sessions let the provider resolve the same head.
 */
export async function resolveEnvironmentHeads(
  sourceControl: EnvironmentBuildSourceControl,
  project: Pick<FactoryProject, 'orgId'>,
  environment: SessionEnvironment,
): Promise<EnvironmentHeads> {
  return resolveCurrentHeads(sourceControl, {
    orgId: project.orgId,
    repositories: environment.repos.map(repo => ({
      id: repo.repositoryId,
      slug: repo.slug,
      branch: repo.templateBranch,
    })),
  });
}

/**
 * How long one run may hold the build-start lease. It covers reading heads,
 * `builds.get` and `builds.start`; a run that crashes inside it blocks other
 * triggers only until it expires.
 */
export const BUILD_START_LEASE_MS = 10 * 60_000;

/**
 * Start a build for `projectId` when `trigger` calls for one. `push` first
 * wins the leading-edge debounce claim. Every trigger then takes the project's
 * build-start lease before reading build state, so overlapping manual,
 * scheduled and push runs never both start a build; a run that finds the lease
 * held skips as `starting`. Every trigger skips while the last build is still
 * running; `schedule` and `push` also skip when the last build is ready and
 * neither a head nor any other template input changed; `manual` otherwise
 * always builds. Saving settings never builds.
 *
 * The result is written as the lease is released, and only while this run
 * still holds it. A failed `builds.start` clears the last build id, so a later
 * `schedule` or `push` cannot mistake the previous ready build for the current
 * template; any other error keeps a running build's id. Any error yields
 * `failed` with the attempt still recorded.
 */
export async function runEnvironmentBuild(
  deps: EnvironmentBuildDeps,
  input: { projectId: string; trigger: EnvironmentBuildTrigger },
): Promise<EnvironmentBuildOutcome> {
  const builds = deps.sandbox?.builds;
  if (!builds) return { outcome: 'unavailable', reason: 'no_builds' };
  if (!deps.sourceControl) return { outcome: 'unavailable', reason: 'no_source_control' };
  const sourceControl = deps.sourceControl;
  const initial = await deps.projects.getById({ id: input.projectId });
  if (!initial) return { outcome: 'skipped', reason: 'no_environment' };
  const now = deps.now ?? (() => new Date());

  if (input.trigger === 'push') {
    const claimed = await deps.projects.claimBuildAttempt({
      id: initial.id,
      debounceMinutes: initial.buildPushDebounceMinutes,
      now: now(),
    });
    if (!claimed) return { outcome: 'skipped', reason: 'debounced' };
  }

  const token = randomUUID();
  if (!(await deps.projects.claimBuildStart({ id: initial.id, token, leaseMs: BUILD_START_LEASE_MS, now: now() }))) {
    return { outcome: 'skipped', reason: 'starting' };
  }
  const attempted = input.trigger === 'push' ? {} : { lastBuildAttemptedAt: now() };
  const release = (changes: Parameters<EnvironmentBuildDeps['projects']['releaseBuildStart']>[0]['changes'] = {}) =>
    deps.projects.releaseBuildStart({ id: initial.id, token, changes, now: now() });
  const failed = async (error: unknown, changes: Parameters<typeof release>[0]) => {
    const reason = errorReason(error);
    await release(changes);
    deps.logger?.info('environment build failed', { factoryProjectId: initial.id, trigger: input.trigger, reason });
    return { outcome: 'failed', reason } satisfies EnvironmentBuildOutcome;
  };

  let project: FactoryProject;
  let environment: SessionEnvironment;
  let heads: EnvironmentHeads;
  let ctx: FactorySandboxContext;
  let buildInputs: string;
  try {
    // Read build state only once this run holds the lease, so a run that
    // finished while this one waited has already recorded its build.
    project = (await deps.projects.getById({ id: initial.id })) ?? initial;
    environment = await resolveProjectEnvironment(sourceControl.storage, project);
    if (environment.repos.length === 0) {
      await release();
      return { outcome: 'skipped', reason: 'no_environment' };
    }
    heads = await resolveEnvironmentHeads(sourceControl, project, environment);
    ctx = environmentBuildContext(project, environment, heads, sourceControl.versionControl);
    buildInputs = environmentBuildInputs(environment);

    if (project.lastBuildId) {
      const last = await builds.get(ctx, environment.settings, project.lastBuildId);
      // Two runs polling one template fight over it (each poll resubmits its
      // own definition and the provider cancels the other), so a running
      // build is never joined by a second one, whatever asked.
      if (last.status === 'pending' || last.status === 'building') {
        await release();
        return { outcome: 'skipped', reason: 'in_progress', buildId: project.lastBuildId };
      }
      if (
        (input.trigger === 'schedule' || input.trigger === 'push') &&
        last.status === 'ready' &&
        !headsChanged(project.activeTemplateHeads, heads) &&
        project.lastBuildInputs === buildInputs
      ) {
        await release();
        return { outcome: 'skipped', reason: 'unchanged' };
      }
    }
  } catch (error) {
    return failed(error, attempted);
  }

  let started: Awaited<ReturnType<typeof builds.start>>;
  try {
    started = await builds.start(ctx, environment.settings);
  } catch (error) {
    // Only a failed start clears the last build: the previous one no longer
    // describes the template this project wants.
    return failed(error, { lastBuildId: null, lastBuildHeads: null, lastBuildInputs: null, ...attempted });
  }

  // The provider has started the build: from here on, no error clears it.
  const outcome: EnvironmentBuildOutcome = {
    outcome: 'started',
    buildId: started.buildId,
    ...(started.templateId ? { templateId: started.templateId } : {}),
    heads,
  };
  try {
    await release({ lastBuildId: started.buildId, lastBuildHeads: heads, lastBuildInputs: buildInputs, ...attempted });
    deps.logger?.info('environment build started', {
      factoryProjectId: project.id,
      trigger: input.trigger,
      buildId: started.buildId,
      templateId: started.templateId,
    });
  } catch (error) {
    deps.logger?.info('environment build started but not recorded', {
      factoryProjectId: project.id,
      buildId: started.buildId,
      reason: errorReason(error),
    });
  }
  return outcome;
}
