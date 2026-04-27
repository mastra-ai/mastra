import { randomUUID } from 'node:crypto';
import { MastraBase } from '../../base';
import type { PubSub } from '../../events/pubsub';
import { RegisteredLogger } from '../../logger/constants';
import type {
  Schedule,
  ScheduleFilter,
  ScheduleStatus,
  ScheduleTarget,
  ScheduleTrigger,
  ScheduleTriggerListOptions,
  SchedulesStorage,
} from '../../storage/domains/schedules/base';
import { computeNextFireAt, validateCron } from './cron';
import type { WorkflowSchedulerConfig } from './types';

const TOPIC_WORKFLOWS = 'workflows';
const DEFAULT_TICK_INTERVAL_MS = 10_000;
const DEFAULT_BATCH_SIZE = 100;

/**
 * Specification accepted by `WorkflowScheduler.create()`. The scheduler
 * computes `nextFireAt` from the cron expression and persists the row.
 */
export type CreateScheduleInput = {
  /**
   * Optional explicit id. Defaults to a random uuid.
   * Stable ids are recommended for declarative schedules so re-registration
   * is idempotent.
   */
  id?: string;
  target: ScheduleTarget;
  cron: string;
  timezone?: string;
  /** Defaults to 'active'. */
  status?: ScheduleStatus;
  metadata?: Record<string, unknown>;
};

/**
 * Drives cron-based workflow triggers.
 *
 * On each tick the scheduler:
 *  1. Loads schedules whose `nextFireAt <= now` from storage.
 *  2. Computes the next fire time from the cron expression.
 *  3. Atomically advances `nextFireAt` via compare-and-swap. Only one
 *     instance across many polling the same storage can claim a fire.
 *  4. Publishes a `workflow.start` event on the `workflows` pubsub topic.
 *  5. Records the trigger in the schedule's history.
 *
 * The scheduler does **not** execute workflows. The existing
 * `WorkflowEventProcessor` consumes `workflow.start` events and runs them.
 */
export class WorkflowScheduler extends MastraBase {
  #schedulesStore: SchedulesStorage;
  #pubsub: PubSub;
  #config: Required<Pick<WorkflowSchedulerConfig, 'tickIntervalMs' | 'batchSize'>> & WorkflowSchedulerConfig;

  #intervalHandle?: ReturnType<typeof setInterval>;
  #inflightTick?: Promise<void>;
  #started = false;
  #stopping = false;

  constructor({
    schedulesStore,
    pubsub,
    config,
  }: {
    schedulesStore: SchedulesStorage;
    pubsub: PubSub;
    config?: WorkflowSchedulerConfig;
  }) {
    super({ component: RegisteredLogger.WORKFLOW, name: 'WorkflowScheduler' });
    this.#schedulesStore = schedulesStore;
    this.#pubsub = pubsub;
    this.#config = {
      tickIntervalMs: config?.tickIntervalMs ?? DEFAULT_TICK_INTERVAL_MS,
      batchSize: config?.batchSize ?? DEFAULT_BATCH_SIZE,
      ...config,
    };
  }

  /** Start the periodic tick loop. Runs an immediate tick first. */
  async start(): Promise<void> {
    if (this.#started) return;
    this.#started = true;
    this.#stopping = false;

    // Run one tick immediately so newly-due schedules don't wait the full interval.
    await this.#runTick();

    this.#intervalHandle = setInterval(() => {
      void this.#runTick();
    }, this.#config.tickIntervalMs);
  }

  /** Stop the tick loop and wait for any in-flight tick to finish. */
  async stop(): Promise<void> {
    if (!this.#started) return;
    this.#stopping = true;

    if (this.#intervalHandle) {
      clearInterval(this.#intervalHandle);
      this.#intervalHandle = undefined;
    }

    if (this.#inflightTick) {
      try {
        await this.#inflightTick;
      } catch {
        // tick errors are already logged; swallow during shutdown
      }
    }

    this.#started = false;
    this.#stopping = false;
  }

  /** True when the scheduler is currently running its tick loop. */
  get isRunning(): boolean {
    return this.#started;
  }

  /**
   * Run a single tick. Public for tests; production callers should rely
   * on the interval started by `start()`.
   */
  async tick(): Promise<void> {
    await this.#runTick();
  }

  // -------- Imperative API --------

  async create(input: CreateScheduleInput): Promise<Schedule> {
    validateCron(input.cron, input.timezone);

    const now = Date.now();
    const id = input.id ?? randomUUID();
    const status: ScheduleStatus = input.status ?? 'active';
    const nextFireAt = computeNextFireAt(input.cron, { timezone: input.timezone, after: now });

    const schedule: Schedule = {
      id,
      target: input.target,
      cron: input.cron,
      timezone: input.timezone,
      status,
      nextFireAt,
      createdAt: now,
      updatedAt: now,
      metadata: input.metadata,
    };

    return await this.#schedulesStore.createSchedule(schedule);
  }

  async pause(id: string): Promise<Schedule> {
    return await this.#schedulesStore.updateSchedule(id, { status: 'paused' });
  }

  async resume(id: string): Promise<Schedule> {
    const existing = await this.#schedulesStore.getSchedule(id);
    if (!existing) {
      throw new Error(`Schedule "${id}" not found`);
    }
    // Recompute nextFireAt from now so a long-paused schedule doesn't immediately
    // fire for every missed slot.
    const nextFireAt = computeNextFireAt(existing.cron, { timezone: existing.timezone, after: Date.now() });
    return await this.#schedulesStore.updateSchedule(id, { status: 'active', nextFireAt });
  }

  async delete(id: string): Promise<void> {
    await this.#schedulesStore.deleteSchedule(id);
  }

  async list(filter?: ScheduleFilter): Promise<Schedule[]> {
    return await this.#schedulesStore.listSchedules(filter);
  }

  async get(id: string): Promise<Schedule | null> {
    return await this.#schedulesStore.getSchedule(id);
  }

  async listTriggers(scheduleId: string, opts?: ScheduleTriggerListOptions): Promise<ScheduleTrigger[]> {
    return await this.#schedulesStore.listTriggers(scheduleId, opts);
  }

  // -------- Internals --------

  async #runTick(): Promise<void> {
    if (this.#stopping || this.#inflightTick) return;
    const promise = this.#processTick().finally(() => {
      this.#inflightTick = undefined;
    });
    this.#inflightTick = promise;
    await promise;
  }

  async #processTick(): Promise<void> {
    let due: Schedule[];
    try {
      due = await this.#schedulesStore.listDueSchedules(Date.now(), this.#config.batchSize);
    } catch (err) {
      this.logger.error('Failed to list due schedules', { error: err });
      return;
    }

    for (const schedule of due) {
      if (this.#stopping) break;
      await this.#fireSchedule(schedule);
    }
  }

  async #fireSchedule(schedule: Schedule): Promise<void> {
    const actualFireAt = Date.now();

    let newNextFireAt: number;
    try {
      newNextFireAt = computeNextFireAt(schedule.cron, {
        timezone: schedule.timezone,
        after: actualFireAt,
      });
    } catch (err) {
      this.logger.error('Failed to compute next fire time for schedule', {
        scheduleId: schedule.id,
        cron: schedule.cron,
        error: err,
      });
      this.#config.onError?.(err, { scheduleId: schedule.id });
      return;
    }

    // Deterministic runId so concurrent ticks across processes derive the same id.
    const runId = `sched_${schedule.id}_${schedule.nextFireAt}`;

    const claimed = await this.#schedulesStore.updateScheduleNextFire(
      schedule.id,
      schedule.nextFireAt,
      newNextFireAt,
      actualFireAt,
      runId,
    );

    if (!claimed) {
      // Another instance won the race. Skip publishing.
      return;
    }

    let triggerStatus: ScheduleTrigger['status'] = 'published';
    let triggerError: string | undefined;

    try {
      await this.#publishWorkflowStart(schedule, runId);
    } catch (err) {
      triggerStatus = 'failed';
      triggerError = err instanceof Error ? err.message : String(err);
      this.logger.error('Failed to publish workflow.start for schedule', {
        scheduleId: schedule.id,
        runId,
        error: err,
      });
      this.#config.onError?.(err, { scheduleId: schedule.id });
    }

    try {
      await this.#schedulesStore.recordTrigger({
        scheduleId: schedule.id,
        runId,
        scheduledFireAt: schedule.nextFireAt,
        actualFireAt,
        status: triggerStatus,
        error: triggerError,
      });
    } catch (err) {
      this.logger.error('Failed to record schedule trigger', {
        scheduleId: schedule.id,
        runId,
        error: err,
      });
    }
  }

  async #publishWorkflowStart(schedule: Schedule, runId: string): Promise<void> {
    if (schedule.target.type !== 'workflow') {
      throw new Error(`Unsupported schedule target type: ${(schedule.target as { type: string }).type}`);
    }

    const { workflowId, inputData, initialState, requestContext } = schedule.target;

    await this.#pubsub.publish(TOPIC_WORKFLOWS, {
      type: 'workflow.start',
      runId,
      data: {
        workflowId,
        runId,
        prevResult: { status: 'success', output: inputData ?? {} },
        requestContext: requestContext ?? {},
        initialState: initialState ?? {},
      },
    });
  }
}
