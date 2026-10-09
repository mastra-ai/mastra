/**
 * One proactive environment build: decide whether a trigger should build,
 * hand the sandbox's `builds` capability a context identical to a session's,
 * and record the started build on the project row. Polling the build to its
 * end and pinning the active template is the workflow's second step
 * (`build-workflow.ts`), so a request that only needs the start answer never
 * waits on the provider.
 */

import type { FactorySandbox, FactorySandboxContext } from '@mastra/core/workspace';
import type { VersionControl } from '../capabilities/version-control.js';
import type { FactoryProject, FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { SourceControlStorageHandle } from '../storage/domains/source-control/base.js';
import { environmentSandboxContext, resolveProjectEnvironment } from '../workspace.js';
import type { SessionEnvironment } from '../workspace.js';
import { headsChanged, recordedHeadResolver, resolveCurrentHeads } from './heads.js';
import type { EnvironmentHeads } from './heads.js';

export const ENVIRONMENT_BUILD_TRIGGERS = ['manual', 'schedule', 'push', 'settings'] as const;
export type EnvironmentBuildTrigger = (typeof ENVIRONMENT_BUILD_TRIGGERS)[number];

export interface EnvironmentBuildSourceControl {
  storage: Pick<SourceControlStorageHandle, 'projectRepositories' | 'repositories'>;
  versionControl: Pick<VersionControl, 'getRepositoryAccess'>;
}

export interface EnvironmentBuildDeps {
  /** The factory's normalized sandbox; builds are unavailable without its `builds`. */
  sandbox: FactorySandbox | undefined;
  projects: Pick<FactoryProjectsStorage, 'getById' | 'update' | 'claimBuildAttempt' | 'pinActiveTemplate'>;
  /** Absent when the factory has no source-control integration to resolve heads with. */
  sourceControl: EnvironmentBuildSourceControl | undefined;
  logger?: { info: (msg: string, meta?: Record<string, unknown>) => void };
  now?: () => Date;
}

export interface EnvironmentBuildOutcome {
  outcome: 'started' | 'skipped' | 'unavailable' | 'failed';
  buildId?: string;
  templateId?: string;
  /** Why nothing started: `debounced`, `unchanged`, `no_environment`, `no_builds`, `no_source_control`, or an error. */
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
 * Start a build for `projectId` when `trigger` calls for one. `push` first
 * wins the leading-edge debounce claim; `schedule` and `push` skip when the
 * last build is ready and no head moved; `manual` and `settings` always
 * build. A provider that throws yields `failed` with the attempt still
 * recorded, so the next trigger sees a fresh attempt time, and the last build
 * id cleared, so a later `schedule` or `push` cannot mistake the previous
 * ready build for the current template.
 */
export async function runEnvironmentBuild(
  deps: EnvironmentBuildDeps,
  input: { projectId: string; trigger: EnvironmentBuildTrigger },
): Promise<EnvironmentBuildOutcome> {
  const builds = deps.sandbox?.builds;
  if (!builds) return { outcome: 'unavailable', reason: 'no_builds' };
  if (!deps.sourceControl) return { outcome: 'unavailable', reason: 'no_source_control' };
  const project = await deps.projects.getById({ id: input.projectId });
  if (!project) return { outcome: 'skipped', reason: 'no_environment' };
  const now = deps.now ?? (() => new Date());

  if (input.trigger === 'push') {
    const claimed = await deps.projects.claimBuildAttempt({
      id: project.id,
      debounceMinutes: project.buildPushDebounceMinutes,
      now: now(),
    });
    if (!claimed) return { outcome: 'skipped', reason: 'debounced' };
  }

  const environment = await resolveProjectEnvironment(deps.sourceControl.storage, project);
  if (environment.repos.length === 0) return { outcome: 'skipped', reason: 'no_environment' };

  try {
    const heads = await resolveEnvironmentHeads(deps.sourceControl, project, environment);
    const ctx = environmentBuildContext(project, environment, heads, deps.sourceControl.versionControl);
    const settings = environment.settings;

    if ((input.trigger === 'schedule' || input.trigger === 'push') && project.lastBuildId) {
      const last = await builds.get(ctx, settings, project.lastBuildId);
      if (last.status === 'ready' && !headsChanged(project.activeTemplateHeads, heads)) {
        return { outcome: 'skipped', reason: 'unchanged' };
      }
    }

    const started = await builds.start(ctx, settings);
    await deps.projects.update({
      orgId: project.orgId,
      id: project.id,
      input: {
        lastBuildId: started.buildId,
        ...(input.trigger === 'push' ? {} : { lastBuildAttemptedAt: now() }),
      },
    });
    deps.logger?.info('environment build started', {
      factoryProjectId: project.id,
      trigger: input.trigger,
      buildId: started.buildId,
      templateId: started.templateId,
    });
    return {
      outcome: 'started',
      buildId: started.buildId,
      ...(started.templateId ? { templateId: started.templateId } : {}),
      heads,
    };
  } catch (error) {
    const reason = redactCredentials(error instanceof Error ? error.message : String(error));
    await deps.projects.update({
      orgId: project.orgId,
      id: project.id,
      input: { lastBuildId: null, ...(input.trigger === 'push' ? {} : { lastBuildAttemptedAt: now() }) },
    });
    deps.logger?.info('environment build failed', { factoryProjectId: project.id, trigger: input.trigger, reason });
    return { outcome: 'failed', reason };
  }
}
