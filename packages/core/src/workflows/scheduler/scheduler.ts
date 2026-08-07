import { MastraBase } from '../../base';
import type { PubSub } from '../../events/pubsub';
import { RegisteredLogger } from '../../logger/constants';
import type { Schedule, ScheduleTrigger, SchedulesStorage } from '../../storage/domains/schedules/base';
import { computeNextFireAt } from './cron';
import type { SchedulerConfig } from './types';

const TOPIC_WORKFLOWS = 'workflows';
export const TOPIC_AGENT_SCHEDULES = 'agent-schedules';
const DEFAULT_TICK_INTERVAL_MS = 10_000;
const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_MISSES_BEFORE_DELETE = 3;

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
export class Scheduler extends MastraBase {
  #schedulesStore: SchedulesStorage;
  #pubsub: PubSub;
  #config: Required<Pick<SchedulerConfig, 'tickIntervalMs' | 'batchSize'>> & SchedulerConfig;

  #intervalHandle?: ReturnType<typeof setInterval>;
  #inflightTick?: Promise<void>;
  #started = false;
  #stopping = false;

  /**
   * Per-schedule count of consecutive ticks where the target workflow was
   * not registered with the host Mastra instance. Reset when the workflow
   * resolves or the schedule is deleted. Used to ride out deploy/startup
   * ordering races before reclaiming a ghost row.
   */
  #missingWorkflowCounts = new Map<string, number>();

  constructor({
    schedulesStore,
    pubsub,
    config,
  }: {
    schedulesStore: SchedulesStorage;
    pubsub: PubSub;
    config?: SchedulerConfig;
  }) {
    super({ component: RegisteredLogger.WORKFLOW, name: 'Scheduler' });
    this.#schedulesStore = schedulesStore;
    this.#pubsub = pubsub;
    this.#config = {
      ...config,
      tickIntervalMs: config?.tickIntervalMs ?? DEFAULT_TICK_INTERVAL_MS,
      batchSize: config?.batchSize ?? DEFAULT_BATCH_SIZE,
    };
  }

  /** Start the periodic tick loop. Runs an immediate tick first. */
  async start(): Promise<void> {
    if (this.#started) return;
    this.#started = true;
    this.#stopping = false;
    // Fresh process / fresh grace window — old miss counts shouldn't carry
    // over into a new start() since the workflow registry may now look
    // different.
    this.#missingWorkflowCounts.clear();

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
          this.logger.error('Scheduler tick crashed', { error: err });
        });
      }, this.#config.tickIntervalMs);

      // Don't keep the process alive just because the scheduler is polling.
      // The process should be able to exit when all other work is done.
      // Without .unref(), the setInterval prevents clean shutdown in
      // scripts that create a Mastra instance (which auto-creates the
      // notification dispatch workflow with a cron schedule) and exit
      // after a single agent.generate() call.
      // Optional call: on runtimes where setInterval returns a number
      // (e.g. Cloudflare Workers) there is no unref and nothing to release.
      this.#intervalHandle.unref?.();
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

  /**
   * Check whether a schedule's target is registered with the host
   * Mastra instance. Returns `true` if no predicate is configured (we can't
   * verify, so assume the consumer will reject) or if the target resolves.
   *
   * When the target is missing, we increment an in-memory counter and
   * delete the schedule after `missesBeforeDelete` consecutive misses. The
   * grace window protects against deploy/startup ordering races where the
   * scheduler ticks before workflows/agents finish registering on a fresh
   * process. Returns `false` to tell `#fireSchedule` to skip publishing for
   * this tick.
   */
  async #ensureTargetReady(schedule: Schedule): Promise<boolean> {
    const predicate = this.#config.isTargetReady;
    if (!predicate) return true;

    if (predicate(schedule.target)) {
      this.#missingWorkflowCounts.delete(schedule.id);
      return true;
    }

    const targetSummary =
      schedule.target.type === 'workflow'
        ? { workflowId: schedule.target.workflowId }
        : { agentId: schedule.target.agentId };

    const limit = this.#config.missesBeforeDelete ?? DEFAULT_MISSES_BEFORE_DELETE;
    const prev = this.#missingWorkflowCounts.get(schedule.id) ?? 0;
    const next = prev + 1;

    if (next < limit) {
      this.#missingWorkflowCounts.set(schedule.id, next);
      if (prev === 0) {
        this.logger.warn('Schedule target is not registered; skipping until it appears', {
          scheduleId: schedule.id,
          targetType: schedule.target.type,
          ...targetSummary,
          missesBeforeDelete: limit,
        });
      }
      return false;
    }

    // Hit the grace limit — reclaim the row.
    this.logger.error('Deleting schedule whose target has not been registered', {
      scheduleId: schedule.id,
      targetType: schedule.target.type,
      ...targetSummary,
      consecutiveMisses: next,
    });
    try {
      await this.#schedulesStore.deleteSchedule(schedule.id);
    } catch (err) {
      this.logger.error('Failed to delete ghost schedule', {
        scheduleId: schedule.id,
        targetType: schedule.target.type,
        ...targetSummary,
        error: err,
      });
      // Keep the counter so we try again next tick rather than reset and
      // start the grace window over.
      return false;
    }
    this.#missingWorkflowCounts.delete(schedule.id);
    return false;
  }

  async #fireSchedule(schedule: Schedule): Promise<void> {
    if (!(await this.#ensureTargetReady(schedule))) return;

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
      await this.#publishTargetStart(schedule, runId);
    } catch (err) {
      triggerStatus = 'failed';
      triggerError = err instanceof Error ? err.message : String(err);
      this.logger.error('Failed to publish target.start for schedule', {
        scheduleId: schedule.id,
        runId,
        targetType: schedule.target.type,
        error: err,
      });
      this.#notifyError(err, schedule.id);
    }

    // For workflow targets we record the trigger now with the claim id —
    // the workflow event processor will reuse the same runId. For
    // agent targets the AgentScheduleWorker records the trigger itself
    // after the agent run starts, so it can write the real agent runId.
    if (schedule.target.type === 'workflow' || triggerStatus === 'failed') {
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
      this.logger.error('Scheduler onError handler threw', {
        scheduleId,
        error: callbackError,
      });
    }
  }

  async #publishTargetStart(schedule: Schedule, claimId: string): Promise<void> {
    switch (schedule.target.type) {
      case 'workflow': {
        const { workflowId, inputData, initialState, requestContext } = schedule.target;
        await this.#pubsub.publish(TOPIC_WORKFLOWS, {
          type: 'workflow.start',
          runId: claimId,
          data: {
            workflowId,
            runId: claimId,
            prevResult: { status: 'success', output: inputData ?? {} },
            requestContext: requestContext ?? {},
            initialState: initialState ?? {},
          },
        });
        return;
      }
      case 'agent': {
        await this.#pubsub.publish(TOPIC_AGENT_SCHEDULES, {
          type: 'agent-schedule.fire',
          runId: claimId,
          data: {
            scheduleId: schedule.id,
            claimId,
            scheduledFireAt: schedule.nextFireAt,
            target: schedule.target,
          },
        });
        return;
      }
      default: {
        throw new Error(`Unsupported schedule target type: ${(schedule.target as { type: string }).type}`);
      }
    }
  }
}

/**
 * @deprecated Renamed to {@link Scheduler}. The scheduler now drives both
 * workflow and agent schedules, so the `Workflow`-prefixed name is no longer
 * accurate. This alias will be removed in a future major release.
 */
export const WorkflowScheduler = Scheduler;

/**
 * @deprecated Renamed to {@link Scheduler}. This alias will be removed in a
 * future major release.
 */
export type WorkflowScheduler = Scheduler;
