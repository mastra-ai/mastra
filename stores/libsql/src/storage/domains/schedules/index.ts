import type { Client, InValue } from '@libsql/client';
import type {
  Schedule,
  ScheduleFilter,
  ScheduleTrigger,
  ScheduleTriggerListOptions,
  ScheduleStatus,
  ScheduleTarget,
  ScheduleUpdate,
} from '@mastra/core/storage';
import { SchedulesStorage, TABLE_SCHEDULES, TABLE_SCHEDULE_TRIGGERS, TABLE_SCHEMAS } from '@mastra/core/storage';
import { LibSQLDB, resolveClient } from '../../db';
import type { LibSQLDomainConfig } from '../../db';
import { buildSelectColumns } from '../../db/utils';

function parseJson<T = unknown>(val: unknown): T | undefined {
  if (val == null) return undefined;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val) as T;
    } catch {
      return val as T;
    }
  }
  return val as T;
}

function toNumber(val: unknown): number {
  if (typeof val === 'bigint') return Number(val);
  return Number(val);
}

function rowToSchedule(row: Record<string, any>): Schedule {
  const target = parseJson<ScheduleTarget>(row.target);
  if (!target) {
    throw new Error(`Schedule row ${row.id} has invalid target`);
  }
  const schedule: Schedule = {
    id: String(row.id),
    target,
    cron: String(row.cron),
    status: String(row.status) as ScheduleStatus,
    nextFireAt: toNumber(row.next_fire_at),
    createdAt: toNumber(row.created_at),
    updatedAt: toNumber(row.updated_at),
  };
  if (row.timezone != null) schedule.timezone = String(row.timezone);
  if (row.last_fire_at != null) schedule.lastFireAt = toNumber(row.last_fire_at);
  if (row.last_run_id != null) schedule.lastRunId = String(row.last_run_id);
  const metadata = parseJson<Record<string, unknown>>(row.metadata);
  if (metadata !== undefined) schedule.metadata = metadata;
  if (row.owner_type != null) schedule.ownerType = String(row.owner_type) as Schedule['ownerType'];
  if (row.owner_id != null) schedule.ownerId = String(row.owner_id);
  return schedule;
}

function rowToTrigger(row: Record<string, any>): ScheduleTrigger {
  const trigger: ScheduleTrigger = {
    id: row.id != null ? String(row.id) : undefined,
    scheduleId: String(row.schedule_id),
    runId: row.run_id != null ? String(row.run_id) : null,
    scheduledFireAt: toNumber(row.scheduled_fire_at),
    actualFireAt: toNumber(row.actual_fire_at),
    outcome: String(row.outcome) as ScheduleTrigger['outcome'],
    triggerKind:
      row.trigger_kind != null ? (String(row.trigger_kind) as ScheduleTrigger['triggerKind']) : 'schedule-fire',
  };
  if (row.error != null) trigger.error = String(row.error);
  if (row.parent_trigger_id != null) trigger.parentTriggerId = String(row.parent_trigger_id);
  const metadata = parseJson<Record<string, unknown>>(row.metadata);
  if (metadata !== undefined) trigger.metadata = metadata;
  return trigger;
}

export class SchedulesLibSQL extends SchedulesStorage {
  #db: LibSQLDB;
  #client: Client;

  constructor(config: LibSQLDomainConfig) {
    super();
    const client = resolveClient(config);
    this.#client = client;
    this.#db = new LibSQLDB({ client, maxRetries: config.maxRetries, initialBackoffMs: config.initialBackoffMs });
  }

  async init(): Promise<void> {
    await this.#db.createTable({
      tableName: TABLE_SCHEDULES,
      schema: TABLE_SCHEMAS[TABLE_SCHEDULES],
    });
    await this.#db.createTable({
      tableName: TABLE_SCHEDULE_TRIGGERS,
      schema: TABLE_SCHEMAS[TABLE_SCHEDULE_TRIGGERS],
    });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.deleteData({ tableName: TABLE_SCHEDULE_TRIGGERS });
    await this.#db.deleteData({ tableName: TABLE_SCHEDULES });
  }

  async createSchedule(schedule: Schedule): Promise<Schedule> {
    const existing = await this.getSchedule(schedule.id);
    if (existing) {
      throw new Error(`Schedule with id "${schedule.id}" already exists`);
    }
    await this.#db.insert({
      tableName: TABLE_SCHEDULES,
      record: {
        id: schedule.id,
        target: schedule.target,
        cron: schedule.cron,
        timezone: schedule.timezone ?? null,
        status: schedule.status,
        next_fire_at: schedule.nextFireAt,
        last_fire_at: schedule.lastFireAt ?? null,
        last_run_id: schedule.lastRunId ?? null,
        created_at: schedule.createdAt,
        updated_at: schedule.updatedAt,
        metadata: schedule.metadata ?? null,
        owner_type: schedule.ownerType ?? null,
        owner_id: schedule.ownerId ?? null,
      },
    });
    return schedule;
  }

  async getSchedule(id: string): Promise<Schedule | null> {
    const result = await this.#client.execute({
      sql: `SELECT ${buildSelectColumns(TABLE_SCHEDULES)} FROM ${TABLE_SCHEDULES} WHERE id = ?`,
      args: [id],
    });
    const row = result.rows[0];
    return row ? rowToSchedule(row as Record<string, any>) : null;
  }

  async listSchedules(filter?: ScheduleFilter): Promise<Schedule[]> {
    const conditions: string[] = [];
    const params: InValue[] = [];

    if (filter?.status) {
      conditions.push('status = ?');
      params.push(filter.status);
    }
    if (filter?.workflowId) {
      // target is JSON; SQLite json_extract works on TEXT and JSONB
      conditions.push("json_extract(target, '$.workflowId') = ?");
      params.push(filter.workflowId);
    }
    if (filter?.ownerType !== undefined) {
      if (filter.ownerType === null) {
        conditions.push('owner_type IS NULL');
      } else {
        conditions.push('owner_type = ?');
        params.push(filter.ownerType);
      }
    }
    if (filter?.ownerId !== undefined) {
      if (filter.ownerId === null) {
        conditions.push('owner_id IS NULL');
      } else {
        conditions.push('owner_id = ?');
        params.push(filter.ownerId);
      }
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await this.#client.execute({
      sql: `SELECT ${buildSelectColumns(TABLE_SCHEDULES)} FROM ${TABLE_SCHEDULES} ${where} ORDER BY created_at ASC`,
      args: params,
    });
    return result.rows.map(r => rowToSchedule(r as Record<string, any>));
  }

  async listDueSchedules(now: number, limit?: number): Promise<Schedule[]> {
    const cap = limit ?? 100;
    const result = await this.#client.execute({
      sql: `SELECT ${buildSelectColumns(TABLE_SCHEDULES)} FROM ${TABLE_SCHEDULES}
            WHERE status = ? AND next_fire_at <= ?
            ORDER BY next_fire_at ASC
            LIMIT ?`,
      args: ['active', now, cap],
    });
    return result.rows.map(r => rowToSchedule(r as Record<string, any>));
  }

  async updateSchedule(id: string, patch: ScheduleUpdate): Promise<Schedule> {
    const setClauses: string[] = [];
    const params: InValue[] = [];

    if ('cron' in patch && patch.cron !== undefined) {
      setClauses.push('cron = ?');
      params.push(patch.cron);
    }
    if ('timezone' in patch) {
      setClauses.push('timezone = ?');
      params.push(patch.timezone ?? null);
    }
    if ('status' in patch && patch.status !== undefined) {
      setClauses.push('status = ?');
      params.push(patch.status);
    }
    if ('nextFireAt' in patch && patch.nextFireAt !== undefined) {
      setClauses.push('next_fire_at = ?');
      params.push(patch.nextFireAt);
    }
    if ('target' in patch && patch.target !== undefined) {
      setClauses.push('target = jsonb(?)');
      params.push(JSON.stringify(patch.target));
    }
    if ('metadata' in patch) {
      setClauses.push('metadata = jsonb(?)');
      params.push(patch.metadata != null ? JSON.stringify(patch.metadata) : null);
    }
    if ('ownerType' in patch) {
      setClauses.push('owner_type = ?');
      params.push((patch.ownerType as string | undefined) ?? null);
    }
    if ('ownerId' in patch) {
      setClauses.push('owner_id = ?');
      params.push((patch.ownerId as string | undefined) ?? null);
    }

    setClauses.push('updated_at = ?');
    params.push(Date.now());
    params.push(id);

    if (setClauses.length === 1) {
      // Only updated_at — nothing meaningful to patch
      const existing = await this.getSchedule(id);
      if (!existing) throw new Error(`Schedule ${id} not found`);
      return existing;
    }

    await this.#client.execute({
      sql: `UPDATE ${TABLE_SCHEDULES} SET ${setClauses.join(', ')} WHERE id = ?`,
      args: params,
    });

    const updated = await this.getSchedule(id);
    if (!updated) throw new Error(`Schedule ${id} not found`);
    return updated;
  }

  async updateScheduleNextFire(
    id: string,
    expectedNextFireAt: number,
    newNextFireAt: number,
    lastFireAt: number,
    lastRunId: string,
  ): Promise<boolean> {
    const result = await this.#client.execute({
      sql: `UPDATE ${TABLE_SCHEDULES}
            SET next_fire_at = ?, last_fire_at = ?, last_run_id = ?, updated_at = ?
            WHERE id = ? AND next_fire_at = ? AND status = ?`,
      args: [newNextFireAt, lastFireAt, lastRunId, Date.now(), id, expectedNextFireAt, 'active'],
    });
    return (result.rowsAffected ?? 0) > 0;
  }

  async deleteSchedule(id: string): Promise<void> {
    await this.#client.execute({
      sql: `DELETE FROM ${TABLE_SCHEDULE_TRIGGERS} WHERE schedule_id = ?`,
      args: [id],
    });
    await this.#client.execute({
      sql: `DELETE FROM ${TABLE_SCHEDULES} WHERE id = ?`,
      args: [id],
    });
  }

  async recordTrigger(trigger: ScheduleTrigger): Promise<void> {
    const id = trigger.id ?? crypto.randomUUID();
    await this.#db.insert({
      tableName: TABLE_SCHEDULE_TRIGGERS,
      record: {
        id,
        schedule_id: trigger.scheduleId,
        run_id: trigger.runId,
        scheduled_fire_at: trigger.scheduledFireAt,
        actual_fire_at: trigger.actualFireAt,
        outcome: trigger.outcome,
        error: trigger.error ?? null,
        trigger_kind: trigger.triggerKind ?? 'schedule-fire',
        parent_trigger_id: trigger.parentTriggerId ?? null,
        metadata: trigger.metadata ?? null,
      },
    });
  }

  async listTriggers(scheduleId: string, opts?: ScheduleTriggerListOptions): Promise<ScheduleTrigger[]> {
    const conditions: string[] = ['schedule_id = ?'];
    const params: InValue[] = [scheduleId];

    if (opts?.fromActualFireAt != null) {
      conditions.push('actual_fire_at >= ?');
      params.push(opts.fromActualFireAt);
    }
    if (opts?.toActualFireAt != null) {
      conditions.push('actual_fire_at < ?');
      params.push(opts.toActualFireAt);
    }

    const limitClause = opts?.limit != null ? `LIMIT ${Math.floor(opts.limit)}` : '';
    const result = await this.#client.execute({
      sql: `SELECT ${buildSelectColumns(TABLE_SCHEDULE_TRIGGERS)} FROM ${TABLE_SCHEDULE_TRIGGERS}
            WHERE ${conditions.join(' AND ')}
            ORDER BY actual_fire_at DESC
            ${limitClause}`,
      args: params,
    });
    return result.rows.map(r => rowToTrigger(r as Record<string, any>));
  }
}
