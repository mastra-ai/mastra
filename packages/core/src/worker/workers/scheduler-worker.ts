import type { IMastraLogger } from '../../logger';
import { WorkflowScheduler } from '../../workflows/scheduler/scheduler';
import type { WorkflowSchedulerConfig } from '../../workflows/scheduler/types';
import { MastraWorker } from '../worker';
import type { WorkerDeps } from '../worker';

/**
 * Drives cron-based workflow schedules. On each tick it polls storage
 * for due schedules, computes next fire times, and publishes
 * workflow.start events. Does not consume events — only produces them.
 *
 * This is the **single** scheduler code path. The Mastra constructor
 * adds the worker to the default workers list (guarded by
 * `#shouldEnableScheduler()`), and `startWorkers()` initializes it.
 */
export class SchedulerWorker extends MastraWorker {
  readonly name = 'scheduler';

  #scheduler?: WorkflowScheduler;
  #config: WorkflowSchedulerConfig;
  #running = false;

  constructor(config: WorkflowSchedulerConfig = {}) {
    super();
    this.#config = config;
  }

  async init(deps: WorkerDeps): Promise<void> {
    await super.init(deps);

    if (!deps.storage) {
      deps.logger.warn('SchedulerWorker: no storage configured, scheduler will not run');
      return;
    }

    const schedulesStore = await deps.storage.getStore('schedules');
    if (!schedulesStore) {
      deps.logger.warn('SchedulerWorker: no schedules store available, scheduler will not run');
      return;
    }

    // Bind a workflow-existence predicate so the scheduler can reclaim
    // schedule rows whose target workflow is no longer registered with
    // Mastra (e.g. workflow renamed or deleted in code). `getWorkflowById`
    // throws on miss; we adapt that into a boolean.
    const mastra = this.mastra;
    const isWorkflowRegistered = mastra
      ? (workflowId: string) => {
          try {
            mastra.getWorkflowById(workflowId);
            return true;
          } catch {
            return false;
          }
        }
      : undefined;

    this.#scheduler = new WorkflowScheduler({
      schedulesStore,
      pubsub: deps.pubsub,
      config: { ...this.#config, isWorkflowRegistered },
    });
    this.#scheduler.__setLogger(deps.logger as IMastraLogger);

    // Register declarative schedules from workflow configs before starting
    // the tick loop. This syncs code-declared schedules to the DB.
    if (this.mastra) {
      try {
        await this.mastra.registerDeclarativeSchedules(schedulesStore);
      } catch (err) {
        deps.logger.error?.('SchedulerWorker: failed to register declarative schedules', { error: err });
      }
    }
  }

  async start(): Promise<void> {
    if (this.#running) return;
    if (this.#scheduler) {
      await this.#scheduler.start();
    }
    this.#running = true;
  }

  async stop(): Promise<void> {
    if (!this.#running) return;
    if (this.#scheduler) {
      await this.#scheduler.stop();
    }
    this.#running = false;
  }

  get isRunning(): boolean {
    return this.#running;
  }

  /** Expose the underlying scheduler for direct API access (e.g., schedule management). */
  get scheduler(): WorkflowScheduler | undefined {
    return this.#scheduler;
  }
}
