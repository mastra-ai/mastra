import { StorageDomain } from '../base';

/**
 * Discriminated union describing what a schedule fires.
 *
 * Only the `workflow` variant is implemented in v1. Future targets
 * (e.g. `agent-signal`) can be added without a schema migration.
 */
export type ScheduleTarget = {
  type: 'workflow';
  workflowId: string;
  inputData?: unknown;
  initialState?: unknown;
  requestContext?: Record<string, unknown>;
};

/** Lifecycle status of a schedule row. */
export type ScheduleStatus = 'active' | 'paused';

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
};

/** Status of an individual schedule trigger attempt. */
export type ScheduleTriggerStatus = 'published' | 'failed';

/** Audit record produced for each trigger attempt. */
export type ScheduleTrigger = {
  scheduleId: string;
  runId: string;
  scheduledFireAt: number;
  actualFireAt: number;
  status: ScheduleTriggerStatus;
  error?: string;
};

/** Filter options for listing schedules. */
export type ScheduleFilter = {
  status?: ScheduleStatus;
  workflowId?: string;
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
  Pick<Schedule, 'cron' | 'timezone' | 'status' | 'nextFireAt' | 'metadata' | 'target'>
>;

/**
 * Abstract storage domain for workflow schedules.
 *
 * Powers the {@link WorkflowScheduler}: the scheduler's tick loop polls
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
