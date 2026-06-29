import type { HeartbeatIfActive, HeartbeatIfIdle } from '../../../agent/heartbeat/types';
import type { AgentSignalAttributes, AgentSignalType } from '../../../agent/signals';
import { StorageDomain } from '../base';

/**
 * Discriminated union describing what a schedule fires.
 *
 * `workflow` targets publish a `workflow.start` event on the `workflows`
 * pubsub topic and are processed by the orchestration worker. `heartbeat`
 * targets publish a `heartbeat.fire` event on the `heartbeats` pubsub
 * topic and are processed by the {@link HeartbeatWorker}, which runs the
 * referenced agent directly (no workflow indirection).
 */
export type ScheduleTarget = WorkflowScheduleTarget | HeartbeatScheduleTarget;

export type WorkflowScheduleTarget = {
  type: 'workflow';
  workflowId: string;
  inputData?: unknown;
  initialState?: unknown;
  requestContext?: Record<string, unknown>;
};

// Heartbeat semantic types are owned by `agent/heartbeat/types.ts` (the
// feature module) and re-exported here so callers describing schedule rows can
// reach them through the storage barrel.
export type { HeartbeatIfActive, HeartbeatIfIdle } from '../../../agent/heartbeat/types';

/**
 * Schedule target that fires an agent run on a cron. The heartbeat
 * worker reads these fields and runs the referenced agent directly —
 * either via `sendSignal` (when `threadId` is set) or `agent.generate`
 * (threadless). The agent's `runId` is recorded on the trigger row for
 * UI linkability into chat / observability traces.
 */
export type HeartbeatScheduleTarget = {
  type: 'heartbeat';
  agentId: string;
  prompt: string;
  /**
   * Free-form label for distinguishing multiple heartbeats on the same
   * agent/thread (e.g. `'morning-checkin'`). Optional; filterable via
   * `mastra.heartbeats.list({ name })`.
   */
  name?: string;
  /** Threaded heartbeats send a signal into this thread. */
  threadId?: string;
  /** Required when `threadId` is set. */
  resourceId?: string;
  /** Signal type used by threaded heartbeats. Defaults to `'notification'`. */
  signalType?: AgentSignalType;
  /** XML tag the signal renders as. Defaults to `'heartbeat'`. */
  tagName?: string;
  /** Signal attributes rendered onto the XML tag. */
  attributes?: AgentSignalAttributes;
  /** Provider options merged into the heartbeat signal payload on every fire. JSON-safe. */
  providerOptions?: Record<string, unknown>;
  /** Options applied when the target thread is actively streaming. Threaded only. */
  ifActive?: HeartbeatIfActive;
  /** Options applied when the target thread is idle (incl. serializable streamOptions). Threaded only. */
  ifIdle?: HeartbeatIfIdle;
  /** Arbitrary metadata stored alongside the schedule row. */
  metadata?: Record<string, unknown>;
  requestContext?: Record<string, unknown>;
};

/** Lifecycle status of a schedule row. */
export type ScheduleStatus = 'active' | 'paused';

/**
 * Polymorphic owner of a schedule. Workflow schedules created via
 * `createWorkflow({ schedule })` leave both fields null. Heartbeat
 * schedules created via `mastra.heartbeats.create(...)` set
 * `ownerType: 'agent'` and `ownerId` to the agent id. Future schedule
 * types (tenant-owned, workflow-owned, etc.) can use the same shape
 * without a migration.
 */
export type ScheduleOwnerType = 'agent' | (string & {});

/**
 * A persisted schedule.
 *
 * `nextFireAt` is advanced atomically by the scheduler before publishing
 * a trigger event, providing CAS-style dedup across multiple instances
 * polling the same storage.
 */
export type Schedule = {
  id: string;
  target: ScheduleTarget;
  cron: string;
  timezone?: string;
  status: ScheduleStatus;
  nextFireAt: number;
  lastFireAt?: number;
  lastRunId?: string;
  createdAt: number;
  updatedAt: number;
  metadata?: Record<string, unknown>;
  /** Optional owner classification (e.g. 'agent' for heartbeats). */
  ownerType?: ScheduleOwnerType;
  /** Optional owner identifier paired with `ownerType`. */
  ownerId?: string;
};

/**
 * Outcome of an individual schedule trigger attempt.
 *
 * Shared across all schedule target types (workflows, heartbeats, …).
 *
 * Workflow outcomes:
 * - `published`  — workflow run was successfully dispatched to the workflow
 *                  engine. Write-once at dispatch time; the trigger row is
 *                  not updated when the run later completes.
 * - `failed`     — dispatch threw (workflow or heartbeat).
 *
 * Heartbeat outcomes (terminal — written after the run/signal resolves):
 * - `succeeded`  — the heartbeat agent run finished without error.
 * - `delivered`  — the heartbeat signal joined an active run on the target
 *                  thread instead of starting a new one (`ifActive: 'deliver'`).
 * - `persisted`  — the signal was saved to memory without triggering a run
 *                  (`ifActive: 'persist'` or `ifIdle: 'persist'`).
 * - `discarded`  — the signal was dropped without effect
 *                  (`ifActive: 'discard'` or `ifIdle: 'discard'`).
 * - `skipped`    — the user `prepare` hook returned `null`, asking the worker
 *                  to skip this fire entirely.
 * - `aborted`    — the agent run was aborted mid-stream.
 *
 * Legacy outcomes (no longer written, kept readable for rows persisted by
 * older builds so that listing/exhaustive handling does not break):
 * - `acked`, `alerted`, `deferred`, `appended-from-queue`, `dropped-stale`,
 *   `dropped-superseded`, `dropped-busy`.
 */
export type ScheduleTriggerOutcome =
  | 'published'
  | 'succeeded'
  | 'delivered'
  | 'persisted'
  | 'discarded'
  | 'skipped'
  | 'aborted'
  | 'failed'
  // Legacy queue/notification outcomes — never written by current code, but
  // older trigger rows may still carry them. Retained so reads stay typed.
  | 'acked'
  | 'alerted'
  | 'deferred'
  | 'appended-from-queue'
  | 'dropped-stale'
  | 'dropped-superseded'
  | 'dropped-busy';

/**
 * Distinguishes a tick-loop schedule fire from a deferred drain event or a
 * manual ("fire now") invocation. Drain rows reference the original fire
 * via `parentTriggerId`.
 */
export type ScheduleTriggerKind = 'schedule-fire' | 'queue-drain' | 'manual';

/** Audit record produced for each trigger attempt. */
export type ScheduleTrigger = {
  /** Stable trigger row id. Generated by storage when omitted on write. */
  id?: string;
  scheduleId: string;
  /**
   * Identifier of the downstream run produced by this fire.
   *
   * For workflow targets this is the workflow run id (`sched_<scheduleId>_<ts>`).
   * For heartbeat targets this is the agent run id recorded by the
   * {@link HeartbeatWorker} after the agent run starts. May be null for
   * drain rows or fires that failed before producing a run id.
   */
  runId: string | null;
  scheduledFireAt: number;
  actualFireAt: number;
  outcome: ScheduleTriggerOutcome;
  error?: string;
  /** Defaults to `'schedule-fire'` when omitted. */
  triggerKind?: ScheduleTriggerKind;
  /** Pointer back to the originating fire row when `triggerKind === 'queue-drain'`. */
  parentTriggerId?: string;
  /** Outcome-specific context (alert text, append message id, queue age, etc.). */
  metadata?: Record<string, unknown>;
};

/** Filter options for listing schedules. */
export type ScheduleFilter = {
  status?: ScheduleStatus;
  workflowId?: string;
  /** `null` matches schedules with no owner (e.g. workflow-only schedules). */
  ownerType?: ScheduleOwnerType | null;
  /** `null` matches schedules with no owner id. */
  ownerId?: string | null;
};

/** Filter / pagination options for listing trigger history. */
export type ScheduleTriggerListOptions = {
  limit?: number;
  /** Inclusive lower bound on actualFireAt (ms epoch). */
  fromActualFireAt?: number;
  /** Exclusive upper bound on actualFireAt (ms epoch). */
  toActualFireAt?: number;
};

/** Fields that can be patched via {@link SchedulesStorage.updateSchedule}. */
export type ScheduleUpdate = Partial<
  Pick<Schedule, 'cron' | 'timezone' | 'status' | 'nextFireAt' | 'metadata' | 'target' | 'ownerType' | 'ownerId'>
>;

/**
 * Abstract storage domain for workflow schedules.
 *
 * Powers the {@link Scheduler}: the scheduler's tick loop polls
 * `listDueSchedules`, atomically advances `nextFireAt` via
 * `updateScheduleNextFire` (CAS), publishes a `workflow.start` event on
 * the `workflows` pubsub topic, and records the trigger via `recordTrigger`.
 */
export abstract class SchedulesStorage extends StorageDomain {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'SCHEDULES',
    });
  }

  async dangerouslyClearAll(): Promise<void> {
    // Default no-op — subclasses override
  }

  /** Insert a new schedule row. Throws if a row with the same id already exists. Returns the stored row. */
  abstract createSchedule(schedule: Schedule): Promise<Schedule>;

  /** Get a single schedule by id. Returns null if not found. */
  abstract getSchedule(id: string): Promise<Schedule | null>;

  /** List schedules matching the filter (no pagination — schedule counts are expected to stay small). */
  abstract listSchedules(filter?: ScheduleFilter): Promise<Schedule[]>;

  /**
   * List schedules whose `nextFireAt <= now` and whose `status === 'active'`.
   * Used by the scheduler tick loop.
   */
  abstract listDueSchedules(now: number, limit?: number): Promise<Schedule[]>;

  /** Partial update of a schedule row. */
  abstract updateSchedule(id: string, patch: ScheduleUpdate): Promise<Schedule>;

  /**
   * Compare-and-swap update of `nextFireAt`. Used by the scheduler to claim
   * a fire before publishing — only one tick across many processes will succeed.
   *
   * Returns true if the row's `nextFireAt` matched `expectedNextFireAt` and
   * was advanced to `newNextFireAt`. Returns false if another instance
   * already advanced it (meaning the caller should skip publishing).
   */
  abstract updateScheduleNextFire(
    id: string,
    expectedNextFireAt: number,
    newNextFireAt: number,
    lastFireAt: number,
    lastRunId: string,
  ): Promise<boolean>;

  /** Delete a schedule and its trigger history. */
  abstract deleteSchedule(id: string): Promise<void>;

  /** Append an entry to a schedule's trigger history. */
  abstract recordTrigger(trigger: ScheduleTrigger): Promise<void>;

  /** List trigger history for a schedule, newest first. */
  abstract listTriggers(scheduleId: string, opts?: ScheduleTriggerListOptions): Promise<ScheduleTrigger[]>;
}
