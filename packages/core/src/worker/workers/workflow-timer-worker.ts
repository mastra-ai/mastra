import type { Event } from '../../events/types';
import type { StoredWorkflowTimer, WorkflowsStorage } from '../../storage/domains/workflows/base';
import { MastraWorker } from '../worker';
import type { WorkerDeps, WorkerStopOptions } from '../worker';

export interface WorkflowTimerWorkerConfig {
  pollInterval?: number;
  batchSize?: number;
  leaseDuration?: number;
}

const DEFAULT_POLL_INTERVAL = 1_000;
const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_LEASE_DURATION = 30_000;

export class WorkflowTimerWorker extends MastraWorker {
  readonly name = 'workflowTimers';

  #config: Required<WorkflowTimerWorkerConfig>;
  #store?: WorkflowsStorage;
  #pollHandle?: ReturnType<typeof setTimeout>;
  #running = false;
  #polling = false;
  #page = 0;

  constructor(config: WorkflowTimerWorkerConfig = {}) {
    super();
    this.#config = {
      pollInterval: config.pollInterval ?? DEFAULT_POLL_INTERVAL,
      batchSize: config.batchSize ?? DEFAULT_BATCH_SIZE,
      leaseDuration: config.leaseDuration ?? DEFAULT_LEASE_DURATION,
    };
  }

  async init(deps: WorkerDeps): Promise<void> {
    await super.init(deps);
    const store = await deps.storage.getStore('workflows');
    if (!store) {
      deps.logger.warn('WorkflowTimerWorker: no workflows store available, workflow timers will not run');
      return;
    }
    this.#store = store;
  }

  async start(): Promise<void> {
    if (this.#running) return;
    if (!this.deps) throw new Error('WorkflowTimerWorker: call init() before start()');
    this.#running = true;
    await this.#poll();
    this.#schedulePoll();
  }

  async stop(_options?: WorkerStopOptions): Promise<void> {
    if (!this.#running) return;
    this.#running = false;
    if (this.#pollHandle) {
      clearTimeout(this.#pollHandle);
      this.#pollHandle = undefined;
    }
  }

  get isRunning(): boolean {
    return this.#running;
  }

  #schedulePoll(): void {
    if (!this.#running) return;
    this.#pollHandle = setTimeout(async () => {
      try {
        await this.#poll();
      } finally {
        this.#schedulePoll();
      }
    }, this.#config.pollInterval);
  }

  async #poll(): Promise<void> {
    if (!this.#store || !this.deps || this.#polling) return;
    this.#polling = true;
    try {
      const now = Date.now();
      const { timers, nextPage } = await this.#store.listDueWorkflowTimers({
        dueAt: now,
        limit: this.#config.batchSize,
        page: this.#page,
      });
      this.#page = nextPage;
      await Promise.all(timers.map(timer => this.#fire(timer, now)));
    } catch (error) {
      this.deps.logger.error('WorkflowTimerWorker: failed to poll workflow timers', { error });
    } finally {
      this.#polling = false;
    }
  }

  async #fire(timer: StoredWorkflowTimer, now: number): Promise<void> {
    if (!this.#store || !this.deps) return;
    const claimed = await this.#store.claimWorkflowTimer({
      workflowId: timer.workflowId,
      runId: timer.runId,
      timerId: timer.id,
      now,
      leaseDuration: this.#config.leaseDuration,
    });
    if (!claimed) return;

    const event: Event = {
      id: claimed.id,
      type: 'workflow.step.run',
      runId: claimed.runId,
      createdAt: new Date(),
      data: {
        workflowId: claimed.workflowId,
        runId: claimed.runId,
        ...claimed.continuation,
      },
    };

    let published = false;
    try {
      if (claimed.emitStepEvents) {
        const output =
          claimed.continuation.prevResult.status === 'success' ? claimed.continuation.prevResult.output : undefined;
        await this.deps.pubsub.publish(`workflow.events.v2.${claimed.runId}`, {
          type: 'watch',
          runId: claimed.runId,
          data: {
            type: 'workflow-step-result',
            payload: {
              id: claimed.stepId,
              status: 'success',
              payload: output,
              output,
              startedAt: claimed.startedAt,
              endedAt: Date.now(),
            },
          },
        });
        await this.deps.pubsub.publish(`workflow.events.v2.${claimed.runId}`, {
          type: 'watch',
          runId: claimed.runId,
          data: { type: 'workflow-step-finish', payload: { id: claimed.stepId, metadata: {} } },
        });
      }
      await this.deps.pubsub.publish('workflows', event);
      published = true;
      await this.#store.completeWorkflowTimer({
        workflowId: claimed.workflowId,
        runId: claimed.runId,
        timerId: claimed.id,
        claimToken: claimed.claimToken,
      });
    } catch (error) {
      if (!published) {
        try {
          await this.#store.releaseWorkflowTimer({
            workflowId: claimed.workflowId,
            runId: claimed.runId,
            timerId: claimed.id,
            claimToken: claimed.claimToken,
          });
        } catch (releaseError) {
          this.deps.logger.error('WorkflowTimerWorker: failed to release workflow timer lease', {
            timerId: claimed.id,
            error: releaseError,
          });
        }
      }
      this.deps.logger.error('WorkflowTimerWorker: failed to fire workflow timer', { timerId: claimed.id, error });
    }
  }
}
