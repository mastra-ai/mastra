import type {
  Schedule,
  ScheduleFilter,
  ScheduleStatus,
  ScheduleTarget,
  ScheduleTrigger,
  ScheduleTriggerListOptions,
  ScheduleUpdate,
} from '@mastra/core/storage';
import { SchedulesStorage, TABLE_SCHEDULES, TABLE_SCHEDULE_TRIGGERS, TABLE_SCHEMAS } from '@mastra/core/storage';
import { parseSqlIdentifier } from '@mastra/core/utils';
import type { DbClient } from '../../client';
import { PgDB, resolvePgConfig, generateTableSQL } from '../../db';
import type { PgDomainConfig } from '../../db';

function getSchemaName(schema?: string) {
  return schema ? `"${schema}"` : '"public"';
}

function getTableName(table: string, schema?: string) {
  const quoted = `"${table}"`;
  return schema ? `${schema}.${quoted}` : quoted;
}

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

export class SchedulesPG extends SchedulesStorage {
  #db: PgDB;
  #client: DbClient;
  #schema: string;

  /** Tables managed by this domain */
  static readonly MANAGED_TABLES = [TABLE_SCHEDULES, TABLE_SCHEDULE_TRIGGERS] as const;

  constructor(config: PgDomainConfig) {
    super();
    const { client, schemaName, skipDefaultIndexes } = resolvePgConfig(config);
    this.#client = client;
    this.#db = new PgDB({ client, schemaName, skipDefaultIndexes });
    this.#schema = schemaName || 'public';
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

  static getExportDDL(schemaName?: string): string[] {
    return [
      generateTableSQL({
        tableName: TABLE_SCHEDULES,
        schema: TABLE_SCHEMAS[TABLE_SCHEDULES],
        schemaName,
        includeAllConstraints: true,
      }),
      generateTableSQL({
        tableName: TABLE_SCHEDULE_TRIGGERS,
        schema: TABLE_SCHEMAS[TABLE_SCHEDULE_TRIGGERS],
        schemaName,
        includeAllConstraints: true,
      }),
    ];
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.clearTable({ tableName: TABLE_SCHEDULE_TRIGGERS });
    await this.#db.clearTable({ tableName: TABLE_SCHEDULES });
  }

  #table(tableName: typeof TABLE_SCHEDULES | typeof TABLE_SCHEDULE_TRIGGERS): string {
    const schema = parseSqlIdentifier(this.#schema, 'schema name');
    return getTableName(tableName, getSchemaName(schema));
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
    const row = await this.#client.oneOrNone<Record<string, any>>(
      `SELECT * FROM ${this.#table(TABLE_SCHEDULES)} WHERE id = $1`,
      [id],
    );
    return row ? rowToSchedule(row) : null;
  }

  async listSchedules(filter?: ScheduleFilter): Promise<Schedule[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (filter?.status) {
      params.push(filter.status);
      conditions.push(`status = $${params.length}`);
    }
    if (filter?.workflowId) {
      // target is jsonb; ->> extracts a text field.
      params.push(filter.workflowId);
      conditions.push(`target->>'workflowId' = $${params.length}`);
    }
    if (filter?.ownerType !== undefined) {
      if (filter.ownerType === null) {
        conditions.push('owner_type IS NULL');
      } else {
        params.push(filter.ownerType);
        conditions.push(`owner_type = $${params.length}`);
      }
    }
    if (filter?.ownerId !== undefined) {
      if (filter.ownerId === null) {
        conditions.push('owner_id IS NULL');
      } else {
        params.push(filter.ownerId);
        conditions.push(`owner_id = $${params.length}`);
      }
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await this.#client.manyOrNone<Record<string, any>>(
      `SELECT * FROM ${this.#table(TABLE_SCHEDULES)} ${where} ORDER BY created_at ASC`,
      params,
    );
    return rows.map(rowToSchedule);
  }

  async listDueSchedules(now: number, limit?: number): Promise<Schedule[]> {
    const cap = limit ?? 100;
    const rows = await this.#client.manyOrNone<Record<string, any>>(
      `SELECT * FROM ${this.#table(TABLE_SCHEDULES)}
       WHERE status = $1 AND next_fire_at <= $2
       ORDER BY next_fire_at ASC
       LIMIT $3`,
      ['active', now, cap],
    );
    return rows.map(rowToSchedule);
  }

  async updateSchedule(id: string, patch: ScheduleUpdate): Promise<Schedule> {
    const setClauses: string[] = [];
    const params: unknown[] = [];

    const push = (frag: string, value: unknown) => {
      params.push(value);
      setClauses.push(frag.replace('?', `$${params.length}`));
    };

    if ('cron' in patch && patch.cron !== undefined) push('cron = ?', patch.cron);
    if ('timezone' in patch) push('timezone = ?', patch.timezone ?? null);
    if ('status' in patch && patch.status !== undefined) push('status = ?', patch.status);
    if ('nextFireAt' in patch && patch.nextFireAt !== undefined) push('next_fire_at = ?', patch.nextFireAt);
    if ('target' in patch && patch.target !== undefined) {
      push('target = ?::jsonb', JSON.stringify(patch.target));
    }
    if ('metadata' in patch) {
      push('metadata = ?::jsonb', patch.metadata != null ? JSON.stringify(patch.metadata) : null);
    }
    if ('ownerType' in patch) push('owner_type = ?', (patch.ownerType as string | undefined) ?? null);
    if ('ownerId' in patch) push('owner_id = ?', (patch.ownerId as string | undefined) ?? null);

    push('updated_at = ?', Date.now());

    if (setClauses.length === 1) {
      // Only updated_at — nothing meaningful to patch
      const existing = await this.getSchedule(id);
      if (!existing) throw new Error(`Schedule ${id} not found`);
      return existing;
    }

    params.push(id);
    await this.#client.none(
      `UPDATE ${this.#table(TABLE_SCHEDULES)} SET ${setClauses.join(', ')} WHERE id = $${params.length}`,
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
    const result = await this.#client.query(
      `UPDATE ${this.#table(TABLE_SCHEDULES)}
       SET next_fire_at = $1, last_fire_at = $2, last_run_id = $3, updated_at = $4
       WHERE id = $5 AND next_fire_at = $6 AND status = $7`,
      [newNextFireAt, lastFireAt, lastRunId, Date.now(), id, expectedNextFireAt, 'active'],
    );
    return (result.rowCount ?? 0) > 0;
  }

  async deleteSchedule(id: string): Promise<void> {
    await this.#client.none(`DELETE FROM ${this.#table(TABLE_SCHEDULE_TRIGGERS)} WHERE schedule_id = $1`, [id]);
    await this.#client.none(`DELETE FROM ${this.#table(TABLE_SCHEDULES)} WHERE id = $1`, [id]);
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
    const conditions: string[] = [];
    const params: unknown[] = [];

    params.push(scheduleId);
    conditions.push(`schedule_id = $${params.length}`);

    if (opts?.fromActualFireAt != null) {
      params.push(opts.fromActualFireAt);
      conditions.push(`actual_fire_at >= $${params.length}`);
    }
    if (opts?.toActualFireAt != null) {
      params.push(opts.toActualFireAt);
      conditions.push(`actual_fire_at < $${params.length}`);
    }

    let limitClause = '';
    if (opts?.limit != null) {
      params.push(Math.floor(opts.limit));
      limitClause = `LIMIT $${params.length}`;
    }

    const rows = await this.#client.manyOrNone<Record<string, any>>(
      `SELECT * FROM ${this.#table(TABLE_SCHEDULE_TRIGGERS)}
       WHERE ${conditions.join(' AND ')}
       ORDER BY actual_fire_at DESC
       ${limitClause}`,
      params,
    );
    return rows.map(rowToTrigger);
  }
}
