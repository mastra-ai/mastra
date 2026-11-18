/**
 * Starts `factory-environment-build` runs on the booted `Mastra`. Every
 * trigger goes through a workflow run so the start decision and the poll are
 * recorded the same way whether a route, the scheduler or a webhook asked.
 */

import type { Mastra } from '@mastra/core/mastra';
import type { FactorySandboxContext } from '@mastra/core/workspace';
import type { RepositoryPushEvent } from '../integrations/base.js';
import { resolveProjectEnvironment } from '../workspace.js';
import { probeSchedulesAvailable } from './build-schedule.js';
import type { ScheduleService } from './build-schedule.js';
import { createEnvironmentBuildWorkflow, ENVIRONMENT_BUILD_WORKFLOW_ID } from './build-workflow.js';
import type { EnvironmentBuildWorkflowOptions } from './build-workflow.js';
import type { EnvironmentBuildDeps, EnvironmentBuildOutcome, EnvironmentBuildTrigger } from './build.js';
import { environmentBuildContextWithEnv, errorReason, resolveEnvironmentHeads } from './build.js';

/** Longest wait between `settings` runs that find another process holding the build-start lease. */
const SETTINGS_RETRY_MAX_MS = 30_000;

export type StartEnvironmentBuild = (
  projectId: string,
  trigger: EnvironmentBuildTrigger,
) => Promise<EnvironmentBuildOutcome>;

export interface EnvironmentBuildRunnerOptions extends Omit<EnvironmentBuildWorkflowOptions, 'onStart' | 'onSettled'> {
  /** The booted instance; `undefined` until the host finished `finalize()`. */
  getMastra: () => Mastra | undefined;
  logger?: { info: (msg: string, meta?: Record<string, unknown>) => void };
}

/** What a read of a build's status or history hands the provider. */
export interface EnvironmentBuildReadContext {
  ctx: FactorySandboxContext;
  settings: Record<string, unknown>;
}

export class EnvironmentBuildRunner {
  readonly workflow;
  readonly #deps: EnvironmentBuildDeps;
  readonly #getMastra: () => Mastra | undefined;
  readonly #logger: EnvironmentBuildRunnerOptions['logger'];
  readonly #pending = new Map<string, (outcome: EnvironmentBuildOutcome) => void>();
  readonly #sleep: (ms: number) => Promise<void>;
  /** Projects with a saved change that a run of theirs skipped; that run's end builds it. */
  readonly #awaitingRun = new Set<string>();
  #scheduleAvailable = false;

  constructor(deps: EnvironmentBuildDeps, options: EnvironmentBuildRunnerOptions) {
    const { getMastra, logger, ...workflowOptions } = options;
    this.#deps = deps;
    this.#getMastra = getMastra;
    this.#logger = logger;
    this.#sleep = workflowOptions.sleep ?? (ms => new Promise<void>(resolve => setTimeout(resolve, ms)));
    this.workflow = createEnvironmentBuildWorkflow(deps, {
      ...workflowOptions,
      onStart: (runId, outcome) => {
        this.#pending.get(runId)?.(outcome);
        this.#pending.delete(runId);
      },
      // Fires for every run of the registered workflow, scheduled ones included.
      // A started build always checks once more, since a save (here or in
      // another process) may have been skipped against it; a run that held the
      // lease without building hands back a save skipped meanwhile. A run that
      // was itself skipped against the lease or a running build hands back
      // nothing: the run it deferred to is still going.
      onSettled: (projectId, result) => {
        if (result.outcome === 'started') {
          this.#awaitingRun.delete(projectId);
          this.onEnvironmentSaved(projectId);
          return;
        }
        if (result.outcome === 'skipped' && (result.reason === 'starting' || result.reason === 'in_progress')) return;
        if (this.#awaitingRun.delete(projectId)) this.onEnvironmentSaved(projectId);
      },
    });
  }

  /** The schedule service of the booted host, `undefined` before boot. */
  schedules(): ScheduleService | undefined {
    return this.#getMastra()?.schedules;
  }

  /** Whether the host's storage implements schedules; false until `probeSchedules()` ran. */
  get scheduleAvailable(): boolean {
    return this.#scheduleAvailable;
  }

  /** Probe once after the host booted; a storage without the domain disables the cron trigger. */
  async probeSchedules(): Promise<boolean> {
    const schedules = this.schedules();
    this.#scheduleAvailable = schedules ? await probeSchedulesAvailable(schedules) : false;
    return this.#scheduleAvailable;
  }

  /**
   * The context a status or history read hands the provider. Heads come from
   * the stored last attempt (the build being read was pinned to them), else
   * the active template, so a read never calls GitHub; before the first build
   * they are resolved live once.
   */
  async readContext(projectId: string): Promise<EnvironmentBuildReadContext | undefined> {
    const sourceControl = this.#deps.sourceControl;
    if (!sourceControl) return undefined;
    const project = await this.#deps.projects.getById({ id: projectId });
    if (!project) return undefined;
    const environment = await resolveProjectEnvironment(sourceControl.storage, project);
    const heads =
      project.lastBuildHeads ??
      project.activeTemplateHeads ??
      (await resolveEnvironmentHeads(sourceControl, project, environment));
    return {
      ctx: (
        await environmentBuildContextWithEnv(
          project,
          environment,
          heads,
          sourceControl.versionControl,
          this.#deps.sandboxEnvs,
        )
      ).ctx,
      settings: environment.settings,
    };
  }

  /**
   * A push to an environment repository's default branch starts a `push` run
   * when the project opted in; the run's debounce claim decides whether it
   * builds. Fire and forget: the webhook never waits on it.
   */
  readonly onRepositoryPush = (event: RepositoryPushEvent): void => {
    if (!event.projectRepository.inEnvironment) return;
    const branch = event.defaultBranch;
    if (event.ref !== `refs/heads/${branch}`) return;
    void this.#deps.projects
      .getById({ id: event.factoryProjectId })
      .then(project => (project?.buildOnPushEnabled ? this.start(project.id, 'push') : undefined))
      .catch((error: unknown) => {
        this.#logger?.info('environment build push hand-off failed', {
          factoryProjectId: event.factoryProjectId,
          reason: errorReason(error),
        });
      });
  };

  /**
   * A saved change to a project's environment (settings, setup commands,
   * repositories, Build variables) starts a `settings` run, which builds only
   * when the template inputs changed. A run skipped because another one
   * holds the build-start lease or its build is running (either may have read
   * the environment before this save) stays pending until that run is over.
   * A lease held by another process is retried, a second apart and doubling
   * up to `SETTINGS_RETRY_MAX_MS`, until it is released or lapses. Fire and
   * forget: the save never waits on it or fails because of it.
   */
  readonly onEnvironmentSaved = (projectId: string): void => {
    void (async () => {
      for (let delay = 1000; ; delay = Math.min(delay * 2, SETTINGS_RETRY_MAX_MS)) {
        const outcome = await this.start(projectId, 'settings');
        if (outcome.outcome !== 'skipped' || (outcome.reason !== 'starting' && outcome.reason !== 'in_progress')) {
          return;
        }
        this.#awaitingRun.add(projectId);
        if (outcome.reason === 'in_progress') return;
        await this.#sleep(delay);
        // A run of this process ended meanwhile and handed the save back.
        if (!this.#awaitingRun.has(projectId)) return;
      }
    })().catch((error: unknown) => {
      this.#logger?.info('environment build settings hand-off failed', {
        factoryProjectId: projectId,
        reason: errorReason(error),
      });
    });
  };

  /**
   * Start a run and resolve with the first step's answer; the poll step keeps
   * running in the background. Resolves `unavailable` before the host booted
   * or when the host never registered the workflow, and `failed` when the run
   * could not be created; a caller that already saved its own change must not
   * fail on the build it merely requested.
   */
  readonly start: StartEnvironmentBuild = async (projectId, trigger) => {
    const mastra = this.#getMastra();
    if (!mastra) return { outcome: 'unavailable', reason: 'not_ready' };
    let run: Awaited<ReturnType<typeof this.workflow.createRun>>;
    try {
      run = await mastra.getWorkflow(ENVIRONMENT_BUILD_WORKFLOW_ID).createRun();
    } catch (error) {
      const reason = errorReason(error);
      this.#logger?.info('environment build run could not be created', { factoryProjectId: projectId, reason });
      return mastra.listWorkflows()[ENVIRONMENT_BUILD_WORKFLOW_ID]
        ? { outcome: 'failed', reason }
        : { outcome: 'unavailable', reason: 'no_workflow' };
    }
    const outcome = new Promise<EnvironmentBuildOutcome>(resolve => this.#pending.set(run.runId, resolve));
    run
      .start({ inputData: { projectId, trigger } })
      .then(result => {
        if (result.status !== 'success') {
          this.#logger?.info('environment build run did not succeed', {
            factoryProjectId: projectId,
            runId: run.runId,
          });
        }
      })
      .catch((error: unknown) => {
        this.#logger?.info('environment build run threw', {
          factoryProjectId: projectId,
          runId: run.runId,
          reason: errorReason(error),
        });
      })
      .finally(() => {
        // A run that failed before its first step answered must not hang the caller.
        this.#pending.get(run.runId)?.({ outcome: 'failed', reason: 'The build run ended before it started a build.' });
        this.#pending.delete(run.runId);
      });
    return outcome;
  };
}
