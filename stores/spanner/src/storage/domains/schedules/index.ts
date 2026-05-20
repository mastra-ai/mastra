import { randomUUID } from 'node:crypto';
import type { Database } from '@google-cloud/spanner';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  createStorageErrorId,
  SchedulesStorage,
  TABLE_SCHEDULES,
  TABLE_SCHEDULE_TRIGGERS,
  TABLE_SCHEMAS,
} from '@mastra/core/storage';
import type {
  CreateIndexOptions,
  Schedule,
  ScheduleFilter,
  ScheduleStatus,
  ScheduleTarget,
  ScheduleTrigger,
  ScheduleTriggerListOptions,
  ScheduleUpdate,
} from '@mastra/core/storage';
import { SpannerDB, resolveSpannerConfig } from '../../db';
import type { SpannerDomainConfig } from '../../db';
import { quoteIdent } from '../../db/utils';
import { transformFromSpannerRow } from '../utils';

function rowToSchedule(row: Record<string, any>): Schedule {
  const transformed = transformFromSpannerRow<Record<string, any>>({ tableName: TABLE_SCHEDULES, row });
  const target = transformed.target as ScheduleTarget | undefined;
  if (!target || typeof target !== 'object') {
    throw new Error(`Schedule row ${transformed.id} has invalid target`);
  }
  const schedule: Schedule = {
    id: String(transformed.id),
    target,
    cron: String(transformed.cron),
    status: String(transformed.status) as ScheduleStatus,
    nextFireAt: Number(transformed.next_fire_at),
    createdAt: Number(transformed.created_at),
    updatedAt: Number(transformed.updated_at),
  };
  if (transformed.timezone != null) schedule.timezone = String(transformed.timezone);
  if (transformed.last_fire_at != null) schedule.lastFireAt = Number(transformed.last_fire_at);
  if (transformed.last_run_id != null) schedule.lastRunId = String(transformed.last_run_id);
  if (transformed.metadata != null) schedule.metadata = transformed.metadata as Record<string, unknown>;
  if (transformed.owner_type != null) schedule.ownerType = String(transformed.owner_type) as Schedule['ownerType'];
  if (transformed.owner_id != null) schedule.ownerId = String(transformed.owner_id);
  return schedule;
}

function rowToTrigger(row: Record<string, any>): ScheduleTrigger {
  const transformed = transformFromSpannerRow<Record<string, any>>({ tableName: TABLE_SCHEDULE_TRIGGERS, row });
  const trigger: ScheduleTrigger = {
    id: transformed.id != null ? String(transformed.id) : undefined,
    scheduleId: String(transformed.schedule_id),
    runId: transformed.run_id != null ? String(transformed.run_id) : null,
    scheduledFireAt: Number(transformed.scheduled_fire_at),
    actualFireAt: Number(transformed.actual_fire_at),
    outcome: String(transformed.outcome) as ScheduleTrigger['outcome'],
    triggerKind:
      transformed.trigger_kind != null
        ? (String(transformed.trigger_kind) as ScheduleTrigger['triggerKind'])
        : 'schedule-fire',
  };
  if (transformed.error != null) trigger.error = String(transformed.error);
  if (transformed.parent_trigger_id != null) trigger.parentTriggerId = String(transformed.parent_trigger_id);
  if (transformed.metadata != null) trigger.metadata = transformed.metadata as Record<string, unknown>;
  return trigger;
}

/**
 * Spanner-backed storage for `WorkflowScheduler` schedules and trigger history.
 *
 * `mastra_schedule_triggers.id` is the table's only primary-key column
 * (matches `TABLE_SCHEMAS[TABLE_SCHEDULE_TRIGGERS]`). `schedule_id` is filtered
 * via a secondary index registered in {@link getDefaultIndexDefinitions}.
 */
export class SchedulesSpanner extends SchedulesStorage {
  private database: Database;
  private db: SpannerDB;
  private readonly skipDefaultIndexes?: boolean;
  private readonly indexes?: CreateIndexOptions[];

  static readonly MANAGED_TABLES = [TABLE_SCHEDULES, TABLE_SCHEDULE_TRIGGERS] as const;

  constructor(config: SpannerDomainConfig) {
    super();
    const { database, indexes, skipDefaultIndexes, initMode } = resolveSpannerConfig(config);
    this.database = database;
    this.db = new SpannerDB({ database, skipDefaultIndexes, initMode });
    this.skipDefaultIndexes = skipDefaultIndexes;
    this.indexes = indexes?.filter(idx => (SchedulesSpanner.MANAGED_TABLES as readonly string[]).includes(idx.table));
  }

  async init(): Promise<void> {
    await this.db.createTable({ tableName: TABLE_SCHEDULES, schema: TABLE_SCHEMAS[TABLE_SCHEDULES] });
    await this.db.createTable({
      tableName: TABLE_SCHEDULE_TRIGGERS,
      schema: TABLE_SCHEMAS[TABLE_SCHEDULE_TRIGGERS],
    });
    // Add the target_workflow_id generated column BEFORE indexes so its index
    // can be created in the same init pass.
    await this.ensureTargetWorkflowIdColumn();
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    return [
      {
        // listDueSchedules: WHERE status = 'active' AND next_fire_at <= @now ORDER BY next_fire_at ASC
        name: 'mastra_schedules_status_nextfireat_idx',
        table: TABLE_SCHEDULES,
        columns: ['status', 'next_fire_at'],
      },
      {
        // listSchedules({ workflowId }): WHERE target_workflow_id = @id
        // Filters on the STORED generated column added by ensureTargetWorkflowIdColumn().
        // If the column wasn't created (legacy databases), createDefaultIndexes() filters
        // this entry out and listSchedules falls back to JSON_VALUE.
        name: 'mastra_schedules_targetworkflowid_idx',
        table: TABLE_SCHEDULES,
        columns: ['target_workflow_id'],
      },
      {
        // listTriggers: WHERE schedule_id = @id ORDER BY actual_fire_at DESC
        // Also supports DELETE FROM mastra_schedule_triggers WHERE schedule_id = @id
        // (the table's PK is id only, so schedule_id needs its own index).
        name: 'mastra_schedule_triggers_scheduleid_actualfireat_idx',
        table: TABLE_SCHEDULE_TRIGGERS,
        columns: ['schedule_id', 'actual_fire_at DESC'],
      },
    ];
  }

  /**
   * Creates the default indexes; no-op when `skipDefaultIndexes` was set.
   * Filters out the target_workflow_id index when that generated column is
   * absent (e.g. ensureTargetWorkflowIdColumn() failed, or `initMode: 'validate'`
   * skipped the DDL). Otherwise the createIndex call would fail on a missing
   * column.
   */
  async createDefaultIndexes(): Promise<void> {
    if (this.skipDefaultIndexes) return;
    const hasTargetWorkflowId = await this.hasTargetWorkflowIdColumn();
    const indexes = this.getDefaultIndexDefinitions().filter(
      idx => hasTargetWorkflowId || !idx.columns.some(c => c.startsWith('target_workflow_id')),
    );
    await this.db.createIndexes(indexes);
  }

  /**
   * Spanner-specific optimization: add a STORED generated column that extracts
   * `workflowId` from the JSON `target` payload, so the listSchedules workflowId
   * filter can use a regular secondary index instead of a full JSON_VALUE scan.
   */
  private async ensureTargetWorkflowIdColumn(): Promise<void> {
    // In validate mode the schema is owned externally, so we never issue DDL.
    // hasTargetWorkflowIdColumn() / listSchedules will pick up whether the
    // column is present at runtime via INFORMATION_SCHEMA and route accordingly.
    if (this.db.initMode === 'validate') return;
    try {
      const ddl =
        `ALTER TABLE ${quoteIdent(TABLE_SCHEDULES, 'table name')} ` +
        `ADD COLUMN IF NOT EXISTS ${quoteIdent('target_workflow_id', 'column name')} ` +
        `STRING(MAX) AS (JSON_VALUE(${quoteIdent('target', 'column name')}, '$.workflowId')) STORED`;
      const [operation] = await this.database.updateSchema([ddl]);
      await operation.promise();
      this.targetWorkflowIdColumnAvailable = true;
    } catch (error) {
      this.logger?.warn?.(
        'Failed to add target_workflow_id generated column; workflowId filtering will fall back to JSON_VALUE scan',
        error,
      );
    }
  }

  /**
   * Cached lookup for whether the `target_workflow_id` generated column exists.
   * Resolves true after `ensureTargetWorkflowIdColumn()` succeeds, otherwise
   * falls back to an INFORMATION_SCHEMA probe (lets us still pick up the fast
   * path on databases that already had the column from a prior deploy).
   */
  private targetWorkflowIdColumnAvailable: boolean | null = null;
  /** Returns true when the `target_workflow_id` generated column exists. */
  private async hasTargetWorkflowIdColumn(): Promise<boolean> {
    if (this.targetWorkflowIdColumnAvailable !== null) return this.targetWorkflowIdColumnAvailable;
    try {
      this.targetWorkflowIdColumnAvailable = await this.db.hasColumn(TABLE_SCHEDULES, 'target_workflow_id');
    } catch {
      this.targetWorkflowIdColumnAvailable = false;
    }
    return this.targetWorkflowIdColumnAvailable;
  }

  async createCustomIndexes(): Promise<void> {
    if (!this.indexes || this.indexes.length === 0) return;
    await this.db.createIndexes(this.indexes);
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.db.clearTable({ tableName: TABLE_SCHEDULE_TRIGGERS });
    await this.db.clearTable({ tableName: TABLE_SCHEDULES });
  }

  async createSchedule(schedule: Schedule): Promise<Schedule> {
    try {
      await this.db.runWithAbortRetry(() =>
        this.database.runTransactionAsync(async tx => {
          try {
            const [rows] = await tx.run({
              sql: `SELECT ${quoteIdent('id', 'column name')} FROM ${quoteIdent(TABLE_SCHEDULES, 'table name')}
                    WHERE ${quoteIdent('id', 'column name')} = @id LIMIT 1`,
              params: { id: schedule.id },
              json: true,
            });
            if ((rows as Array<Record<string, any>>).length > 0) {
              throw new MastraError({
                id: createStorageErrorId('SPANNER', 'CREATE_SCHEDULE', 'ALREADY_EXISTS'),
                domain: ErrorDomain.STORAGE,
                category: ErrorCategory.USER,
                text: `Schedule with id "${schedule.id}" already exists`,
                details: { id: schedule.id },
              });
            }
            await this.db.insert({
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
              transaction: tx,
            });
            await tx.commit();
          } catch (err) {
            await tx.rollback().catch(() => {});
            throw err;
          }
        }),
      );
      return schedule;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'CREATE_SCHEDULE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id: schedule.id },
        },
        error,
      );
    }
  }

  async getSchedule(id: string): Promise<Schedule | null> {
    try {
      const row = await this.db.load<Record<string, any>>({ tableName: TABLE_SCHEDULES, keys: { id } });
      return row ? rowToSchedule(row) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'GET_SCHEDULE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id },
        },
        error,
      );
    }
  }

  async listSchedules(filter?: ScheduleFilter): Promise<Schedule[]> {
    try {
      const conditions: string[] = [];
      const params: Record<string, any> = {};
      const types: Record<string, any> = {};

      if (filter?.status) {
        conditions.push(`${quoteIdent('status', 'column name')} = @status`);
        params.status = filter.status;
      }
      if (filter?.workflowId) {
        // Prefer the indexed STORED generated column when present
        const useFastPath = await this.hasTargetWorkflowIdColumn();
        if (useFastPath) {
          conditions.push(`${quoteIdent('target_workflow_id', 'column name')} = @workflowId`);
        } else {
          conditions.push(`JSON_VALUE(${quoteIdent('target', 'column name')}, '$.workflowId') = @workflowId`);
        }
        params.workflowId = filter.workflowId;
      }
      if (filter?.ownerType !== undefined) {
        if (filter.ownerType === null) {
          conditions.push(`${quoteIdent('owner_type', 'column name')} IS NULL`);
        } else {
          conditions.push(`${quoteIdent('owner_type', 'column name')} = @ownerType`);
          params.ownerType = filter.ownerType;
        }
      }
      if (filter?.ownerId !== undefined) {
        if (filter.ownerId === null) {
          conditions.push(`${quoteIdent('owner_id', 'column name')} IS NULL`);
        } else {
          conditions.push(`${quoteIdent('owner_id', 'column name')} = @ownerId`);
          params.ownerId = filter.ownerId;
        }
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const sql = `SELECT * FROM ${quoteIdent(TABLE_SCHEDULES, 'table name')}
                   ${where}
                   ORDER BY ${quoteIdent('created_at', 'column name')} ASC`;
      const [rows] = await this.database.run({ sql, params, types, json: true });
      return (rows as Array<Record<string, any>>).map(rowToSchedule);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'LIST_SCHEDULES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: filter ? { ...filter } : {},
        },
        error,
      );
    }
  }

  async listDueSchedules(now: number, limit?: number): Promise<Schedule[]> {
    try {
      const cap = Math.max(0, Math.floor(limit ?? 100));
      const sql = `SELECT * FROM ${quoteIdent(TABLE_SCHEDULES, 'table name')}
                   WHERE ${quoteIdent('status', 'column name')} = @status
                     AND ${quoteIdent('next_fire_at', 'column name')} <= @now
                   ORDER BY ${quoteIdent('next_fire_at', 'column name')} ASC
                   LIMIT @lim`;
      const [rows] = await this.database.run({
        sql,
        params: { status: 'active', now, lim: cap },
        types: { now: 'int64', lim: 'int64' },
        json: true,
      });
      return (rows as Array<Record<string, any>>).map(rowToSchedule);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'LIST_DUE_SCHEDULES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { now, ...(limit !== undefined ? { limit } : {}) },
        },
        error,
      );
    }
  }

  async updateSchedule(id: string, patch: ScheduleUpdate): Promise<Schedule> {
    try {
      const data: Record<string, any> = {};
      if ('cron' in patch && patch.cron !== undefined) data.cron = patch.cron;
      if ('timezone' in patch) data.timezone = patch.timezone ?? null;
      if ('status' in patch && patch.status !== undefined) data.status = patch.status;
      if ('nextFireAt' in patch && patch.nextFireAt !== undefined) data.next_fire_at = patch.nextFireAt;
      if ('target' in patch && patch.target !== undefined) data.target = patch.target;
      if ('metadata' in patch) data.metadata = patch.metadata ?? null;
      if ('ownerType' in patch) data.owner_type = patch.ownerType ?? null;
      if ('ownerId' in patch) data.owner_id = patch.ownerId ?? null;

      if (Object.keys(data).length === 0) {
        // Nothing meaningful to patch; just confirm existence.
        const existing = await this.getSchedule(id);
        if (!existing) {
          throw new MastraError({
            id: createStorageErrorId('SPANNER', 'UPDATE_SCHEDULE', 'NOT_FOUND'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            text: `Schedule ${id} not found`,
            details: { id },
          });
        }
        return existing;
      }

      data.updated_at = Date.now();
      await this.db.update({ tableName: TABLE_SCHEDULES, keys: { id }, data });

      const updated = await this.getSchedule(id);
      if (!updated) {
        throw new MastraError({
          id: createStorageErrorId('SPANNER', 'UPDATE_SCHEDULE', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: `Schedule ${id} not found`,
          details: { id },
        });
      }
      return updated;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'UPDATE_SCHEDULE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id },
        },
        error,
      );
    }
  }

  async updateScheduleNextFire(
    id: string,
    expectedNextFireAt: number,
    newNextFireAt: number,
    lastFireAt: number,
    lastRunId: string,
  ): Promise<boolean> {
    try {
      const sql = `UPDATE ${quoteIdent(TABLE_SCHEDULES, 'table name')}
                   SET ${quoteIdent('next_fire_at', 'column name')} = @newNext,
                       ${quoteIdent('last_fire_at', 'column name')} = @lastFire,
                       ${quoteIdent('last_run_id', 'column name')} = @lastRun,
                       ${quoteIdent('updated_at', 'column name')} = @updatedAt
                   WHERE ${quoteIdent('id', 'column name')} = @id
                     AND ${quoteIdent('next_fire_at', 'column name')} = @expected
                     AND ${quoteIdent('status', 'column name')} = @status`;
      const rowCount = await this.db.runDml({
        sql,
        params: {
          id,
          expected: expectedNextFireAt,
          newNext: newNextFireAt,
          lastFire: lastFireAt,
          lastRun: lastRunId,
          updatedAt: Date.now(),
          status: 'active',
        },
        types: {
          expected: 'int64',
          newNext: 'int64',
          lastFire: 'int64',
          updatedAt: 'int64',
        },
      });
      return rowCount > 0;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'UPDATE_SCHEDULE_NEXT_FIRE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id },
        },
        error,
      );
    }
  }

  async deleteSchedule(id: string): Promise<void> {
    try {
      await this.db.runWithAbortRetry(() =>
        this.database.runTransactionAsync(async tx => {
          try {
            await tx.runUpdate({
              sql: `DELETE FROM ${quoteIdent(TABLE_SCHEDULE_TRIGGERS, 'table name')}
                    WHERE ${quoteIdent('schedule_id', 'column name')} = @id`,
              params: { id },
            });
            await tx.runUpdate({
              sql: `DELETE FROM ${quoteIdent(TABLE_SCHEDULES, 'table name')}
                    WHERE ${quoteIdent('id', 'column name')} = @id`,
              params: { id },
            });
            await tx.commit();
          } catch (err) {
            await tx.rollback().catch(() => {});
            throw err;
          }
        }),
      );
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'DELETE_SCHEDULE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id },
        },
        error,
      );
    }
  }

  async recordTrigger(trigger: ScheduleTrigger): Promise<void> {
    try {
      await this.db.insert({
        tableName: TABLE_SCHEDULE_TRIGGERS,
        record: {
          id: trigger.id ?? randomUUID(),
          schedule_id: trigger.scheduleId,
          run_id: trigger.runId ?? null,
          scheduled_fire_at: trigger.scheduledFireAt,
          actual_fire_at: trigger.actualFireAt,
          outcome: trigger.outcome,
          error: trigger.error ?? null,
          trigger_kind: trigger.triggerKind ?? 'schedule-fire',
          parent_trigger_id: trigger.parentTriggerId ?? null,
          metadata: trigger.metadata ?? null,
        },
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'RECORD_TRIGGER', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { scheduleId: trigger.scheduleId, runId: trigger.runId ?? '' },
        },
        error,
      );
    }
  }

  async listTriggers(scheduleId: string, opts?: ScheduleTriggerListOptions): Promise<ScheduleTrigger[]> {
    try {
      const conditions: string[] = [`${quoteIdent('schedule_id', 'column name')} = @scheduleId`];
      const params: Record<string, any> = { scheduleId };
      const types: Record<string, any> = {};

      if (opts?.fromActualFireAt != null) {
        conditions.push(`${quoteIdent('actual_fire_at', 'column name')} >= @fromAt`);
        params.fromAt = opts.fromActualFireAt;
        types.fromAt = 'int64';
      }
      if (opts?.toActualFireAt != null) {
        conditions.push(`${quoteIdent('actual_fire_at', 'column name')} < @toAt`);
        params.toAt = opts.toActualFireAt;
        types.toAt = 'int64';
      }

      let limitClause = '';
      if (opts?.limit != null) {
        limitClause = 'LIMIT @lim';
        params.lim = Math.max(0, Math.floor(opts.limit));
        types.lim = 'int64';
      }

      const sql = `SELECT * FROM ${quoteIdent(TABLE_SCHEDULE_TRIGGERS, 'table name')}
                   WHERE ${conditions.join(' AND ')}
                   ORDER BY ${quoteIdent('actual_fire_at', 'column name')} DESC
                   ${limitClause}`;
      const [rows] = await this.database.run({ sql, params, types, json: true });
      return (rows as Array<Record<string, any>>).map(rowToTrigger);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'LIST_TRIGGERS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { scheduleId },
        },
        error,
      );
    }
  }
}
