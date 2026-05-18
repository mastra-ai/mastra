import { MastraBase } from '../../base';
import type { PubSub } from '../../events/pubsub';
import { RegisteredLogger } from '../../logger/constants';
import type { Schedule, ScheduleTrigger, SchedulesStorage } from '../../storage/domains/schedules/base';
import { computeNextFireAt } from './cron';
import type { WorkflowSchedulerConfig } from './types';

const TOPIC_WORKFLOWS = 'workflows';
const DEFAULT_TICK_INTERVAL_MS = 10_000;
const DEFAULT_BATCH_SIZE = 100;

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

    try {
      // Run one tick immediately so newly-due schedules don't wait the full interval.
      await this.#runTick();

      // If stop() ran concurrently with the warm-up tick, don't arm a new
      // interval afterwards — the caller has already asked us to shut down.
      if (this.#stopping || !this.#started) return;

      this.#intervalHandle = setInterval(() => {
        // Swallow rejections here so a tick failure can't surface as an
        // unhandled promise rejection and crash the host process. #processTick
        // already logs its own errors and notifies onError, so we only need a
        // belt-and-braces logger.error for anything that escapes.
        void this.#runTick().catch(err => {
          this.logger.error('WorkflowScheduler tick crashed', { error: err });
        });
      }, this.#config.tickIntervalMs);
    } catch (err) {
      // Reset state so a future start() can retry. Without this, a failed
      // warm-up tick would leave #started=true with no interval armed and
      // every subsequent start() call would silently no-op.
      this.#started = false;
      this.#stopping = false;
      throw err;
    }
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
      this.#notifyError(err, schedule.id);
      return;
    }

    // Deterministic runId so concurrent ticks across processes derive the same id.
    const runId = `sched_${schedule.id}_${schedule.nextFireAt}`;

    let claimed = false;
    try {
      claimed = await this.#schedulesStore.updateScheduleNextFire(
        schedule.id,
        schedule.nextFireAt,
        newNextFireAt,
        actualFireAt,
        runId,
      );
    } catch (err) {
      this.logger.error('Failed to claim due schedule fire', {
        scheduleId: schedule.id,
        runId,
        error: err,
      });
      this.#notifyError(err, schedule.id);
      return;
    }

    if (!claimed) {
      // Another instance won the race, the row was paused/disabled, or the
      // expected nextFireAt no longer matches. Skip publishing.
      return;
    }

    let triggerStatus: ScheduleTrigger['outcome'] = 'published';
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
      this.#notifyError(err, schedule.id);
    }

    try {
      await this.#schedulesStore.recordTrigger({
        scheduleId: schedule.id,
        runId,
        scheduledFireAt: schedule.nextFireAt,
        actualFireAt,
        outcome: triggerStatus,
        error: triggerError,
        triggerKind: 'schedule-fire',
      });
    } catch (err) {
      this.logger.error('Failed to record schedule trigger', {
        scheduleId: schedule.id,
        runId,
        error: err,
      });
    }
  }

  /**
   * Invoke the user-supplied onError hook in isolation. A throwing hook
   * must not abort the scheduler tick loop, so we swallow + log any error
   * the callback itself raises.
   */
  #notifyError(error: unknown, scheduleId: string): void {
    if (!this.#config.onError) return;
    try {
      this.#config.onError(error, { scheduleId });
    } catch (callbackError) {
      this.logger.error('WorkflowScheduler onError handler threw', {
        scheduleId,
        error: callbackError,
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
