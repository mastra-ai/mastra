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
    'getById' | 'claimBuildAttempt' | 'claimBuildStart' | 'renewBuildStart' | 'releaseBuildStart' | 'pinActiveTemplate'
  >;
  /** Absent when the factory has no source-control integration to resolve heads with. */
  sourceControl: EnvironmentBuildSourceControl | undefined;
  logger?: { info: (msg: string, meta?: Record<string, unknown>) => void };
  now?: () => Date;
  /** How often a run renews its build-start lease; a third of `BUILD_START_LEASE_MS` by default. */
  leaseRenewMs?: number;
  /** Waits between tries at recording a started build. */
  sleep?: (ms: number) => Promise<void>;
}

export interface EnvironmentBuildOutcome {
  outcome: 'started' | 'skipped' | 'unavailable' | 'failed';
  buildId?: string;
  templateId?: string;
  /** Why nothing started: `debounced`, `starting` (another run is starting a build), `in_progress`, `unchanged`, `unresolved` (a lapsed run may have started a build the provider cannot list), `no_environment`, `no_builds`, `no_source_control`; why a run failed: `not_recorded`, `superseded`, or an error. */
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
  project: Pick<FactoryProject, 'id' | 'orgId' | 'name'>,
  environment: SessionEnvironment,
  heads: EnvironmentHeads,
  versionControl: Pick<VersionControl, 'getRepositoryAccess'>,
): FactorySandboxContext {
  return {
    sessionId: environmentBuildSessionId(project.id),
    factoryId: project.id,
    factoryName: project.name,
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
 * How long a build-start lease lasts without renewal. The run holding it
 * renews it every third of that while it works, so a lease lapses only when
 * its run died or stalled.
 */
export const BUILD_START_LEASE_MS = 10 * 60_000;

/** Tries at recording a started build before the run leaves its lease to lapse. */
const RECORD_ATTEMPTS = 5;

/**
 * Start a build for `projectId` when `trigger` calls for one. Every trigger
 * takes the project's build-start lease before reading build state and renews
 * it until the started build is recorded, so overlapping manual, scheduled and
 * push runs never both start a build, however long the provider takes; a run
 * that finds the lease held skips as `starting`. Every trigger skips while the
 * last build is still running; `schedule` and `push` also skip when the last
 * build is ready and neither a head nor any other template input changed;
 * `manual` otherwise always builds. A `push` that would build then takes the
 * leading-edge debounce claim, so only a push that starts a build opens the
 * window. Saving settings never builds.
 *
 * Taking over a lapsed lease leaves the start uncertain: the lapsed run may
 * have started a build it never recorded. The mark persists until resolved.
 * While it stands, a provider that lists builds is asked for a running one
 * (and every trigger skips as `in_progress` on it); with a provider that
 * cannot list, every trigger skips as `unresolved`.
 *
 * The result is written as the lease is released, and only while this run
 * still holds it. A failed `builds.start` clears the last build id, so a later
 * `schedule` or `push` cannot mistake the previous ready build for the current
 * template; any other error keeps a running build's id. A started build whose
 * recording keeps failing yields `failed` (`not_recorded`) with the lease left
 * to lapse rather than released, and a run that lost its lease while the
 * provider started yields `failed` (`superseded`); neither is polled or pinned.
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
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms)));

  const pushDebounced = (project: FactoryProject, at: Date) =>
    project.lastPushBuildAt !== null &&
    at.getTime() - project.lastPushBuildAt.getTime() < project.buildPushDebounceMinutes * 60_000;
  if (input.trigger === 'push' && pushDebounced(initial, now())) return { outcome: 'skipped', reason: 'debounced' };

  const token = randomUUID();
  const lease = { id: initial.id, token, leaseMs: BUILD_START_LEASE_MS };
  const claim = await deps.projects.claimBuildStart({ ...lease, now: now() });
  if (!claim.claimed) return { outcome: 'skipped', reason: 'starting' };
  let held = true;
  const renewal = setInterval(
    () => {
      deps.projects.renewBuildStart({ ...lease, now: now() }).then(
        renewed => {
          if (!renewed) held = false;
        },
        // A failed renewal is retried on the next tick; the lease outlasts two misses.
        () => {},
      );
    },
    deps.leaseRenewMs ?? BUILD_START_LEASE_MS / 3,
  );
  renewal.unref?.();

  const attempted = { lastBuildAttemptedAt: now() };
  // Set once this run has reconciled an uncertain start, or builds past it.
  let resolved = false;
  const release = (changes: Parameters<EnvironmentBuildDeps['projects']['releaseBuildStart']>[0]['changes'] = {}) =>
    deps.projects.releaseBuildStart({ id: initial.id, token, changes, resolved, now: now() });
  const failed = async (error: unknown, changes: Parameters<typeof release>[0]) => {
    const reason = errorReason(error);
    await release(changes);
    deps.logger?.info('environment build failed', { factoryProjectId: initial.id, trigger: input.trigger, reason });
    return { outcome: 'failed', reason } satisfies EnvironmentBuildOutcome;
  };

  try {
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

      if (claim.uncertain) {
        // A run whose lease lapsed may have reached the provider before it
        // died; a build it left running is never raced by a second one. The
        // mark stays until that build is gone, since its inputs are unknown.
        if (builds.list) {
          const listed = await builds.list(ctx, environment.settings);
          const running = listed.find(build => build.status === 'pending' || build.status === 'building');
          if (running) {
            await release();
            return { outcome: 'skipped', reason: 'in_progress', buildId: running.buildId };
          }
          resolved = true;
        } else {
          // Without history the earlier start can never be reconciled, so no
          // trigger starts another build beside it.
          await release();
          return { outcome: 'skipped', reason: 'unresolved' };
        }
      }

      if (project.lastBuildId) {
        const last = await builds.get(ctx, environment.settings, project.lastBuildId);
        // Two runs polling one template fight over it (each poll resubmits its
        // own definition and the provider cancels the other), so a running
        // build is never joined by a second one, whatever asked.
        if (last.status === 'pending' || last.status === 'building') {
          await release();
          return { outcome: 'skipped', reason: 'in_progress', buildId: project.lastBuildId };
        }
        // A ready build whose poll ran out or died with its host was never
        // pinned; pin it now so the skip below compares against what it built.
        let pinnedHeads = project.activeTemplateHeads;
        const lastTemplateId = last.templateId ?? project.lastBuildId;
        if (last.status === 'ready' && project.lastBuildHeads && project.activeTemplateId !== lastTemplateId) {
          const pinned = await deps.projects.pinActiveTemplate({
            id: project.id,
            buildId: project.lastBuildId,
            templateId: lastTemplateId,
            heads: project.lastBuildHeads,
          });
          if (pinned) pinnedHeads = project.lastBuildHeads;
        }
        if (
          (input.trigger === 'schedule' || input.trigger === 'push') &&
          last.status === 'ready' &&
          !headsChanged(pinnedHeads, heads) &&
          project.lastBuildInputs === buildInputs
        ) {
          await release();
          return { outcome: 'skipped', reason: 'unchanged' };
        }
      }
    } catch (error) {
      return await failed(error, attempted);
    }

    // A run that lost its lease while reading must not start beside its successor.
    if (!held) return { outcome: 'skipped', reason: 'starting' };

    if (input.trigger === 'push') {
      // Claimed only now, so a push that skipped above never closes the window.
      let claimed: boolean;
      try {
        claimed = await deps.projects.claimBuildAttempt({
          id: project.id,
          debounceMinutes: project.buildPushDebounceMinutes,
          now: now(),
        });
      } catch (error) {
        return await failed(error, {});
      }
      if (!claimed) {
        await release();
        return { outcome: 'skipped', reason: 'debounced' };
      }
    }

    let started: Awaited<ReturnType<typeof builds.start>>;
    try {
      started = await builds.start(ctx, environment.settings);
    } catch (error) {
      // Only a failed start clears the last build: the previous one no longer
      // describes the template this project wants.
      return await failed(error, { lastBuildId: null, lastBuildHeads: null, lastBuildInputs: null, ...attempted });
    }

    // The provider has started the build: from here on, no error clears it.
    const log = { factoryProjectId: project.id, trigger: input.trigger, buildId: started.buildId };
    const changes = { lastBuildId: started.buildId, lastBuildHeads: heads, lastBuildInputs: buildInputs, ...attempted };
    let recorded: boolean | undefined;
    for (let attempt = 1; recorded === undefined; attempt++) {
      try {
        recorded = await release(changes);
      } catch (error) {
        if (attempt >= RECORD_ATTEMPTS) {
          // Keep the lease: it lapses once renewal stops, and the run that
          // takes it over looks for this build at the provider first.
          deps.logger?.info('environment build started but not recorded', { ...log, reason: errorReason(error) });
          return { outcome: 'failed', reason: 'not_recorded', buildId: started.buildId };
        }
        await sleep(1000 * 2 ** (attempt - 1));
      }
    }
    if (!recorded) {
      // A newer run took the lease while the provider started this build; the
      // project tracks that run's build, so this one is never polled or pinned.
      deps.logger?.info('environment build superseded', log);
      return { outcome: 'failed', reason: 'superseded', buildId: started.buildId };
    }
    try {
      deps.logger?.info('environment build started', { ...log, templateId: started.templateId });
    } catch {
      // Logging never turns a recorded build into a failure.
    }
    return {
      outcome: 'started',
      buildId: started.buildId,
      ...(started.templateId ? { templateId: started.templateId } : {}),
      heads,
    };
  } finally {
    clearInterval(renewal);
  }
}
