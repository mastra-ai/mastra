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
import { environmentBuildContext, resolveEnvironmentHeads } from './build.js';

export type StartEnvironmentBuild = (
  projectId: string,
  trigger: EnvironmentBuildTrigger,
) => Promise<EnvironmentBuildOutcome>;

export interface EnvironmentBuildRunnerOptions extends Omit<EnvironmentBuildWorkflowOptions, 'onStart'> {
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
  #scheduleAvailable = false;

  constructor(deps: EnvironmentBuildDeps, options: EnvironmentBuildRunnerOptions) {
    const { getMastra, logger, ...workflowOptions } = options;
    this.#deps = deps;
    this.#getMastra = getMastra;
    this.#logger = logger;
    this.workflow = createEnvironmentBuildWorkflow(deps, {
      ...workflowOptions,
      onStart: (runId, outcome) => {
        this.#pending.get(runId)?.(outcome);
        this.#pending.delete(runId);
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
   * the stored active template so a read never calls GitHub; before the first
   * ready build they are resolved live once.
   */
  async readContext(projectId: string): Promise<EnvironmentBuildReadContext | undefined> {
    const sourceControl = this.#deps.sourceControl;
    if (!sourceControl) return undefined;
    const project = await this.#deps.projects.getById({ id: projectId });
    if (!project) return undefined;
    const environment = await resolveProjectEnvironment(sourceControl.storage, project);
    const heads = project.activeTemplateHeads ?? (await resolveEnvironmentHeads(sourceControl, project, environment));
    return {
      ctx: environmentBuildContext(project, environment, heads, sourceControl.versionControl),
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
    const branch = event.projectRepository.branch || event.defaultBranch;
    if (event.ref !== `refs/heads/${branch}`) return;
    void this.#deps.projects
      .getById({ id: event.factoryProjectId })
      .then(project => (project?.buildOnPushEnabled ? this.start(project.id, 'push') : undefined))
      .catch((error: unknown) => {
        this.#logger?.info('environment build push hand-off failed', {
          factoryProjectId: event.factoryProjectId,
          error: error instanceof Error ? error.message : String(error),
        });
      });
  };

  /**
   * Start a run and resolve with the first step's answer; the poll step keeps
   * running in the background. Resolves `unavailable` before the host booted.
   */
  readonly start: StartEnvironmentBuild = async (projectId, trigger) => {
    const mastra = this.#getMastra();
    if (!mastra) return { outcome: 'unavailable', reason: 'not_ready' };
    const run = await mastra.getWorkflow(ENVIRONMENT_BUILD_WORKFLOW_ID).createRun();
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
          error: error instanceof Error ? error.message : String(error),
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
