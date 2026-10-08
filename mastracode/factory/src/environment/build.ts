/**
 * One proactive environment build: resolve the current heads, hand the host's
 * template resolver a context identical to a session's, poll `.build()` until
 * the platform answers, and record the outcome on the project row.
 */

import type { VersionControl } from '../capabilities/version-control.js';
import type { FactorySandboxContext } from '../sandbox/session-sandbox.js';
import type { FactoryProject, FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { SourceControlStorageHandle } from '../storage/domains/source-control/base.js';
import { environmentSandboxContext, resolveProjectEnvironment } from '../workspace.js';
import { recordedHeadResolver, resolveCurrentHeads, type EnvironmentHeads } from './heads.js';
import { redactCredentials } from './redact.js';
import type { EnvironmentTemplateBuildResult, SandboxTemplateFactory } from './types.js';

export const DEFAULT_BUILD_POLL_MS = 15_000;
export const MAX_BUILD_WAIT_MS = 30 * 60_000;

export interface EnvironmentBuildDeps {
  projects: Pick<FactoryProjectsStorage, 'recordBuild'>;
  sourceControl: {
    storage: Pick<SourceControlStorageHandle, 'projectRepositories' | 'repositories'>;
    versionControl: Pick<VersionControl, 'getRepositoryAccess'>;
  };
  sandboxTemplate: SandboxTemplateFactory;
  logger?: { info: (msg: string, meta?: Record<string, unknown>) => void };
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
  /** Upper bound on one build's wall-clock, polling included. */
  maxWaitMs?: number;
}

export type EnvironmentBuildOutcome =
  | { status: 'ready'; templateId: string; heads: EnvironmentHeads }
  | { status: 'failed'; error: string }
  | { status: 'skipped'; reason: 'no_environment' | 'no_template' };

/** The synthetic sandbox id a project's build runs under; never a session. */
export function environmentBuildSessionId(projectId: string): string {
  return `environment-build:${projectId}`;
}

/**
 * Build a claimed project's environment and record the result. `current`
 * are the heads the build pins to, resolved by the caller (the triggers need
 * them before deciding to build); a `skipped` outcome records nothing and the
 * caller releases the claim by recording a failure of its own.
 */
export async function runEnvironmentBuild(
  deps: EnvironmentBuildDeps,
  input: { project: FactoryProject; claimedAt: Date; heads?: EnvironmentHeads },
): Promise<EnvironmentBuildOutcome> {
  try {
    return await buildEnvironment(deps, input);
  } catch (error) {
    // Anything that threw before the template was polled (environment, head
    // lookup, the host's template hook) still releases the claim as a failure,
    // so the project backs off instead of sitting on a stale lease.
    const message = redactCredentials(error instanceof Error ? error.message : String(error));
    await deps.projects.recordBuild({
      orgId: input.project.orgId,
      id: input.project.id,
      input: {
        now: (deps.now ?? (() => new Date()))(),
        claimedAt: input.claimedAt,
        result: { status: 'failed', error: message },
      },
    });
    deps.logger?.info('environment build failed', { factoryProjectId: input.project.id, error: message });
    return { status: 'failed', error: message };
  }
}

async function buildEnvironment(
  deps: EnvironmentBuildDeps,
  input: { project: FactoryProject; claimedAt: Date; heads?: EnvironmentHeads },
): Promise<EnvironmentBuildOutcome> {
  const now = deps.now ?? (() => new Date());
  const sleep = deps.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const { project } = input;
  const environment = await resolveProjectEnvironment(deps.sourceControl.storage, project);
  if (!environment) return { status: 'skipped', reason: 'no_environment' };

  const heads =
    input.heads ??
    (await resolveCurrentHeads(deps.sourceControl, {
      orgId: project.orgId,
      repositories: environment.repos.map(repo => ({
        id: repo.repositoryId,
        slug: repo.slug,
        branch: repo.defaultBranch,
      })),
    }));

  const context: FactorySandboxContext = {
    sessionId: environmentBuildSessionId(project.id),
    ...environmentSandboxContext(environment, {
      orgId: project.orgId,
      getRepositoryAccess: args => deps.sourceControl.versionControl.getRepositoryAccess(args),
      resolveHead: recordedHeadResolver(heads),
    }),
  };
  const resolver = deps.sandboxTemplate(context);
  const template = resolver ? await resolver() : undefined;
  if (!template) return { status: 'skipped', reason: 'no_template' };

  const started = now().getTime();
  const maxWaitMs = deps.maxWaitMs ?? MAX_BUILD_WAIT_MS;
  let result: EnvironmentTemplateBuildResult;
  try {
    result = await template.build();
    while (result.status === 'pending') {
      if (now().getTime() - started >= maxWaitMs) {
        result = { status: 'failed', templateId: result.templateId, error: 'Build timed out.' };
        break;
      }
      await sleep(result.retryAfterMs ?? DEFAULT_BUILD_POLL_MS);
      result = await template.build();
    }
  } catch (error) {
    result = { status: 'failed', templateId: '', error: error instanceof Error ? error.message : String(error) };
  }

  const finishedAt = now();
  if (result.status === 'ready') {
    await deps.projects.recordBuild({
      orgId: project.orgId,
      id: project.id,
      input: {
        now: finishedAt,
        claimedAt: input.claimedAt,
        result: { status: 'ready', templateId: result.templateId, heads },
      },
    });
    for (const repo of environment.repos) {
      await deps.sourceControl.storage.projectRepositories.setBuildStatus({
        orgId: project.orgId,
        id: repo.projectRepositoryId,
        status: 'configured',
        error: null,
        builtAt: finishedAt,
      });
    }
    deps.logger?.info('environment build ready', { factoryProjectId: project.id, templateId: result.templateId });
    return { status: 'ready', templateId: result.templateId, heads };
  }

  const error = redactCredentials(result.error ?? 'Build failed.');
  await deps.projects.recordBuild({
    orgId: project.orgId,
    id: project.id,
    input: { now: finishedAt, claimedAt: input.claimedAt, result: { status: 'failed', error } },
  });
  deps.logger?.info('environment build failed', { factoryProjectId: project.id, error });
  return { status: 'failed', error };
}
