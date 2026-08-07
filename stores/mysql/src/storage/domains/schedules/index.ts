import { randomUUID } from 'node:crypto';
import {
  normalizeScheduleTarget,
  SchedulesStorage,
  TABLE_SCHEDULES,
  TABLE_SCHEDULE_TRIGGERS,
  TABLE_SCHEMAS,
} from '@mastra/core/storage';
import type {
  Schedule,
  ScheduleFilter,
  ScheduleTrigger,
  ScheduleTriggerListOptions,
  ScheduleStatus,
  ScheduleTarget,
  ScheduleUpdate,
  CreateIndexOptions,
} from '@mastra/core/storage';
import type { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';

import type { StoreOperationsMySQL } from '../operations';
import { generateTableSQL, generateIndexSQL } from '../operations';
import { formatTableName, quoteIdentifier } from '../utils';

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
    target: normalizeScheduleTarget(target),
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

export class SchedulesMySQL extends SchedulesStorage {
  private pool: Pool;
  private operations: StoreOperationsMySQL;
  #skipDefaultIndexes?: boolean;
  #indexes?: CreateIndexOptions[];

  static readonly MANAGED_TABLES = [TABLE_SCHEDULES, TABLE_SCHEDULE_TRIGGERS] as const;

  constructor({
    pool,
    operations,
    skipDefaultIndexes,
    indexes,
  }: {
    pool: Pool;
    operations: StoreOperationsMySQL;
    skipDefaultIndexes?: boolean;
    indexes?: CreateIndexOptions[];
  }) {
    super();
    this.pool = pool;
    this.operations = operations;
    this.#skipDefaultIndexes = skipDefaultIndexes;
    this.#indexes = indexes?.filter(idx => (SchedulesMySQL.MANAGED_TABLES as readonly string[]).includes(idx.table));
  }

  async init(): Promise<void> {
    await this.operations.createTable({
      tableName: TABLE_SCHEDULES,
      schema: TABLE_SCHEMAS[TABLE_SCHEDULES],
    });
    await this.operations.createTable({
      tableName: TABLE_SCHEDULE_TRIGGERS,
      schema: TABLE_SCHEMAS[TABLE_SCHEDULE_TRIGGERS],
    });
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  static getDefaultIndexDefs(prefix: string = ''): CreateIndexOptions[] {
    return [
      {
        name: `${prefix}idx_mastra_schedules_status_next_fire`,
        table: TABLE_SCHEDULES,
        columns: ['status', 'next_fire_at'],
      },
      {
        name: `${prefix}idx_mastra_schedule_triggers_schedule_fire`,
        table: TABLE_SCHEDULE_TRIGGERS,
        columns: ['schedule_id', 'actual_fire_at DESC'],
      },
    ];
  }

  static getExportDDL(): string[] {
    const statements: string[] = [];

    statements.push(
      generateTableSQL({
        tableName: TABLE_SCHEDULES,
        schema: TABLE_SCHEMAS[TABLE_SCHEDULES],
      }),
    );
    statements.push(
      generateTableSQL({
        tableName: TABLE_SCHEDULE_TRIGGERS,
        schema: TABLE_SCHEMAS[TABLE_SCHEDULE_TRIGGERS],
      }),
    );

    for (const idx of SchedulesMySQL.getDefaultIndexDefs()) {
      statements.push(generateIndexSQL(idx));
    }

    return statements;
  }

  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    return SchedulesMySQL.getDefaultIndexDefs('');
  }

  async createDefaultIndexes(): Promise<void> {
    if (this.#skipDefaultIndexes) return;
    for (const indexDef of this.getDefaultIndexDefinitions()) {
      await this.operations.createIndex(indexDef);
    }
  }

  async createCustomIndexes(): Promise<void> {
    if (!this.#indexes || this.#indexes.length === 0) return;
    for (const indexDef of this.#indexes) {
      await this.operations.createIndex(indexDef);
    }
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.operations.clearTable({ tableName: TABLE_SCHEDULE_TRIGGERS });
    await this.operations.clearTable({ tableName: TABLE_SCHEDULES });
  }

  async createSchedule(schedule: Schedule): Promise<Schedule> {
    const existing = await this.getSchedule(schedule.id);
    if (existing) {
      throw new Error(`Schedule with id "${schedule.id}" already exists`);
    }
    await this.pool.execute(
      `INSERT INTO ${formatTableName(TABLE_SCHEDULES)} (${quoteIdentifier('id', 'column name')}, ${quoteIdentifier('target', 'column name')}, ${quoteIdentifier('cron', 'column name')}, ${quoteIdentifier('timezone', 'column name')}, ${quoteIdentifier('status', 'column name')}, ${quoteIdentifier('next_fire_at', 'column name')}, ${quoteIdentifier('last_fire_at', 'column name')}, ${quoteIdentifier('last_run_id', 'column name')}, ${quoteIdentifier('created_at', 'column name')}, ${quoteIdentifier('updated_at', 'column name')}, ${quoteIdentifier('metadata', 'column name')}, ${quoteIdentifier('owner_type', 'column name')}, ${quoteIdentifier('owner_id', 'column name')}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        schedule.id,
        JSON.stringify(schedule.target),
        schedule.cron,
        schedule.timezone ?? null,
        schedule.status,
        schedule.nextFireAt,
        schedule.lastFireAt ?? null,
        schedule.lastRunId ?? null,
        schedule.createdAt,
        schedule.updatedAt,
        schedule.metadata ? JSON.stringify(schedule.metadata) : null,
        schedule.ownerType ?? null,
        schedule.ownerId ?? null,
      ],
    );
    return schedule;
  }

  async getSchedule(id: string): Promise<Schedule | null> {
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      `SELECT * FROM ${formatTableName(TABLE_SCHEDULES)} WHERE ${quoteIdentifier('id', 'column name')} = ?`,
      [id],
    );
    const row = rows[0];
    return row ? rowToSchedule(row as Record<string, any>) : null;
  }

  async listSchedules(filter?: ScheduleFilter): Promise<Schedule[]> {
    const conditions: string[] = [];
    const params: (string | number | null)[] = [];

    if (filter?.status) {
      conditions.push(`${quoteIdentifier('status', 'column name')} = ?`);
      params.push(filter.status);
    }
    if (filter?.workflowId) {
      // target is JSON; MySQL JSON_EXTRACT
      conditions.push(`JSON_EXTRACT(${quoteIdentifier('target', 'column name')}, '$.workflowId') = ?`);
      params.push(filter.workflowId);
    }
    if (filter?.ownerType !== undefined) {
      if (filter.ownerType === null) {
        conditions.push(`${quoteIdentifier('owner_type', 'column name')} IS NULL`);
      } else {
        conditions.push(`${quoteIdentifier('owner_type', 'column name')} = ?`);
        params.push(filter.ownerType);
      }
    }
    if (filter?.ownerId !== undefined) {
      if (filter.ownerId === null) {
        conditions.push(`${quoteIdentifier('owner_id', 'column name')} IS NULL`);
      } else {
        conditions.push(`${quoteIdentifier('owner_id', 'column name')} = ?`);
        params.push(filter.ownerId);
      }
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      `SELECT * FROM ${formatTableName(TABLE_SCHEDULES)} ${where} ORDER BY ${quoteIdentifier('created_at', 'column name')} ASC`,
      params,
    );
    return rows.map(r => rowToSchedule(r as Record<string, any>));
  }

  async listDueSchedules(now: number, limit?: number): Promise<Schedule[]> {
    const cap = limit ?? 100;
    const [rows] = await this.pool.query<RowDataPacket[]>(
      `SELECT * FROM ${formatTableName(TABLE_SCHEDULES)} WHERE ${quoteIdentifier('status', 'column name')} = ? AND ${quoteIdentifier('next_fire_at', 'column name')} <= ? ORDER BY ${quoteIdentifier('next_fire_at', 'column name')} ASC LIMIT ?`,
      ['active', String(now), cap],
    );
    return rows.map(r => rowToSchedule(r as Record<string, any>));
  }

  async updateSchedule(id: string, update: ScheduleUpdate): Promise<Schedule> {
    const setClauses: string[] = [];
    const params: (string | number | null)[] = [];

    if ('cron' in update) {
      setClauses.push(`${quoteIdentifier('cron', 'column name')} = ?`);
      params.push(update.cron as string);
    }
    if ('timezone' in update) {
      setClauses.push(`${quoteIdentifier('timezone', 'column name')} = ?`);
      params.push((update.timezone as string) ?? null);
    }
    if ('status' in update) {
      setClauses.push(`${quoteIdentifier('status', 'column name')} = ?`);
      params.push(update.status as string);
    }
    if ('nextFireAt' in update) {
      setClauses.push(`${quoteIdentifier('next_fire_at', 'column name')} = ?`);
      params.push(update.nextFireAt as number);
    }
    if ('metadata' in update) {
      setClauses.push(`${quoteIdentifier('metadata', 'column name')} = ?`);
      params.push(update.metadata ? JSON.stringify(update.metadata) : null);
    }
    if ('ownerType' in update) {
      setClauses.push(`${quoteIdentifier('owner_type', 'column name')} = ?`);
      params.push((update.ownerType as string) ?? null);
    }
    if ('ownerId' in update) {
      setClauses.push(`${quoteIdentifier('owner_id', 'column name')} = ?`);
      params.push((update.ownerId as string) ?? null);
    }

    if (setClauses.length === 0) {
      const existing = await this.getSchedule(id);
      if (!existing) throw new Error(`Schedule ${id} not found`);
      return existing;
    }

    setClauses.push(`${quoteIdentifier('updated_at', 'column name')} = ?`);
    params.push(Date.now());
    params.push(id);

    await this.pool.execute(
      `UPDATE ${formatTableName(TABLE_SCHEDULES)} SET ${setClauses.join(', ')} WHERE ${quoteIdentifier('id', 'column name')} = ?`,
      params,
    );

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
    const [result] = await this.pool.execute<ResultSetHeader>(
      `UPDATE ${formatTableName(TABLE_SCHEDULES)} SET ${quoteIdentifier('next_fire_at', 'column name')} = ?, ${quoteIdentifier('last_fire_at', 'column name')} = ?, ${quoteIdentifier('last_run_id', 'column name')} = ?, ${quoteIdentifier('updated_at', 'column name')} = ? WHERE ${quoteIdentifier('id', 'column name')} = ? AND ${quoteIdentifier('next_fire_at', 'column name')} = ? AND ${quoteIdentifier('status', 'column name')} = ?`,
      [newNextFireAt, lastFireAt, lastRunId, Date.now(), id, expectedNextFireAt, 'active'],
    );
    return result.affectedRows > 0;
  }

  async deleteSchedule(id: string): Promise<void> {
    await this.pool.execute(
      `DELETE FROM ${formatTableName(TABLE_SCHEDULE_TRIGGERS)} WHERE ${quoteIdentifier('schedule_id', 'column name')} = ?`,
      [id],
    );
    await this.pool.execute(
      `DELETE FROM ${formatTableName(TABLE_SCHEDULES)} WHERE ${quoteIdentifier('id', 'column name')} = ?`,
      [id],
    );
  }

  async recordTrigger(trigger: ScheduleTrigger): Promise<void> {
    const id = trigger.id ?? randomUUID();
    await this.pool.execute(
      `INSERT INTO ${formatTableName(TABLE_SCHEDULE_TRIGGERS)} (${quoteIdentifier('id', 'column name')}, ${quoteIdentifier('schedule_id', 'column name')}, ${quoteIdentifier('run_id', 'column name')}, ${quoteIdentifier('scheduled_fire_at', 'column name')}, ${quoteIdentifier('actual_fire_at', 'column name')}, ${quoteIdentifier('outcome', 'column name')}, ${quoteIdentifier('error', 'column name')}, ${quoteIdentifier('trigger_kind', 'column name')}, ${quoteIdentifier('parent_trigger_id', 'column name')}, ${quoteIdentifier('metadata', 'column name')}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        trigger.scheduleId,
        trigger.runId,
        trigger.scheduledFireAt,
        trigger.actualFireAt,
        trigger.outcome,
        trigger.error ?? null,
        trigger.triggerKind ?? 'schedule-fire',
        trigger.parentTriggerId ?? null,
        trigger.metadata ? JSON.stringify(trigger.metadata) : null,
      ],
    );
  }

  async listTriggers(scheduleId: string, opts?: ScheduleTriggerListOptions): Promise<ScheduleTrigger[]> {
    const conditions: string[] = [`${quoteIdentifier('schedule_id', 'column name')} = ?`];
    const params: (string | number | null)[] = [scheduleId];

    if (opts?.fromActualFireAt != null) {
      conditions.push(`${quoteIdentifier('actual_fire_at', 'column name')} >= ?`);
      params.push(opts.fromActualFireAt);
    }
    if (opts?.toActualFireAt != null) {
      conditions.push(`${quoteIdentifier('actual_fire_at', 'column name')} < ?`);
      params.push(opts.toActualFireAt);
    }

    const limitClause = opts?.limit != null ? `LIMIT ${Math.floor(opts.limit)}` : '';
    const [rows] = await this.pool.execute<RowDataPacket[]>(
      `SELECT * FROM ${formatTableName(TABLE_SCHEDULE_TRIGGERS)} WHERE ${conditions.join(' AND ')} ORDER BY ${quoteIdentifier('actual_fire_at', 'column name')} DESC ${limitClause}`,
      params,
    );
    return rows.map(r => rowToTrigger(r as Record<string, any>));
  }
}
