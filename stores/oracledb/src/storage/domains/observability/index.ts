import { randomUUID } from 'node:crypto';

import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  createStorageErrorId,
  listScoresArgsSchema,
  listLogsArgsSchema,
  listTracesArgsSchema,
  ObservabilityStorage,
  TABLE_SCHEMAS,
  TABLE_SCORERS,
  TABLE_SPANS,
  toTraceSpans,
  TraceStatus,
} from '@mastra/core/storage';
import type {
  BatchCreateSpansArgs,
  BatchCreateLogsArgs,
  BatchCreateMetricsArgs,
  BatchCreateScoresArgs,
  BatchDeleteTracesArgs,
  BatchUpdateSpansArgs,
  CreateSpanArgs,
  CreateSpanRecord,
  CreateScoreArgs,
  GetRootSpanArgs,
  GetRootSpanResponse,
  GetSpanArgs,
  GetSpanResponse,
  GetTraceArgs,
  GetTraceLightResponse,
  GetTraceResponse,
  GetEntityNamesArgs,
  GetEntityNamesResponse,
  GetEntityTypesArgs,
  GetEntityTypesResponse,
  GetEnvironmentsArgs,
  GetEnvironmentsResponse,
  GetServiceNamesArgs,
  GetServiceNamesResponse,
  GetTagsArgs,
  GetTagsResponse,
  LightSpanRecord,
  ListLogsArgs,
  ListLogsResponse,
  LogRecord,
  ListScoresArgs,
  ListScoresResponse,
  ListTracesArgs,
  ListTracesResponse,
  ScoreRecord,
  ObservabilityStorageStrategy,
  SpanRecord,
  TracingStorageStrategy,
  UpdateSpanArgs,
} from '@mastra/core/storage';
import oracledb from 'oracledb';

import { safeJsonValue } from '../../../shared/connection';
import { assertJsonPath, indexNameForTable, qualifyName } from '../../../vector/identifiers';
import { OracleDB, createOracleIndex, filterIndexesForTables } from '../../db';
import type { OracleCreateIndexOptions } from '../../db';
import { createOracleStorageError, parseJsonValue, toDate } from '../../domain-utils';
import type { OracleDomainConfig } from '../../types';

// Observability persists spans and log events for Studio/API trace inspection,
// keeping large structured payloads in Oracle JSON/CLOB-friendly columns.
const STORE_NAME = 'ORACLEDB';
const SPAN_SCHEMA = TABLE_SCHEMAS[TABLE_SPANS];
const SCORE_SCHEMA = TABLE_SCHEMAS[TABLE_SCORERS];
export const LOG_EVENTS_TABLE = 'mastra_log_events';
const SIMPLE_IDENTIFIER = /^[A-Za-z][A-Za-z0-9_]*$/;
const LOWERCASE_SQL_IDENTIFIER = /^[a-z][a-z0-9_]*$/;

type SpanColumn = keyof typeof SPAN_SCHEMA & string;
type SpanRow = Record<string, unknown>;
type SpanMutationRecord = CreateSpanRecord & { createdAt: Date; updatedAt: Date };
type LogColumn = (typeof LOG_COLUMNS)[number];
type LogRow = Record<string, unknown>;
type LogMutationRecord = LogRecord & { logId: string };
type SharedContextColumn = 'entityType' | 'entityName' | 'serviceName' | 'environment';
type ScoreRow = Record<string, unknown>;

const SPAN_COLUMNS = Object.keys(SPAN_SCHEMA) as SpanColumn[];
const SPAN_KEY_COLUMNS = new Set<SpanColumn>(['traceId', 'spanId']);
// Column sets are derived once from Mastra schemas so mutation builders can bind each type correctly.
const SPAN_JSON_COLUMNS = new Set(
  SPAN_COLUMNS.filter(columnName => SPAN_SCHEMA[columnName]?.type === 'jsonb'),
) as ReadonlySet<SpanColumn>;
const SPAN_TIMESTAMP_COLUMNS = new Set(
  SPAN_COLUMNS.filter(columnName => SPAN_SCHEMA[columnName]?.type === 'timestamp'),
) as ReadonlySet<SpanColumn>;
const SPAN_BOOLEAN_COLUMNS = new Set(
  SPAN_COLUMNS.filter(columnName => SPAN_SCHEMA[columnName]?.type === 'boolean'),
) as ReadonlySet<SpanColumn>;
const SPAN_NULLABLE_COLUMNS = SPAN_COLUMNS.filter(columnName => SPAN_SCHEMA[columnName]?.nullable);

const LIGHT_SPAN_COLUMNS = [
  'traceId',
  'spanId',
  'parentSpanId',
  'name',
  'entityType',
  'entityId',
  'entityName',
  'spanType',
  'error',
  'isEvent',
  'startedAt',
  'endedAt',
  'createdAt',
  'updatedAt',
] as const satisfies readonly SpanColumn[];

const FILTER_TEXT_COLUMNS = [
  'traceId',
  'spanType',
  'entityType',
  'entityId',
  'entityName',
  'entityVersionId',
  'parentEntityType',
  'parentEntityId',
  'parentEntityName',
  'parentEntityVersionId',
  'rootEntityType',
  'rootEntityId',
  'rootEntityName',
  'rootEntityVersionId',
  'experimentId',
  'userId',
  'organizationId',
  'resourceId',
  'runId',
  'sessionId',
  'threadId',
  'requestId',
  'environment',
  'source',
  'serviceName',
] as const satisfies readonly SpanColumn[];

const LOG_COLUMNS = [
  'logId',
  'timestamp',
  'level',
  'message',
  'data',
  'traceId',
  'spanId',
  'entityType',
  'entityId',
  'entityName',
  'entityVersionId',
  'parentEntityType',
  'parentEntityId',
  'parentEntityName',
  'parentEntityVersionId',
  'rootEntityType',
  'rootEntityId',
  'rootEntityName',
  'rootEntityVersionId',
  'userId',
  'organizationId',
  'resourceId',
  'runId',
  'sessionId',
  'threadId',
  'requestId',
  'environment',
  'executionSource',
  'source',
  'serviceName',
  'experimentId',
  'tags',
  'metadata',
  'scope',
] as const;

const LOG_JSON_COLUMNS = new Set<LogColumn>(['data', 'tags', 'metadata', 'scope']);
const LOG_TEXT_FILTER_COLUMNS = [
  'traceId',
  'spanId',
  'entityType',
  'entityId',
  'entityName',
  'entityVersionId',
  'parentEntityType',
  'parentEntityId',
  'parentEntityName',
  'parentEntityVersionId',
  'rootEntityType',
  'rootEntityId',
  'rootEntityName',
  'rootEntityVersionId',
  'experimentId',
  'userId',
  'organizationId',
  'resourceId',
  'runId',
  'sessionId',
  'threadId',
  'requestId',
  'environment',
  'serviceName',
] as const satisfies readonly LogColumn[];

const SCORE_TEXT_FILTER_COLUMNS = [
  'traceId',
  'spanId',
  'runId',
  'entityType',
  'entityId',
  'resourceId',
  'threadId',
] as const;

const SCORE_METADATA_FILTER_FIELDS = [
  'entityName',
  'entityVersionId',
  'parentEntityType',
  'parentEntityName',
  'parentEntityVersionId',
  'rootEntityType',
  'rootEntityName',
  'rootEntityVersionId',
  'userId',
  'organizationId',
  'sessionId',
  'requestId',
  'environment',
  'serviceName',
  'executionSource',
] as const;

export class ObservabilityOracle extends ObservabilityStorage {
  static readonly MANAGED_TABLES = [TABLE_SPANS, LOG_EVENTS_TABLE] as const;

  private readonly db: OracleDB;
  private readonly schemaName?: string;
  private readonly skipDefaultIndexes?: boolean;
  private readonly indexes: OracleCreateIndexOptions[];

  constructor(config: OracleDomainConfig) {
    super();
    this.db = new OracleDB(config);
    this.schemaName = config.schemaName;
    this.skipDefaultIndexes = config.skipDefaultIndexes;
    this.indexes = filterIndexesForTables(config.indexes, ObservabilityOracle.MANAGED_TABLES);
  }

  async init(): Promise<void> {
    await this.db.createTable({
      tableName: TABLE_SPANS,
      schema: SPAN_SCHEMA,
      // Spans are unique inside a trace; this composite key also makes MERGE
      // safe for insert/update observability strategies.
      compositePrimaryKey: ['traceId', 'spanId'],
    });
    await this.db.executeDdl(logEventsTableSql(this.table(LOG_EVENTS_TABLE)), [-955]);
    await this.db.alterTable({
      tableName: TABLE_SPANS,
      schema: SPAN_SCHEMA,
      ifNotExists: SPAN_NULLABLE_COLUMNS,
    });
    await this.createIndexes();
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.db.tx(async client => {
      await client.none(`DELETE FROM ${this.table(LOG_EVENTS_TABLE)}`);
      await client.none(`DELETE FROM ${this.table(TABLE_SPANS)}`);
    });
  }

  public override get observabilityStrategy(): {
    preferred: ObservabilityStorageStrategy;
    supported: ObservabilityStorageStrategy[];
  } {
    // Oracle supports efficient batch upserts, so prefer the strategy that lets
    // the runtime create spans early and update them as work completes.
    return {
      preferred: 'batch-with-updates',
      supported: ['batch-with-updates', 'insert-only'],
    };
  }

  public override get tracingStrategy(): {
    preferred: TracingStorageStrategy;
    supported: TracingStorageStrategy[];
  } {
    return this.observabilityStrategy;
  }

  getDefaultIndexDefinitions(): OracleCreateIndexOptions[] {
    return getDefaultObservabilityIndexDefinitions(this.indexName.bind(this));
  }

  async batchCreateLogs(args: BatchCreateLogsArgs): Promise<void> {
    if (args.logs.length === 0) return;

    try {
      const binds = args.logs.map(log =>
        logRecordBinds({
          ...log,
          logId: log.logId ?? randomUUID(),
          executionSource: log.executionSource ?? log.source ?? null,
        }),
      );

      await this.db.tx(async client => {
        // Logs can be retried by telemetry pipelines; MERGE by logId prevents
        // duplicate rows while preserving insert-only semantics.
        await client.executeMany(this.logMergeSql(), binds, {
          bindDefs: bindDefsForLogColumns(LOG_COLUMNS),
        });
      });
    } catch (error) {
      throw this.storageError('BATCH_CREATE_LOGS', 'FAILED', { count: args.logs.length }, error, ErrorCategory.USER);
    }
  }

  async listLogs(args: ListLogsArgs): Promise<ListLogsResponse> {
    const { mode, filters, pagination, orderBy } = listLogsArgsSchema.parse(args);
    if (mode === 'delta') {
      throw new MastraError({
        id: createStorageErrorId(STORE_NAME, 'LIST_LOGS', 'DELTA_NOT_SUPPORTED'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'Oracle observability logs do not support delta polling yet',
      });
    }

    const page = pagination.page;
    const perPage = pagination.perPage;
    const binds: Record<string, unknown> = {};
    const conditions: string[] = [];

    try {
      if (filters) {
        // Scalar filters use normal columns; metadata/scope/tags use JSON
        // predicates so logs remain flexible without a separate document store.
        const logFilters = filters as typeof filters & {
          metadata?: Record<string, unknown> | null;
          scope?: Record<string, unknown> | null;
        };
        addLogDateRangeFilter(conditions, binds, 'l', filters.timestamp);

        if (filters.level !== undefined) {
          const levels = Array.isArray(filters.level) ? filters.level : [filters.level];
          if (levels.length > 0) {
            conditions.push(`${logQcol('l', 'level')} IN (${levels.map(level => addBind(binds, level)).join(', ')})`);
          }
        }

        for (const columnName of LOG_TEXT_FILTER_COLUMNS) {
          const value = filters[columnName as keyof typeof filters];
          if (value !== undefined) {
            conditions.push(`${logQcol('l', columnName)} = ${addBind(binds, value)}`);
          }
        }

        const sourceFilter = filters.executionSource ?? filters.source;
        if (sourceFilter !== undefined) {
          conditions.push(`COALESCE(${logQcol('l', 'executionSource')}, ${logQcol('l', 'source')}) = ${addBind(binds, sourceFilter)}`);
        }

        addLogJsonObjectFilter(conditions, binds, 'l', 'metadata', logFilters.metadata);
        addLogJsonObjectFilter(conditions, binds, 'l', 'scope', logFilters.scope);
        addLogTagsFilter(conditions, binds, 'l', filters.tags);
      }

      const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const countRow = await this.db.oneOrNone<{ count: number | string }>(
        `SELECT COUNT(*) AS "count" FROM ${this.table(LOG_EVENTS_TABLE)} l ${whereClause}`,
        binds,
      );
      const total = Number(countRow?.count ?? 0);

      if (total === 0) {
        return { logs: [], pagination: { total: 0, page, perPage, hasMore: false } };
      }

      const offset = page * perPage;
      const logs = await this.db.manyOrNone<LogRow>(
        `${logSelect(LOG_COLUMNS, 'l')} FROM ${this.table(LOG_EVENTS_TABLE)} l ${whereClause} ORDER BY ${logQcol(
          'l',
          orderBy.field,
        )} ${orderBy.direction}, ${logQcol('l', 'logId')} ${orderBy.direction} OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
        { ...binds, offset, limit: perPage },
      );

      return {
        logs: logs.map(row => transformLogRow(row)),
        pagination: {
          total,
          page,
          perPage,
          hasMore: offset + perPage < total,
        },
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw this.storageError('LIST_LOGS', 'FAILED', {}, error, ErrorCategory.USER);
    }
  }

  async listScores(args: ListScoresArgs): Promise<ListScoresResponse> {
    const { mode, filters, pagination, orderBy } = listScoresArgsSchema.parse(args);
    if (mode === 'delta') {
      throw new MastraError({
        id: createStorageErrorId(STORE_NAME, 'LIST_SCORES', 'DELTA_NOT_SUPPORTED'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: 'Oracle observability scores do not support delta polling yet',
      });
    }

    const page = pagination.page;
    const perPage = pagination.perPage;
    const binds: Record<string, unknown> = {};
    const conditions: string[] = [];

    try {
      addScoreFilters(conditions, binds, filters);

      const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const countRow = await this.db.oneOrNone<{ count: number | string }>(
        `SELECT COUNT(*) AS "count" FROM ${this.table(TABLE_SCORERS)} s ${whereClause}`,
        binds,
      );
      const total = Number(countRow?.count ?? 0);

      if (total === 0) {
        return { scores: [], pagination: { total: 0, page, perPage, hasMore: false } };
      }

      const offset = page * perPage;
      const scoreOrderColumn = orderBy.field === 'score' ? scoreQcol('s', 'score') : scoreQcol('s', 'createdAt');
      const rows = await this.db.manyOrNone<ScoreRow>(
        `${scoreSelect('s')} FROM ${this.table(TABLE_SCORERS)} s ${whereClause} ORDER BY ${scoreOrderColumn} ${
          orderBy.direction
        }, ${scoreQcol('s', 'id')} ${orderBy.direction} OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
        { ...binds, offset, limit: perPage },
      );

      return {
        scores: rows.map(row => transformObservabilityScoreRow(row)),
        pagination: {
          total,
          page,
          perPage,
          hasMore: offset + perPage < total,
        },
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw this.storageError('LIST_SCORES', 'FAILED', {}, error, ErrorCategory.USER);
    }
  }

  async createScore(args: CreateScoreArgs): Promise<void> {
    await this.batchCreateScores({ scores: [args.score] });
  }

  async batchCreateScores(args: BatchCreateScoresArgs): Promise<void> {
    if (args.scores.length === 0) return;

    try {
      for (const score of args.scores) {
        await this.db.insert({
          tableName: TABLE_SCORERS,
          schema: SCORE_SCHEMA,
          record: scoreRecordToTableRecord(score),
        });
      }
    } catch (error) {
      throw this.storageError(
        'BATCH_CREATE_SCORES',
        'FAILED',
        { count: args.scores.length },
        error,
        ErrorCategory.USER,
      );
    }
  }

  async batchCreateMetrics(_args: BatchCreateMetricsArgs): Promise<void> {
    // The Oracle provider does not persist the metrics domain yet. Accepting the
    // telemetry callback keeps workflows from surfacing unsupported-provider
    // noise while spans, logs, and scores remain durable in Oracle.
  }

  async getScoreById(scoreId: string): Promise<ScoreRecord | null> {
    try {
      const row = await this.db.oneOrNone<ScoreRow>(
        `${scoreSelect('s')} FROM ${this.table(TABLE_SCORERS)} s WHERE ${scoreQcol('s', 'id')} = :scoreId`,
        { scoreId },
      );
      return row ? transformObservabilityScoreRow(row) : null;
    } catch (error) {
      throw this.storageError('GET_SCORE_BY_ID', 'FAILED', { scoreId }, error, ErrorCategory.USER);
    }
  }

  async createSpan(args: CreateSpanArgs): Promise<void> {
    const { span } = args;
    try {
      await this.upsertSpans([span]);
    } catch (error) {
      throw this.storageError(
        'CREATE_SPAN',
        'FAILED',
        {
          spanId: span.spanId,
          traceId: span.traceId,
          spanType: span.spanType,
          name: span.name,
        },
        error,
        ErrorCategory.USER,
      );
    }
  }

  async batchCreateSpans(args: BatchCreateSpansArgs): Promise<void> {
    if (args.records.length === 0) return;

    try {
      await this.upsertSpans(args.records);
    } catch (error) {
      throw this.storageError('BATCH_CREATE_SPANS', 'FAILED', { count: args.records.length }, error, ErrorCategory.USER);
    }
  }

  async getSpan(args: GetSpanArgs): Promise<GetSpanResponse | null> {
    const { traceId, spanId } = args;
    try {
      const row = await this.db.oneOrNone<SpanRow>(
        `${this.fullSpanSelect()} FROM ${this.table()} WHERE ${col('traceId')} = :traceId AND ${col('spanId')} = :spanId`,
        { traceId, spanId },
      );

      return row ? { span: transformSpanRow<SpanRecord>(row) } : null;
    } catch (error) {
      throw this.storageError('GET_SPAN', 'FAILED', { traceId, spanId }, error, ErrorCategory.USER);
    }
  }

  async getRootSpan(args: GetRootSpanArgs): Promise<GetRootSpanResponse | null> {
    const { traceId } = args;
    try {
      const row = await this.db.oneOrNone<SpanRow>(
        `${this.fullSpanSelect()} FROM ${this.table()} WHERE ${col('traceId')} = :traceId AND ${col(
          'parentSpanId',
        )} IS NULL FETCH FIRST 1 ROWS ONLY`,
        { traceId },
      );

      return row ? { span: transformSpanRow<SpanRecord>(row) } : null;
    } catch (error) {
      throw this.storageError('GET_ROOT_SPAN', 'FAILED', { traceId }, error, ErrorCategory.USER);
    }
  }

  async getTrace(args: GetTraceArgs): Promise<GetTraceResponse | null> {
    const { traceId } = args;
    try {
      const spans = await this.db.manyOrNone<SpanRow>(
        `${this.fullSpanSelect()} FROM ${this.table()} WHERE ${col('traceId')} = :traceId ORDER BY ${col(
          'startedAt',
        )} ASC, ${col('spanId')} ASC`,
        { traceId },
      );

      if (spans.length === 0) return null;
      return {
        traceId,
        spans: spans.map(row => transformSpanRow<SpanRecord>(row)),
      };
    } catch (error) {
      throw this.storageError('GET_TRACE', 'FAILED', { traceId }, error, ErrorCategory.USER);
    }
  }

  async getTraceLight(args: GetTraceArgs): Promise<GetTraceLightResponse | null> {
    const { traceId } = args;
    try {
      const spans = await this.db.manyOrNone<SpanRow>(
        `${this.lightSpanSelect()} FROM ${this.table()} WHERE ${col('traceId')} = :traceId ORDER BY ${col(
          'startedAt',
        )} ASC, ${col('spanId')} ASC`,
        { traceId },
      );

      if (spans.length === 0) return null;
      return {
        traceId,
        spans: spans.map(row => transformSpanRow<LightSpanRecord>(row)),
      };
    } catch (error) {
      throw this.storageError('GET_TRACE_LIGHT', 'FAILED', { traceId }, error, ErrorCategory.USER);
    }
  }

  async updateSpan(args: UpdateSpanArgs): Promise<void> {
    const { traceId, spanId } = args;
    try {
      await this.batchUpdateSpans({ records: [args] });
    } catch (error) {
      throw this.storageError('UPDATE_SPAN', 'FAILED', { traceId, spanId }, error, ErrorCategory.USER);
    }
  }

  async batchUpdateSpans(args: BatchUpdateSpansArgs): Promise<void> {
    if (args.records.length === 0) return;

    try {
      const now = new Date();
      const groups = new Map<string, { columns: SpanColumn[]; binds: Record<string, unknown>[] }>();

      for (const record of args.records) {
        const columns = updateColumns(record.updates);
        const data = { ...record.updates, updatedAt: now } as Record<string, unknown>;
        const key = columns.join('\0');
        const group = groups.get(key) ?? { columns, binds: [] };
        group.binds.push({
          traceId: record.traceId,
          spanId: record.spanId,
          ...Object.fromEntries(columns.map(columnName => [columnName, bindValue(columnName, data[columnName])])),
        });
        groups.set(key, group);
      }

      await this.db.tx(async client => {
        // Group updates by changed column set so executeMany can bind each
        // shape once instead of issuing one UPDATE per span.
        for (const group of groups.values()) {
          await client.executeMany(this.updateSql(group.columns), group.binds, {
            bindDefs: bindDefsForColumns(['traceId', 'spanId', ...group.columns]),
          });
        }
      });
    } catch (error) {
      throw this.storageError('BATCH_UPDATE_SPANS', 'FAILED', { count: args.records.length }, error, ErrorCategory.USER);
    }
  }

  async batchDeleteTraces(args: BatchDeleteTracesArgs): Promise<void> {
    if (args.traceIds.length === 0) return;

    try {
      await this.db.tx(async client => {
        await client.executeMany(
          `DELETE FROM ${this.table()} WHERE ${col('traceId')} = :traceId`,
          args.traceIds.map(traceId => ({ traceId })),
          { bindDefs: { traceId: { type: oracledb.STRING, maxSize: 512 } } },
        );
        await client.executeMany(
          `DELETE FROM ${this.table(LOG_EVENTS_TABLE)} WHERE ${logCol('traceId')} = :traceId`,
          args.traceIds.map(traceId => ({ traceId })),
          { bindDefs: { traceId: { type: oracledb.STRING, maxSize: 512 } } },
        );
      });
    } catch (error) {
      throw this.storageError('BATCH_DELETE_TRACES', 'FAILED', { count: args.traceIds.length }, error, ErrorCategory.USER);
    }
  }

  async listTraces(args: ListTracesArgs): Promise<ListTracesResponse> {
    const { filters, pagination, orderBy } = listTracesArgsSchema.parse(args);
    const page = pagination.page;
    const perPage = pagination.perPage;
    const binds: Record<string, unknown> = {};
    const conditions = [`r.${col('parentSpanId')} IS NULL`];

    try {
      if (filters) {
        // Trace listings start from root spans. Child-error filters are expressed
        // with EXISTS so users can find failed traces without loading children.
        addDateRangeFilter(conditions, binds, 'r', 'startedAt', filters.startedAt);
        addDateRangeFilter(conditions, binds, 'r', 'endedAt', filters.endedAt);

        for (const columnName of FILTER_TEXT_COLUMNS) {
          const value = filters[columnName as keyof typeof filters];
          if (value !== undefined) {
            conditions.push(`${qcol('r', columnName)} = ${addBind(binds, value)}`);
          }
        }

        addJsonObjectFilter(conditions, binds, 'r', 'scope', filters.scope);
        addJsonObjectFilter(conditions, binds, 'r', 'metadata', filters.metadata);
        addTagsFilter(conditions, binds, 'r', filters.tags);
        addStatusFilter(conditions, 'r', filters.status);
        addChildErrorFilter(conditions, this.table(), filters.hasChildError);
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`;
      const orderClause = traceOrderClause(orderBy.field, orderBy.direction);
      const countRow = await this.db.oneOrNone<{ count: number | string }>(
        `SELECT COUNT(*) AS "count" FROM ${this.table()} r ${whereClause}`,
        binds,
      );
      const total = Number(countRow?.count ?? 0);

      if (total === 0) {
        return {
          pagination: { total: 0, page, perPage, hasMore: false },
          spans: [],
        };
      }

      const offset = page * perPage;
      const spans = await this.db.manyOrNone<SpanRow>(
        `${spanSelect(SPAN_COLUMNS, 'r')} FROM ${this.table()} r ${whereClause} ${orderClause} OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
        { ...binds, offset, limit: perPage },
      );

      return {
        pagination: {
          total,
          page,
          perPage,
          hasMore: offset + perPage < total,
        },
        spans: toTraceSpans(spans.map(row => transformSpanRow<SpanRecord>(row))),
      };
    } catch (error) {
      throw this.storageError('LIST_TRACES', 'FAILED', {}, error, ErrorCategory.USER);
    }
  }

  async getEntityTypes(_args: GetEntityTypesArgs): Promise<GetEntityTypesResponse> {
    try {
      return {
        entityTypes: (await this.distinctContextValues('entityType')) as GetEntityTypesResponse['entityTypes'],
      };
    } catch (error) {
      throw this.storageError('GET_ENTITY_TYPES', 'FAILED', {}, error, ErrorCategory.USER);
    }
  }

  async getEntityNames(args: GetEntityNamesArgs): Promise<GetEntityNamesResponse> {
    try {
      const binds: Record<string, unknown> = {};
      const entityTypeFilter = args.entityType ? addBind(binds, args.entityType) : undefined;
      const rows = await this.db.manyOrNone<{ value: string }>(
        `
          SELECT value AS "value"
          FROM (
            SELECT ${col('entityName')} AS value
            FROM ${this.table()}
            WHERE ${col('entityName')} IS NOT NULL
              ${entityTypeFilter ? `AND ${col('entityType')} = ${entityTypeFilter}` : ''}
            UNION
            SELECT ${logCol('entityName')} AS value
            FROM ${this.table(LOG_EVENTS_TABLE)}
            WHERE ${logCol('entityName')} IS NOT NULL
              ${entityTypeFilter ? `AND ${logCol('entityType')} = ${entityTypeFilter}` : ''}
          )
          ORDER BY value
        `,
        binds,
      );

      return { names: rows.map(row => row.value) };
    } catch (error) {
      throw this.storageError('GET_ENTITY_NAMES', 'FAILED', { entityType: args.entityType }, error, ErrorCategory.USER);
    }
  }

  async getServiceNames(_args: GetServiceNamesArgs): Promise<GetServiceNamesResponse> {
    try {
      return { serviceNames: await this.distinctContextValues('serviceName') };
    } catch (error) {
      throw this.storageError('GET_SERVICE_NAMES', 'FAILED', {}, error, ErrorCategory.USER);
    }
  }

  async getEnvironments(_args: GetEnvironmentsArgs): Promise<GetEnvironmentsResponse> {
    try {
      return { environments: await this.distinctContextValues('environment') };
    } catch (error) {
      throw this.storageError('GET_ENVIRONMENTS', 'FAILED', {}, error, ErrorCategory.USER);
    }
  }

  async getTags(args: GetTagsArgs): Promise<GetTagsResponse> {
    try {
      const binds: Record<string, unknown> = {};
      const entityTypeFilter = args.entityType ? addBind(binds, args.entityType) : undefined;
      const rows = await this.db.manyOrNone<{ value: string }>(
        `
          SELECT value AS "value"
          FROM (
            SELECT span_tags.tag AS value
            FROM ${this.table()} s,
                 JSON_TABLE(${qcol('s', 'tags')}, '$[*]' COLUMNS (tag VARCHAR2(4000) PATH '$')) span_tags
            WHERE span_tags.tag IS NOT NULL
              ${entityTypeFilter ? `AND ${qcol('s', 'entityType')} = ${entityTypeFilter}` : ''}
            UNION
            SELECT log_tags.tag AS value
            FROM ${this.table(LOG_EVENTS_TABLE)} l,
                 JSON_TABLE(${logQcol('l', 'tags')}, '$[*]' COLUMNS (tag VARCHAR2(4000) PATH '$')) log_tags
            WHERE log_tags.tag IS NOT NULL
              ${entityTypeFilter ? `AND ${logQcol('l', 'entityType')} = ${entityTypeFilter}` : ''}
          )
          ORDER BY value
        `,
        binds,
      );

      return { tags: rows.map(row => row.value) };
    } catch (error) {
      throw this.storageError('GET_TAGS', 'FAILED', { entityType: args.entityType }, error, ErrorCategory.USER);
    }
  }

  private async createIndexes(): Promise<void> {
    await this.db.withConnection(async connection => {
      if (!this.skipDefaultIndexes) {
        for (const index of this.getDefaultIndexDefinitions()) {
          try {
            await createOracleIndex(connection, index, this.schemaName);
          } catch (error) {
            this.logger?.warn?.(`Failed to create Oracle default index ${index.name}:`, error);
          }
        }
      }

      for (const index of this.indexes) {
        try {
          await createOracleIndex(connection, index, this.schemaName);
        } catch (error) {
          this.logger?.warn?.(`Failed to create Oracle custom index ${index.name}:`, error);
        }
      }
    });
  }

  private async upsertSpans(spans: CreateSpanRecord[]): Promise<void> {
    if (spans.length === 0) return;

    const now = new Date();
    const binds = spans.map(span => spanRecordBinds({ ...span, createdAt: now, updatedAt: now }));

    await this.db.tx(async client => {
      // MERGE supports both initial span creation and later span completion
      // updates through the same code path.
      await client.executeMany(this.upsertSql(), binds, {
        bindDefs: bindDefsForColumns(SPAN_COLUMNS),
      });
    });
  }

  private upsertSql(): string {
    const sourceColumns = SPAN_COLUMNS.map(columnName => `:${columnName} AS ${col(columnName)}`).join(', ');
    const updateAssignments = SPAN_COLUMNS.filter(
      columnName => !SPAN_KEY_COLUMNS.has(columnName) && columnName !== 'createdAt',
    )
      .map(columnName => `target.${col(columnName)} = source.${col(columnName)}`)
      .join(', ');
    const insertColumns = SPAN_COLUMNS.map(columnName => col(columnName)).join(', ');
    const insertValues = SPAN_COLUMNS.map(columnName => `source.${col(columnName)}`).join(', ');

    return `
      MERGE INTO ${this.table()} target
      USING (SELECT ${sourceColumns} FROM dual) source
      ON (target.${col('traceId')} = source.${col('traceId')} AND target.${col('spanId')} = source.${col('spanId')})
      WHEN MATCHED THEN UPDATE SET ${updateAssignments}
      WHEN NOT MATCHED THEN INSERT (${insertColumns}) VALUES (${insertValues})
    `;
  }

  private updateSql(columns: SpanColumn[]): string {
    const assignments = columns.map(columnName => `${col(columnName)} = :${columnName}`).join(', ');
    return `UPDATE ${this.table()} SET ${assignments} WHERE ${col('traceId')} = :traceId AND ${col('spanId')} = :spanId`;
  }

  private logMergeSql(): string {
    const sourceColumns = LOG_COLUMNS.map(columnName => `:${logBindName(columnName)} AS ${logCol(columnName)}`).join(', ');
    const insertColumns = LOG_COLUMNS.map(columnName => logCol(columnName)).join(', ');
    const insertValues = LOG_COLUMNS.map(columnName => `source.${logCol(columnName)}`).join(', ');

    return `
      MERGE INTO ${this.table(LOG_EVENTS_TABLE)} target
      USING (SELECT ${sourceColumns} FROM dual) source
      ON (target.${logCol('logId')} = source.${logCol('logId')})
      WHEN NOT MATCHED THEN INSERT (${insertColumns}) VALUES (${insertValues})
    `;
  }

  private fullSpanSelect(): string {
    return spanSelect(SPAN_COLUMNS);
  }

  private lightSpanSelect(): string {
    return spanSelect(LIGHT_SPAN_COLUMNS);
  }

  private async distinctContextValues(columnName: SharedContextColumn): Promise<string[]> {
    // Studio discovery filters need values from both span rows and log rows.
    // UNION keeps the result distinct while allowing Oracle to use normal
    // scalar indexes on the shared observability context columns.
    const rows = await this.db.manyOrNone<{ value: string }>(
      `
        SELECT value AS "value"
        FROM (
          SELECT ${col(columnName as SpanColumn)} AS value
          FROM ${this.table()}
          WHERE ${col(columnName as SpanColumn)} IS NOT NULL
          UNION
          SELECT ${logCol(columnName as LogColumn)} AS value
          FROM ${this.table(LOG_EVENTS_TABLE)}
          WHERE ${logCol(columnName as LogColumn)} IS NOT NULL
        )
        ORDER BY value
      `,
    );

    return rows.map(row => row.value);
  }

  private table(tableName = TABLE_SPANS): string {
    return qualifyName(tableName, this.schemaName);
  }

  private indexName(indexName: string): string {
    return indexNameForTable(indexName, 'IDX');
  }

  private storageError(
    operation: string,
    reason: string,
    details: Record<string, string | number | boolean | undefined>,
    cause: unknown,
    category: ErrorCategory = ErrorCategory.THIRD_PARTY,
  ): MastraError {
    return createOracleStorageError({ storeName: STORE_NAME, operation, reason, details, cause, category });
  }
}

export function getDefaultObservabilityIndexDefinitions(
  indexName: (name: string) => string,
): OracleCreateIndexOptions[] {
  return [
    {
      name: indexName('MASTRA_AI_SPANS_TRACEID_STARTEDAT'),
      table: TABLE_SPANS,
      columns: ['traceId', 'startedAt DESC'],
    },
    {
      name: indexName('MASTRA_AI_SPANS_PARENTSPANID_STARTEDAT'),
      table: TABLE_SPANS,
      columns: ['parentSpanId', 'startedAt DESC'],
    },
    {
      name: indexName('MASTRA_AI_SPANS_NAME'),
      table: TABLE_SPANS,
      columns: ['name'],
    },
    {
      name: indexName('MASTRA_AI_SPANS_SPANTYPE_STARTEDAT'),
      table: TABLE_SPANS,
      columns: ['spanType', 'startedAt DESC'],
    },
    {
      name: indexName('MASTRA_AI_SPANS_ROOT_LOOKUP'),
      table: TABLE_SPANS,
      columns: ['traceId'],
      where: `${col('parentSpanId')} IS NULL`,
    },
    {
      name: indexName('MASTRA_AI_SPANS_ENTITYTYPE_ENTITYID'),
      table: TABLE_SPANS,
      columns: ['entityType', 'entityId'],
    },
    {
      name: indexName('MASTRA_AI_SPANS_ENTITYTYPE_ENTITYNAME'),
      table: TABLE_SPANS,
      columns: ['entityType', 'entityName'],
    },
    {
      name: indexName('MASTRA_AI_SPANS_ORGID_USERID'),
      table: TABLE_SPANS,
      columns: ['organizationId', 'userId'],
    },
    {
      name: indexName('MASTRA_LOG_EVENTS_TIMESTAMP'),
      table: LOG_EVENTS_TABLE,
      columns: ['"timestamp" DESC'],
    },
    {
      name: indexName('MASTRA_LOG_EVENTS_TRACE_SPAN_TS'),
      table: LOG_EVENTS_TABLE,
      columns: ['"traceId"', '"spanId"', '"timestamp" DESC'],
    },
    {
      name: indexName('MASTRA_LOG_EVENTS_LEVEL_TS'),
      table: LOG_EVENTS_TABLE,
      columns: ['"level"', '"timestamp" DESC'],
    },
    {
      name: indexName('MASTRA_LOG_EVENTS_ENTITY_ID'),
      table: LOG_EVENTS_TABLE,
      columns: ['"entityType"', '"entityId"'],
    },
    {
      name: indexName('MASTRA_LOG_EVENTS_ORG_USER'),
      table: LOG_EVENTS_TABLE,
      columns: ['"organizationId"', '"userId"'],
    },
  ];
}

export function logEventsTableSql(tableName: string): string {
  return `CREATE TABLE ${tableName} (
  ${logCol('logId')} VARCHAR2(512) PRIMARY KEY,
  ${logCol('timestamp')} TIMESTAMP WITH TIME ZONE NOT NULL,
  ${logCol('level')} VARCHAR2(64) NOT NULL,
  ${logCol('message')} CLOB NOT NULL,
  ${logCol('data')} JSON,
  ${logCol('traceId')} VARCHAR2(512),
  ${logCol('spanId')} VARCHAR2(512),
  ${logCol('entityType')} VARCHAR2(512),
  ${logCol('entityId')} VARCHAR2(512),
  ${logCol('entityName')} VARCHAR2(512),
  ${logCol('entityVersionId')} VARCHAR2(512),
  ${logCol('parentEntityType')} VARCHAR2(512),
  ${logCol('parentEntityId')} VARCHAR2(512),
  ${logCol('parentEntityName')} VARCHAR2(512),
  ${logCol('parentEntityVersionId')} VARCHAR2(512),
  ${logCol('rootEntityType')} VARCHAR2(512),
  ${logCol('rootEntityId')} VARCHAR2(512),
  ${logCol('rootEntityName')} VARCHAR2(512),
  ${logCol('rootEntityVersionId')} VARCHAR2(512),
  ${logCol('userId')} VARCHAR2(512),
  ${logCol('organizationId')} VARCHAR2(512),
  ${logCol('resourceId')} VARCHAR2(512),
  ${logCol('runId')} VARCHAR2(512),
  ${logCol('sessionId')} VARCHAR2(512),
  ${logCol('threadId')} VARCHAR2(512),
  ${logCol('requestId')} VARCHAR2(512),
  ${logCol('environment')} VARCHAR2(512),
  ${logCol('executionSource')} VARCHAR2(512),
  ${logCol('source')} VARCHAR2(512),
  ${logCol('serviceName')} VARCHAR2(512),
  ${logCol('experimentId')} VARCHAR2(512),
  ${logCol('tags')} JSON,
  ${logCol('metadata')} JSON,
  ${logCol('scope')} JSON
)`;
}

function spanRecordBinds(record: SpanMutationRecord): Record<string, unknown> {
  return Object.fromEntries(
    SPAN_COLUMNS.map(columnName => [columnName, bindValue(columnName, record[columnName as keyof SpanMutationRecord])]),
  );
}

function logRecordBinds(record: LogMutationRecord): Record<string, unknown> {
  return Object.fromEntries(
    LOG_COLUMNS.map(columnName => [
      logBindName(columnName),
      logBindValue(columnName, record[columnName as keyof LogMutationRecord]),
    ]),
  );
}

function updateColumns(updates: Record<string, unknown>): SpanColumn[] {
  const columns = SPAN_COLUMNS.filter(
    columnName =>
      !SPAN_KEY_COLUMNS.has(columnName) &&
      columnName !== 'createdAt' &&
      columnName !== 'updatedAt' &&
      Object.prototype.hasOwnProperty.call(updates, columnName) &&
      updates[columnName] !== undefined,
  );

  columns.push('updatedAt');
  return columns;
}

function bindValue(columnName: SpanColumn, value: unknown): unknown {
  if (value === undefined) return null;
  if (SPAN_JSON_COLUMNS.has(columnName)) return safeJsonValue(value ?? null);
  if (SPAN_BOOLEAN_COLUMNS.has(columnName)) return value ? 1 : 0;
  if (SPAN_TIMESTAMP_COLUMNS.has(columnName) && value != null) return toDate(value);
  return value ?? null;
}

function bindDefsForColumns(columns: readonly SpanColumn[]): NonNullable<oracledb.ExecuteManyOptions['bindDefs']> {
  return Object.fromEntries(columns.map(columnName => [columnName, bindDefForColumn(columnName)])) as Record<
    string,
    oracledb.BindDefinition
  >;
}

function bindDefsForLogColumns(columns: readonly LogColumn[]): NonNullable<oracledb.ExecuteManyOptions['bindDefs']> {
  return Object.fromEntries(columns.map(columnName => [logBindName(columnName), bindDefForLogColumn(columnName)])) as Record<
    string,
    oracledb.BindDefinition
  >;
}

function bindDefForColumn(columnName: SpanColumn): oracledb.BindDefinition {
  const column = SPAN_SCHEMA[columnName];

  switch (column?.type) {
    case 'jsonb':
      return { type: oracledb.DB_TYPE_JSON };
    case 'timestamp':
      return { type: oracledb.DB_TYPE_TIMESTAMP_TZ };
    case 'boolean':
    case 'integer':
    case 'bigint':
    case 'float':
      return { type: oracledb.NUMBER };
    case 'uuid':
    case 'text':
    default:
      return { type: oracledb.STRING, maxSize: isIdentifierLikeColumn(columnName) ? 512 : 4000 };
  }
}

function logBindValue(columnName: LogColumn, value: unknown): unknown {
  if (value === undefined) return null;
  if (LOG_JSON_COLUMNS.has(columnName)) return safeJsonValue(value ?? null);
  if (columnName === 'timestamp') return toDate(value);
  return value ?? null;
}

function logBindName(columnName: LogColumn): string {
  return `b_${columnName}`;
}

function bindDefForLogColumn(columnName: LogColumn): oracledb.BindDefinition {
  if (LOG_JSON_COLUMNS.has(columnName)) return { type: oracledb.DB_TYPE_JSON };
  if (columnName === 'timestamp') return { type: oracledb.DB_TYPE_TIMESTAMP_TZ };
  if (columnName === 'message') return { type: oracledb.DB_TYPE_CLOB };
  return { type: oracledb.STRING, maxSize: isIdentifierLikeColumn(columnName) ? 512 : 4000 };
}

function spanSelect(columns: readonly SpanColumn[], tableAlias?: string): string {
  return `SELECT ${columns.map(columnName => `${qcol(tableAlias, columnName)} AS "${columnName}"`).join(', ')}`;
}

function logSelect(columns: readonly LogColumn[], tableAlias?: string): string {
  return `SELECT ${columns.map(columnName => `${logQcol(tableAlias, columnName)} AS "${columnName}"`).join(', ')}`;
}

function scoreSelect(tableAlias?: string): string {
  return `SELECT ${Object.keys(SCORE_SCHEMA)
    .map(columnName => `${scoreQcol(tableAlias, columnName)} AS "${columnName}"`)
    .join(', ')}`;
}

function transformSpanRow<T extends SpanRow>(row: SpanRow): T {
  const result: SpanRow = {};

  for (const [key, value] of Object.entries(row)) {
    const columnName = key as SpanColumn;
    const column = SPAN_SCHEMA[columnName];

    if (!column) {
      result[key] = value;
    } else if (column.type === 'jsonb') {
      result[key] = parseJsonValue(value);
    } else if (column.type === 'timestamp') {
      result[key] = value == null ? null : toDate(value);
    } else if (column.type === 'boolean') {
      result[key] = parseBoolean(value);
    } else {
      result[key] = value;
    }
  }

  return result as T;
}

function transformLogRow(row: LogRow): LogRecord {
  const result: LogRow = {};

  for (const [key, value] of Object.entries(row)) {
    const columnName = key as LogColumn;
    if (LOG_JSON_COLUMNS.has(columnName)) {
      result[key] = parseJsonValue(value);
    } else if (columnName === 'timestamp') {
      result[key] = toDate(value);
    } else {
      result[key] = value;
    }
  }

  return result as LogRecord;
}

function transformObservabilityScoreRow(row: ScoreRow): ScoreRecord {
  const metadata = parseObjectValue(row.metadata);
  const scorer = parseObjectValue(row.scorer);
  const entity = parseObjectValue(row.entity);
  const requestContext = parseObjectValue(row.requestContext);
  const source = optionalString(row.source);

  // Legacy evaluator scores and new observability scores share one table in Mastra.
  // This adapter maps the evaluator row shape into the Studio-facing ScoreRecord
  // shape so /observability/scores can browse the same persisted data.
  return {
    scoreId: optionalString(row.id),
    timestamp: toDate(row.createdAt ?? row.updatedAt ?? new Date()),
    traceId: optionalString(row.traceId),
    spanId: optionalString(row.spanId),
    scorerId: optionalString(row.scorerId) ?? optionalString(scorer?.id) ?? 'unknown-scorer',
    scorerName: optionalString(scorer?.name) ?? optionalString(scorer?.scorerName),
    scorerVersion: optionalString(scorer?.version) ?? optionalString(scorer?.scorerVersion),
    scoreSource: source,
    source,
    score: Number(row.score ?? 0),
    reason: optionalString(row.reason),
    entityType: optionalEntityType(row.entityType),
    entityId: optionalString(row.entityId),
    entityName: optionalString(entity?.name) ?? optionalString(metadata?.entityName),
    parentEntityType: optionalEntityType(metadata?.parentEntityType),
    parentEntityId: optionalString(metadata?.parentEntityId),
    parentEntityName: optionalString(metadata?.parentEntityName),
    rootEntityType: optionalEntityType(metadata?.rootEntityType),
    rootEntityId: optionalString(metadata?.rootEntityId),
    rootEntityName: optionalString(metadata?.rootEntityName),
    userId: optionalString(metadata?.userId),
    organizationId: optionalString(metadata?.organizationId),
    resourceId: optionalString(row.resourceId),
    runId: optionalString(row.runId),
    sessionId: optionalString(metadata?.sessionId),
    threadId: optionalString(row.threadId),
    requestId: optionalString(metadata?.requestId),
    environment: optionalString(metadata?.environment),
    serviceName: optionalString(metadata?.serviceName),
    scope: parseObjectValue(metadata?.scope),
    entityVersionId: optionalString(metadata?.entityVersionId),
    parentEntityVersionId: optionalString(metadata?.parentEntityVersionId),
    rootEntityVersionId: optionalString(metadata?.rootEntityVersionId),
    experimentId: optionalString(metadata?.experimentId) ?? optionalString(requestContext?.experimentId),
    executionSource: optionalString(metadata?.executionSource),
    tags: parseStringArray(metadata?.tags),
    scoreTraceId: optionalString(metadata?.scoreTraceId) ?? optionalString(requestContext?.scoreTraceId),
    metadata,
  };
}

function scoreRecordToTableRecord(score: ScoreRecord): Record<string, unknown> {
  const id = score.scoreId ?? randomUUID();
  const timestamp = score.timestamp instanceof Date ? score.timestamp : new Date(score.timestamp ?? Date.now());
  const source = score.scoreSource ?? score.source ?? 'observability';
  const metadata = {
    ...(score.metadata ?? {}),
    entityName: score.entityName,
    entityVersionId: score.entityVersionId,
    parentEntityType: score.parentEntityType,
    parentEntityId: score.parentEntityId,
    parentEntityName: score.parentEntityName,
    parentEntityVersionId: score.parentEntityVersionId,
    rootEntityType: score.rootEntityType,
    rootEntityId: score.rootEntityId,
    rootEntityName: score.rootEntityName,
    rootEntityVersionId: score.rootEntityVersionId,
    userId: score.userId,
    organizationId: score.organizationId,
    sessionId: score.sessionId,
    requestId: score.requestId,
    environment: score.environment,
    serviceName: score.serviceName,
    executionSource: score.executionSource,
    experimentId: score.experimentId,
    tags: score.tags,
    scoreTraceId: score.scoreTraceId,
    scope: score.scope,
  };

  // Observability scores and evaluator scores share Mastra's scorer table.
  // Fields that do not exist as first-class scorer columns are folded into
  // metadata so the Studio score browser can still filter by context.
  return {
    id,
    scorerId: score.scorerId,
    traceId: score.traceId,
    spanId: score.spanId,
    runId: score.runId ?? score.traceId ?? id,
    scorer: safeJsonValue({
      id: score.scorerId,
      name: score.scorerName,
      version: score.scorerVersion,
    }),
    preprocessStepResult: null,
    extractStepResult: null,
    analyzeStepResult: null,
    score: score.score,
    reason: score.reason,
    metadata: safeJsonValue(removeUndefined(metadata)),
    preprocessPrompt: null,
    extractPrompt: null,
    generateScorePrompt: null,
    generateReasonPrompt: null,
    analyzePrompt: null,
    reasonPrompt: null,
    input: safeJsonValue({}),
    output: safeJsonValue({}),
    additionalContext: null,
    requestContext: safeJsonValue(
      removeUndefined({
        experimentId: score.experimentId,
        scoreTraceId: score.scoreTraceId,
      }),
    ),
    entityType: score.entityType,
    entity: safeJsonValue(removeUndefined({ id: score.entityId, name: score.entityName })),
    entityId: score.entityId,
    source,
    resourceId: score.resourceId,
    threadId: score.threadId,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function parseObjectValue(value: unknown): Record<string, unknown> | undefined {
  const parsed = parseJsonValue(value);
  return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : undefined;
}

function parseStringArray(value: unknown): string[] | undefined {
  const parsed = parseJsonValue(value);
  if (!Array.isArray(parsed)) return undefined;
  return parsed.filter((item): item is string => typeof item === 'string');
}

function removeUndefined<T extends Record<string, unknown>>(record: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function optionalEntityType(value: unknown): ScoreRecord['entityType'] {
  return optionalString(value) as ScoreRecord['entityType'];
}

function parseBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') return value === '1' || value.toLowerCase() === 'true';
  return Boolean(value);
}

function addDateRangeFilter(
  conditions: string[],
  binds: Record<string, unknown>,
  tableAlias: string,
  columnName: 'startedAt' | 'endedAt',
  range?: { start?: Date; end?: Date },
): void {
  if (range?.start) {
    conditions.push(`${qcol(tableAlias, columnName)} >= ${addBind(binds, range.start)}`);
  }
  if (range?.end) {
    conditions.push(`${qcol(tableAlias, columnName)} <= ${addBind(binds, range.end)}`);
  }
}

function addLogDateRangeFilter(
  conditions: string[],
  binds: Record<string, unknown>,
  tableAlias: string,
  range?: { start?: Date; end?: Date; startExclusive?: boolean; endExclusive?: boolean },
): void {
  if (range?.start) {
    conditions.push(`${logQcol(tableAlias, 'timestamp')} ${range.startExclusive ? '>' : '>='} ${addBind(binds, range.start)}`);
  }
  if (range?.end) {
    conditions.push(`${logQcol(tableAlias, 'timestamp')} ${range.endExclusive ? '<' : '<='} ${addBind(binds, range.end)}`);
  }
}

function addScoreFilters(
  conditions: string[],
  binds: Record<string, unknown>,
  filters?: ListScoresArgs['filters'],
): void {
  if (!filters) return;

  addScoreDateRangeFilter(conditions, binds, 's', filters.timestamp);

  for (const columnName of SCORE_TEXT_FILTER_COLUMNS) {
    const value = filters[columnName as keyof typeof filters];
    if (value !== undefined) {
      conditions.push(`${scoreQcol('s', columnName)} = ${addBind(binds, value)}`);
    }
  }

  if (filters.scorerId !== undefined) {
    const scorerIds = Array.isArray(filters.scorerId) ? filters.scorerId : [filters.scorerId];
    if (scorerIds.length > 0) {
      conditions.push(`${scoreQcol('s', 'scorerId')} IN (${scorerIds.map(id => addBind(binds, id)).join(', ')})`);
    }
  }

  const scoreSource = filters.scoreSource ?? filters.source;
  if (scoreSource !== undefined) {
    conditions.push(`${scoreQcol('s', 'source')} = ${addBind(binds, scoreSource)}`);
  }

  if (filters.experimentId !== undefined) {
    const experimentIdBind = addBind(binds, filters.experimentId);
    conditions.push(
      `(JSON_VALUE(${scoreQcol(
        's',
        'metadata',
      )}, '$.experimentId' RETURNING VARCHAR2(4000) NULL ON ERROR) = ${experimentIdBind} OR JSON_VALUE(${scoreQcol(
        's',
        'requestContext',
      )}, '$.experimentId' RETURNING VARCHAR2(4000) NULL ON ERROR) = ${experimentIdBind})`,
    );
  }

  for (const fieldName of SCORE_METADATA_FILTER_FIELDS) {
    const value = filters[fieldName as keyof typeof filters];
    if (value !== undefined) {
      conditions.push(
        `JSON_VALUE(${scoreQcol(
          's',
          'metadata',
        )}, '$.${fieldName}' RETURNING VARCHAR2(4000) NULL ON ERROR) = ${addBind(binds, value)}`,
      );
    }
  }

  addScoreMetadataTagsFilter(conditions, binds, 's', filters.tags);
}

function addScoreDateRangeFilter(
  conditions: string[],
  binds: Record<string, unknown>,
  tableAlias: string,
  range?: { start?: unknown; end?: unknown; startExclusive?: boolean; endExclusive?: boolean },
): void {
  if (range?.start) {
    conditions.push(
      `${scoreQcol(tableAlias, 'createdAt')} ${range.startExclusive ? '>' : '>='} ${addBind(
        binds,
        toDate(range.start),
      )}`,
    );
  }
  if (range?.end) {
    conditions.push(
      `${scoreQcol(tableAlias, 'createdAt')} ${range.endExclusive ? '<' : '<='} ${addBind(binds, toDate(range.end))}`,
    );
  }
}

function addJsonObjectFilter(
  conditions: string[],
  binds: Record<string, unknown>,
  tableAlias: string,
  columnName: 'scope' | 'metadata',
  filter?: Record<string, unknown> | null,
): void {
  if (!filter) return;

  for (const [path, value] of Object.entries(filter)) {
    conditions.push(
      `JSON_VALUE(${qcol(tableAlias, columnName)}, '${assertJsonPath(
        path,
      )}' RETURNING VARCHAR2(4000) NULL ON ERROR) = ${addBind(binds, jsonComparableValue(value))}`,
    );
  }
}

function addLogJsonObjectFilter(
  conditions: string[],
  binds: Record<string, unknown>,
  tableAlias: string,
  columnName: 'scope' | 'metadata',
  filter?: Record<string, unknown> | null,
): void {
  if (!filter) return;

  for (const [path, value] of Object.entries(filter)) {
    conditions.push(
      `JSON_VALUE(${logQcol(tableAlias, columnName)}, '${assertJsonPath(
        path,
      )}' RETURNING VARCHAR2(4000) NULL ON ERROR) = ${addBind(binds, jsonComparableValue(value))}`,
    );
  }
}

function addTagsFilter(
  conditions: string[],
  binds: Record<string, unknown>,
  tableAlias: string,
  tags?: string[] | null,
): void {
  if (!tags?.length) return;

  for (const tag of tags) {
    conditions.push(
      `EXISTS (SELECT 1 FROM JSON_TABLE(${qcol(
        tableAlias,
        'tags',
      )}, '$[*]' COLUMNS (tag VARCHAR2(4000) PATH '$')) tag_filter WHERE tag_filter.tag = ${addBind(binds, tag)})`,
    );
  }
}

function addScoreMetadataTagsFilter(
  conditions: string[],
  binds: Record<string, unknown>,
  tableAlias: string,
  tags?: string[] | null,
): void {
  if (!tags?.length) return;

  for (const tag of tags) {
    conditions.push(
      `EXISTS (SELECT 1 FROM JSON_TABLE(${scoreQcol(
        tableAlias,
        'metadata',
      )}, '$.tags[*]' COLUMNS (tag VARCHAR2(4000) PATH '$')) tag_filter WHERE tag_filter.tag = ${addBind(
        binds,
        tag,
      )})`,
    );
  }
}

function addLogTagsFilter(
  conditions: string[],
  binds: Record<string, unknown>,
  tableAlias: string,
  tags?: string[] | null,
): void {
  if (!tags?.length) return;

  for (const tag of tags) {
    conditions.push(
      `EXISTS (SELECT 1 FROM JSON_TABLE(${logQcol(
        tableAlias,
        'tags',
      )}, '$[*]' COLUMNS (tag VARCHAR2(4000) PATH '$')) tag_filter WHERE tag_filter.tag = ${addBind(binds, tag)})`,
    );
  }
}

function addStatusFilter(conditions: string[], tableAlias: string, status?: TraceStatus): void {
  if (status === undefined) return;

  switch (status) {
    case TraceStatus.ERROR:
      conditions.push(jsonValueIsPresent(qcol(tableAlias, 'error')));
      break;
    case TraceStatus.RUNNING:
      conditions.push(`${qcol(tableAlias, 'endedAt')} IS NULL AND ${jsonValueIsAbsent(qcol(tableAlias, 'error'))}`);
      break;
    case TraceStatus.SUCCESS:
      conditions.push(`${qcol(tableAlias, 'endedAt')} IS NOT NULL AND ${jsonValueIsAbsent(qcol(tableAlias, 'error'))}`);
      break;
  }
}

function addChildErrorFilter(conditions: string[], tableName: string, hasChildError?: boolean): void {
  if (hasChildError === undefined) return;

  const childErrorPredicate = `SELECT 1 FROM ${tableName} c WHERE c.${col('traceId')} = r.${col(
    'traceId',
  )} AND ${jsonValueIsPresent(`c.${col('error')}`)}`;
  conditions.push(`${hasChildError ? 'EXISTS' : 'NOT EXISTS'} (${childErrorPredicate})`);
}

function jsonValueIsPresent(expression: string): string {
  return `${expression} IS NOT NULL AND JSON_EXISTS(${expression}, '$?(@ != null)')`;
}

function jsonValueIsAbsent(expression: string): string {
  return `(${expression} IS NULL OR NOT JSON_EXISTS(${expression}, '$?(@ != null)'))`;
}

function traceOrderClause(field: 'startedAt' | 'endedAt', direction: 'ASC' | 'DESC'): string {
  if (field === 'endedAt') {
    const nullsOrder = direction === 'DESC' ? 'NULLS FIRST' : 'NULLS LAST';
    return `ORDER BY r.${col('endedAt')} ${direction} ${nullsOrder}, r.${col('traceId')} ${direction}`;
  }

  return `ORDER BY r.${col('startedAt')} ${direction}, r.${col('traceId')} ${direction}`;
}

function addBind(binds: Record<string, unknown>, value: unknown): string {
  const name = `p${Object.keys(binds).length}`;
  binds[name] = value;
  return `:${name}`;
}

function jsonComparableValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(safeJsonValue(value));
}

function qcol(tableAlias: string | undefined, columnName: SpanColumn): string {
  const column = col(columnName);
  return tableAlias ? `${tableAlias}.${column}` : column;
}

function logQcol(tableAlias: string | undefined, columnName: LogColumn): string {
  const column = logCol(columnName);
  return tableAlias ? `${tableAlias}.${column}` : column;
}

function scoreQcol(tableAlias: string | undefined, columnName: string): string {
  const column = scoreCol(columnName);
  return tableAlias ? `${tableAlias}.${column}` : column;
}

function col(columnName: SpanColumn): string {
  if (!SPAN_SCHEMA[columnName]) {
    throw new Error(`Unknown span column: ${columnName}`);
  }
  if (!SIMPLE_IDENTIFIER.test(columnName)) {
    throw new Error(`Invalid span column: ${columnName}`);
  }
  if (LOWERCASE_SQL_IDENTIFIER.test(columnName)) return columnName;
  return `"${columnName}"`;
}

function logCol(columnName: LogColumn): string {
  if (!LOG_COLUMNS.includes(columnName)) {
    throw new Error(`Unknown log column: ${columnName}`);
  }
  if (!SIMPLE_IDENTIFIER.test(columnName)) {
    throw new Error(`Invalid log column: ${columnName}`);
  }
  return `"${columnName}"`;
}

function scoreCol(columnName: string): string {
  if (!SCORE_SCHEMA[columnName]) {
    throw new Error(`Unknown score column: ${columnName}`);
  }
  if (!SIMPLE_IDENTIFIER.test(columnName)) {
    throw new Error(`Invalid score column: ${columnName}`);
  }
  if (LOWERCASE_SQL_IDENTIFIER.test(columnName)) return columnName;
  return `"${columnName}"`;
}

function isIdentifierLikeColumn(columnName: string): boolean {
  return columnName === 'id' || columnName.endsWith('Id') || columnName.endsWith('_id');
}
