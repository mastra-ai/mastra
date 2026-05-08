import { WorkflowScheduler } from '../../workflows/scheduler/scheduler';
import { MastraWorker } from '../worker';
import type { WorkerDeps } from '../worker';

export interface SchedulerWorkerConfig {
  tickIntervalMs?: number;
  batchSize?: number;
  onError?: (err: unknown, context: { scheduleId: string }) => void;
}

/**
 * Drives cron-based workflow schedules. On each tick it polls storage
 * for due schedules, computes next fire times, and publishes
 * workflow.start events. Does not consume events — only produces them.
 */
export class SchedulerWorker extends MastraWorker {
  readonly name = 'scheduler';

  #scheduler?: WorkflowScheduler;
  #config: SchedulerWorkerConfig;
  #running = false;

  constructor(config: SchedulerWorkerConfig = {}) {
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

    this.#scheduler = new WorkflowScheduler({
      schedulesStore,
      pubsub: deps.pubsub,
      config: {
        tickIntervalMs: this.#config.tickIntervalMs,
        batchSize: this.#config.batchSize,
        onError: this.#config.onError,
      },
    });
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
