import type {
  Schedule,
  ScheduleFilter,
  ScheduleStatus,
  ScheduleTarget,
  ScheduleTrigger,
  ScheduleTriggerListOptions,
  ScheduleUpdate,
} from '@mastra/core/storage';
import {
  normalizeScheduleTarget,
  SchedulesStorage,
  TABLE_SCHEDULES,
  TABLE_SCHEDULE_TRIGGERS,
} from '@mastra/core/storage';

import { ConvexDB, resolveConvexConfig } from '../../db';
import type { ConvexDomainConfig } from '../../db';

type ScheduleRecord = {
  id: string;
  target: ScheduleTarget | string;
  cron: string;
  timezone?: string | null;
  status: ScheduleStatus;
  next_fire_at: number;
  last_fire_at?: number | null;
  last_run_id?: string | null;
  created_at: number;
  updated_at: number;
  metadata?: Record<string, unknown> | string | null;
  owner_type?: string | null;
  owner_id?: string | null;
  workflow_id?: string | null;
};

type TriggerRecord = {
  id: string;
  schedule_id: string;
  run_id?: string | null;
  scheduled_fire_at: number;
  actual_fire_at: number;
  outcome: ScheduleTrigger['outcome'];
  error?: string | null;
  trigger_kind?: ScheduleTrigger['triggerKind'] | null;
  parent_trigger_id?: string | null;
  metadata?: Record<string, unknown> | string | null;
};

const SCHEDULE_LIST_LIMIT = 8_000;

function serializeJson(value: unknown): string {
  return JSON.stringify(value);
}

function parseJson<T>(value: T | string | null | undefined): T | undefined {
  if (value == null) return undefined;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  }
  return value;
}

function isMissingSchedulesSchemaError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /(?:Table|table)\s+(?:["'`])?(?:mastra_schedules|mastra_schedule_triggers)(?:["'`])?\s+(?:is\s+)?(?:not\s+in\s+the\s+schema|not\s+found\s+in\s+schema|not\s+found|does\s+not\s+exist)/i.test(
    message,
  );
}

function scheduleToRecord(schedule: Schedule): ScheduleRecord {
  return {
    id: schedule.id,
    target: serializeJson(schedule.target),
    cron: schedule.cron,
    timezone: schedule.timezone ?? null,
    status: schedule.status,
    next_fire_at: schedule.nextFireAt,
    last_fire_at: schedule.lastFireAt ?? null,
    last_run_id: schedule.lastRunId ?? null,
    created_at: schedule.createdAt,
    updated_at: schedule.updatedAt,
    metadata: schedule.metadata == null ? null : serializeJson(schedule.metadata),
    owner_type: schedule.ownerType ?? null,
    owner_id: schedule.ownerId ?? null,
    workflow_id: schedule.target.type === 'workflow' ? schedule.target.workflowId : null,
  };
}

function recordToSchedule(record: ScheduleRecord): Schedule {
  const target = parseJson<ScheduleTarget>(record.target);
  if (!target || typeof target !== 'object' || typeof (target as { type?: unknown }).type !== 'string') {
    throw new Error(`Schedule ${record.id} has invalid target`);
  }

  const schedule: Schedule = {
    id: String(record.id),
    target: normalizeScheduleTarget(target),
    cron: String(record.cron),
    status: String(record.status) as ScheduleStatus,
    nextFireAt: Number(record.next_fire_at),
    createdAt: Number(record.created_at),
    updatedAt: Number(record.updated_at),
  };
  if (record.timezone != null) schedule.timezone = String(record.timezone);
  if (record.last_fire_at != null) schedule.lastFireAt = Number(record.last_fire_at);
  if (record.last_run_id != null) schedule.lastRunId = String(record.last_run_id);
  const metadata = parseJson<Record<string, unknown>>(record.metadata);
  if (metadata != null) schedule.metadata = metadata;
  if (record.owner_type != null) schedule.ownerType = String(record.owner_type) as Schedule['ownerType'];
  if (record.owner_id != null) schedule.ownerId = String(record.owner_id);
  return schedule;
}

function triggerToRecord(trigger: ScheduleTrigger): TriggerRecord {
  return {
    id: trigger.id ?? crypto.randomUUID(),
    schedule_id: trigger.scheduleId,
    run_id: trigger.runId,
    scheduled_fire_at: trigger.scheduledFireAt,
    actual_fire_at: trigger.actualFireAt,
    outcome: trigger.outcome,
    error: trigger.error ?? null,
    trigger_kind: trigger.triggerKind ?? 'schedule-fire',
    parent_trigger_id: trigger.parentTriggerId ?? null,
    metadata: trigger.metadata == null ? null : serializeJson(trigger.metadata),
  };
}

function recordToTrigger(record: TriggerRecord): ScheduleTrigger {
  const trigger: ScheduleTrigger = {
    id: record.id != null ? String(record.id) : undefined,
    scheduleId: String(record.schedule_id),
    runId: record.run_id != null ? String(record.run_id) : null,
    scheduledFireAt: Number(record.scheduled_fire_at),
    actualFireAt: Number(record.actual_fire_at),
    outcome: String(record.outcome) as ScheduleTrigger['outcome'],
    triggerKind:
      record.trigger_kind != null ? (String(record.trigger_kind) as ScheduleTrigger['triggerKind']) : 'schedule-fire',
  };
  if (record.error != null) trigger.error = String(record.error);
  if (record.parent_trigger_id != null) trigger.parentTriggerId = String(record.parent_trigger_id);
  const metadata = parseJson<Record<string, unknown>>(record.metadata);
  if (metadata != null) trigger.metadata = metadata;
  return trigger;
}

export class SchedulesConvex extends SchedulesStorage {
  #db: ConvexDB;

  constructor(config: ConvexDomainConfig) {
    super();
    const client = resolveConvexConfig(config);
    this.#db = new ConvexDB(client);
  }

  async init(): Promise<void> {
    // No-op for Convex; schema is managed server-side.
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.clearTable({ tableName: TABLE_SCHEDULE_TRIGGERS });
    await this.#db.clearTable({ tableName: TABLE_SCHEDULES });
  }

  async createSchedule(schedule: Schedule): Promise<Schedule> {
    await this.#db.createSchedule(scheduleToRecord(schedule));
    return schedule;
  }

  async getSchedule(id: string): Promise<Schedule | null> {
    const record = await this.#db.load<ScheduleRecord | null>({ tableName: TABLE_SCHEDULES, keys: { id } });
    return record ? recordToSchedule(record) : null;
  }

  async listSchedules(filter?: ScheduleFilter): Promise<Schedule[]> {
    const queryFilters: Array<{ field: string; value: string | null }> = [];
    if (filter?.status) queryFilters.push({ field: 'status', value: filter.status });
    if (filter?.ownerType !== undefined && filter.ownerType !== null) {
      queryFilters.push({ field: 'owner_type', value: filter.ownerType });
    }
    if (filter?.ownerType === null) {
      queryFilters.push({ field: 'owner_type', value: null });
    }
    if (filter?.ownerId !== undefined && filter.ownerId !== null) {
      queryFilters.push({ field: 'owner_id', value: filter.ownerId });
    }
    if (filter?.ownerId === null) {
      queryFilters.push({ field: 'owner_id', value: null });
    }
    if (filter?.workflowId) queryFilters.push({ field: 'workflow_id', value: filter.workflowId });

    let records: ScheduleRecord[];
    try {
      records = await this.#db.queryTable<ScheduleRecord>(
        TABLE_SCHEDULES,
        queryFilters.length ? queryFilters : undefined,
        undefined,
        SCHEDULE_LIST_LIMIT,
      );
    } catch (error) {
      if (isMissingSchedulesSchemaError(error)) {
        this.logger.warn('Convex schedules schema is not available; returning no schedules', { error });
        return [];
      }
      throw error;
    }

    if (records.length >= SCHEDULE_LIST_LIMIT) {
      this.logger.warn('Convex schedules list reached the adapter limit; results may be truncated', {
        limit: SCHEDULE_LIST_LIMIT,
      });
    }

    let schedules = records.map(recordToSchedule);

    if (filter?.workflowId) {
      schedules = schedules.filter(
        schedule => schedule.target.type === 'workflow' && schedule.target.workflowId === filter.workflowId,
      );
    }
    if (filter?.ownerType === null) {
      schedules = schedules.filter(schedule => (schedule.ownerType ?? null) === null);
    }
    if (filter?.ownerId === null) {
      schedules = schedules.filter(schedule => (schedule.ownerId ?? null) === null);
    }

    schedules.sort((a, b) => a.createdAt - b.createdAt);
    return schedules;
  }

  async listDueSchedules(now: number, limit?: number): Promise<Schedule[]> {
    let records: ScheduleRecord[];
    try {
      records = await this.#db.listDueSchedules<ScheduleRecord>(now, limit);
    } catch (error) {
      if (isMissingSchedulesSchemaError(error)) {
        this.logger.warn('Convex schedules schema is not available; returning no due schedules', { error });
        return [];
      }
      throw error;
    }
    return records.map(recordToSchedule);
  }

  async updateSchedule(id: string, patch: ScheduleUpdate): Promise<Schedule> {
    const updates: Record<string, unknown> = {};
    if ('cron' in patch && patch.cron !== undefined) {
      updates.cron = patch.cron;
    }
    if ('timezone' in patch) {
      updates.timezone = patch.timezone ?? null;
    }
    if ('status' in patch && patch.status !== undefined) {
      updates.status = patch.status;
    }
    if ('nextFireAt' in patch && patch.nextFireAt !== undefined) {
      updates.next_fire_at = patch.nextFireAt;
    }
    if ('target' in patch && patch.target !== undefined) {
      updates.target = serializeJson(patch.target);
      updates.workflow_id = patch.target.type === 'workflow' ? patch.target.workflowId : null;
    }
    if ('metadata' in patch) {
      updates.metadata = patch.metadata == null ? null : serializeJson(patch.metadata);
    }
    if ('ownerType' in patch) {
      updates.owner_type = patch.ownerType ?? null;
    }
    if ('ownerId' in patch) {
      updates.owner_id = patch.ownerId ?? null;
    }

    if (Object.keys(updates).length === 0) {
      const existing = await this.getSchedule(id);
      if (!existing) {
        throw new Error(`Schedule ${id} not found`);
      }
      return existing;
    }

    updates.updated_at = Date.now();
    const updated = await this.#db.updateSchedule<ScheduleRecord>({ id, patch: updates });
    return recordToSchedule(updated);
  }

  async updateScheduleNextFire(
    id: string,
    expectedNextFireAt: number,
    newNextFireAt: number,
    lastFireAt: number,
    lastRunId: string,
  ): Promise<boolean> {
    return this.#db.updateScheduleNextFire({
      id,
      expectedNextFireAt,
      newNextFireAt,
      lastFireAt,
      lastRunId,
    });
  }

  async deleteSchedule(id: string): Promise<void> {
    await this.#db.deleteScheduleTriggers(id);
    await this.#db.deleteMany(TABLE_SCHEDULES, [id]);
  }

  async recordTrigger(trigger: ScheduleTrigger): Promise<void> {
    await this.#db.recordScheduleTrigger(triggerToRecord(trigger));
  }

  async listTriggers(scheduleId: string, opts?: ScheduleTriggerListOptions): Promise<ScheduleTrigger[]> {
    const triggers = await this.#db.listScheduleTriggers<TriggerRecord>({
      scheduleId,
      fromActualFireAt: opts?.fromActualFireAt,
      toActualFireAt: opts?.toActualFireAt,
      limit: opts?.limit,
    });
    return triggers.map(recordToTrigger);
  }
}
