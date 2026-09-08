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
const DEFAULT_STALE_SKIPS_BEFORE_ESCALATION = 5;

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

  /**
   * Consecutive ticks each schedule has been skipped because the local target
   * definition is stale (see `#ensureTargetCurrent`). Doubles as the
   * "already logged" marker so a straggler doesn't re-log every tick, and as
   * the counter that escalates a skip that is never being picked up by anyone.
   *
   * Scoped to the fire window (`nextFireAt`) the skips were observed against.
   * A window that advances is proof some other instance claimed and fired the
   * previous one, so the count restarts rather than accumulating across
   * unrelated fires — otherwise a long-lived straggler would escalate even
   * though every fire is being served correctly by a current-build instance.
   */
  #staleDefinitionCounts = new Map<string, { fireAt: number; count: number }>();

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
    this.#staleDefinitionCounts.clear();

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

      // Don't keep the process alive solely because it has active schedules.
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

    if (await predicate(schedule.target)) {
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

  /**
   * Stale-build fence (#19169). Scheduled runs execute `localOnly` in the
   * claiming process against its own workflow registry, so an instance whose
   * local target definition differs from the one recorded on the schedule
   * row must not claim the fire — it would silently run an outdated step
   * graph. Returning `false` skips the CAS claim entirely, leaving
   * `nextFireAt` untouched so an instance with a matching definition can
   * claim the fire on its own tick.
   *
   * Fails open when no predicate is configured or when the predicate
   * throws — fencing is a safety net, not a reason to stop firing.
   */
  #ensureTargetCurrent(schedule: Schedule): boolean {
    const predicate = this.#config.isTargetCurrent;
    if (!predicate) return true;

    let current: boolean;
    try {
      current = predicate(schedule.target);
    } catch (err) {
      this.logger.error('isTargetCurrent predicate threw; treating target as current', {
        scheduleId: schedule.id,
        error: err,
      });
      return true;
    }

    if (current) {
      this.#staleDefinitionCounts.delete(schedule.id);
      return true;
    }

    // Only count skips against the same unclaimed fire window. If `nextFireAt`
    // has moved on, an instance with a matching definition claimed the last
    // fire and this is a fresh window, not a continuing stall.
    const prevEntry = this.#staleDefinitionCounts.get(schedule.id);
    const prev = prevEntry?.fireAt === schedule.nextFireAt ? prevEntry.count : 0;
    const next = prev + 1;
    this.#staleDefinitionCounts.set(schedule.id, { fireAt: schedule.nextFireAt, count: next });

    const targetSummary =
      schedule.target.type === 'workflow'
        ? { workflowId: schedule.target.workflowId }
        : { agentId: schedule.target.agentId };
    const limit = this.#config.staleSkipsBeforeEscalation ?? DEFAULT_STALE_SKIPS_BEFORE_ESCALATION;

    if (prev === 0) {
      this.logger.warn(
        'Local target definition differs from the schedule row; leaving fire for an instance running the current build',
        { scheduleId: schedule.id, targetType: schedule.target.type, ...targetSummary },
      );
    } else if (next === limit) {
      // Nobody has claimed this fire for `limit` consecutive ticks, which
      // means no running instance matches the row (bad rollout, or a hash the
      // reconciler wrote that no build reproduces). We deliberately do NOT
      // force the fire — running a stale graph is the bug this fence exists to
      // prevent — but a schedule that silently never runs is just as bad, so
      // escalate to an alertable error and leave a trail in schedule history.
      this.logger.error(
        'Schedule has been skipped repeatedly because no local target definition matches the schedule row; it will not fire until an instance running the recorded build is available',
        { scheduleId: schedule.id, targetType: schedule.target.type, ...targetSummary, consecutiveStaleSkips: next },
      );
      void this.#recordStaleSkip(schedule, next);
    }

    return false;
  }

  /**
   * Best-effort history entry for an escalated stale skip so the stall is
   * visible to anyone inspecting the schedule, not just in process logs.
   */
  async #recordStaleSkip(schedule: Schedule, consecutiveStaleSkips: number): Promise<void> {
    try {
      await this.#schedulesStore.recordTrigger({
        scheduleId: schedule.id,
        runId: `sched_${schedule.id}_${schedule.nextFireAt}`,
        scheduledFireAt: schedule.nextFireAt,
        actualFireAt: Date.now(),
        outcome: 'failed',
        error: `Skipped: no local target definition matches the schedule row after ${consecutiveStaleSkips} consecutive ticks`,
        triggerKind: 'schedule-fire',
      });
    } catch (err) {
      this.logger.warn('Failed to record stale-definition skip', { scheduleId: schedule.id, error: err });
    }
  }

  async #fireSchedule(schedule: Schedule): Promise<void> {
    if (!(await this.#ensureTargetReady(schedule))) return;
    if (!this.#ensureTargetCurrent(schedule)) return;

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
        const { workflowId, inputData, initialState, requestContext, definitionHash } = schedule.target;
        // Claim/execute affinity (#19169). When this process also consumes
        // workflow events, keep the fire local so the instance that proved
        // the target ready and current is the one that runs it. A
        // scheduler-only process has no local consumer, so it must publish
        // to the shared topic — the `scheduleDefinitionHash` below is what
        // protects that hop, letting a stale consumer refuse the fire
        // instead of executing its own outdated graph.
        const localOnly = this.#config.canExecuteLocally?.() === true;
        await this.#pubsub.publish(
          TOPIC_WORKFLOWS,
          {
            type: 'workflow.start',
            runId: claimId,
            data: {
              workflowId,
              runId: claimId,
              prevResult: { status: 'success', output: inputData ?? {} },
              requestContext: requestContext ?? {},
              initialState: initialState ?? {},
              // Only stamped when the row carries a hash, so legacy and
              // imperative schedules stay unfenced (fail open).
              ...(definitionHash ? { scheduleDefinitionHash: definitionHash } : {}),
            },
          },
          localOnly ? { localOnly: true } : undefined,
        );
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
