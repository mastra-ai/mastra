import type { Database } from '@google-cloud/spanner';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  createStorageErrorId,
  listTracesArgsSchema,
  ObservabilityStorage,
  TABLE_SCHEMAS,
  TABLE_SPANS,
  toTraceSpans,
  TraceStatus,
} from '@mastra/core/storage';
import type {
  BatchCreateMetricsArgs,
  BatchCreateSpansArgs,
  BatchDeleteTracesArgs,
  BatchUpdateSpansArgs,
  CreateIndexOptions,
  CreateSpanArgs,
  GetMetricAggregateArgs,
  GetMetricAggregateResponse,
  GetMetricBreakdownArgs,
  GetMetricBreakdownResponse,
  GetMetricLabelKeysArgs,
  GetMetricLabelKeysResponse,
  GetMetricLabelValuesArgs,
  GetMetricLabelValuesResponse,
  GetMetricNamesArgs,
  GetMetricNamesResponse,
  GetMetricPercentilesArgs,
  GetMetricPercentilesResponse,
  GetMetricTimeSeriesArgs,
  GetMetricTimeSeriesResponse,
  GetRootSpanArgs,
  GetRootSpanResponse,
  GetSpanArgs,
  GetSpanResponse,
  GetTraceArgs,
  GetTraceLightResponse,
  GetTraceResponse,
  LightSpanRecord,
  ListMetricsArgs,
  ListMetricsResponse,
  ListTracesArgs,
  ListTracesResponse,
  SpanRecord,
  TracingStorageStrategy,
  UpdateSpanArgs,
} from '@mastra/core/storage';
import { SpannerDB, resolveSpannerConfig } from '../../db';
import type { SpannerDomainConfig, SpannerInitMode } from '../../db';
import { quoteIdent } from '../../db/utils';
import { transformFromSpannerRow } from '../utils';
import * as metricsOps from './metrics';
import { TABLE_AI_METRICS } from './metrics';

function invalidTraceFilterKey(kind: string, key: string): MastraError {
  return new MastraError({
    id: createStorageErrorId('SPANNER', 'LIST_TRACES', 'VALIDATE_FAILED'),
    domain: ErrorDomain.STORAGE,
    category: ErrorCategory.USER,
    text: `Invalid ${kind} key: ${key}`,
    details: { [`${kind}Key`]: key },
  });
}

/**
 * Observability domain for Spanner. Stores AI tracing spans in `mastra_ai_spans`
 * and supports the trace read/write surface that powers the Mastra observability
 * UI: per-span CRUD, per-trace fetch, lightweight trace skeletons for the
 * waterfall view, and root-span pagination with the listTraces filters.
 */
export class ObservabilitySpanner extends ObservabilityStorage {
  private database: Database;
  private db: SpannerDB;
  private readonly skipDefaultIndexes?: boolean;
  private readonly indexes?: CreateIndexOptions[];
  private readonly initMode: SpannerInitMode;
  /**
   * Bounded-staleness window (in ms) applied to every metrics read path.
   * Default 10000 (weak reads).
   */
  private readonly dashboardStalenessMs: number;
  /**
   * When true (the default), every metric method throws the base-class
   * `*_NOT_IMPLEMENTED` error and the metrics table is not created during
   * `init()`. See the option doc on `SpannerDomainDatabaseConfig` for the
   * full rationale.
   */
  private readonly disableMetrics: boolean;

  /** Tables managed by this domain */
  static readonly MANAGED_TABLES = [TABLE_SPANS, TABLE_AI_METRICS] as const;

  constructor(config: SpannerDomainConfig) {
    super();
    const { database, indexes, skipDefaultIndexes, initMode, dashboardStalenessMs, disableMetrics } =
      resolveSpannerConfig(config);
    this.database = database;
    this.db = new SpannerDB({ database, skipDefaultIndexes, initMode });
    this.skipDefaultIndexes = skipDefaultIndexes;
    this.initMode = initMode ?? 'sync';
    this.dashboardStalenessMs = dashboardStalenessMs ?? 10000;
    // Default to disabled: Spanner is not a good fit for the metrics
    // workload at scale. Set `disableMetrics: false` to opt in.
    this.disableMetrics = disableMetrics ?? true;
    this.indexes = indexes?.filter(idx =>
      (ObservabilitySpanner.MANAGED_TABLES as readonly string[]).includes(idx.table),
    );
  }

  /** Build the read-options object that every metrics read path threads through. */
  private readOptions(): metricsOps.MetricsReadOptions {
    return { stalenessMs: this.dashboardStalenessMs };
  }

  /**
   * Throw the same shape of NOT_IMPLEMENTED error the base class would when
   * a method isn't overridden
   */
  private metricsDisabledError(method: Uppercase<string>): MastraError {
    return new MastraError({
      id: `OBSERVABILITY_STORAGE_${method}_NOT_IMPLEMENTED` as Uppercase<string>,
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.USER,
      text: `Spanner metrics are disabled (set disableMetrics: false on the SpannerStore to opt in).`,
    });
  }

  async init(): Promise<void> {
    await this.db.createTable({ tableName: TABLE_SPANS, schema: TABLE_SCHEMAS[TABLE_SPANS] });
    // `requestContext` was added after the initial schema shipped; backfill on
    // existing tables so older deployments keep working when they upgrade.
    await this.db.alterTable({
      tableName: TABLE_SPANS,
      schema: TABLE_SCHEMAS[TABLE_SPANS],
      ifNotExists: ['requestContext'],
    });
    if (!this.disableMetrics) {
      await metricsOps.ensureMetricsTable(this.database, {
        initMode: this.initMode,
        skipDefaultIndexes: this.skipDefaultIndexes,
      });
    }
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    return [
      {
        name: 'mastra_ai_spans_traceid_startedat_idx',
        table: TABLE_SPANS,
        columns: ['traceId', 'startedAt DESC'],
      },
      {
        name: 'mastra_ai_spans_parentspanid_startedat_idx',
        table: TABLE_SPANS,
        columns: ['parentSpanId', 'startedAt DESC'],
      },
      {
        name: 'mastra_ai_spans_name_idx',
        table: TABLE_SPANS,
        columns: ['name'],
      },
      {
        name: 'mastra_ai_spans_spantype_startedat_idx',
        table: TABLE_SPANS,
        columns: ['spanType', 'startedAt DESC'],
      },
      {
        name: 'mastra_ai_spans_entitytype_entityid_idx',
        table: TABLE_SPANS,
        columns: ['entityType', 'entityId'],
      },
      {
        name: 'mastra_ai_spans_entitytype_entityname_idx',
        table: TABLE_SPANS,
        columns: ['entityType', 'entityName'],
      },
      {
        name: 'mastra_ai_spans_orgid_userid_idx',
        table: TABLE_SPANS,
        columns: ['organizationId', 'userId'],
      },
    ];
  }

  async createDefaultIndexes(): Promise<void> {
    if (this.skipDefaultIndexes) return;
    await this.db.createIndexes(this.getDefaultIndexDefinitions());
  }

  async createCustomIndexes(): Promise<void> {
    if (!this.indexes || this.indexes.length === 0) return;
    await this.db.createIndexes(this.indexes);
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.db.clearTable({ tableName: TABLE_SPANS });
    // Only touch the metrics table when we actually own it.
    if (!this.disableMetrics) {
      await metricsOps.clearMetrics(this.database);
    }
  }

  public override get tracingStrategy(): {
    preferred: TracingStorageStrategy;
    supported: TracingStorageStrategy[];
  } {
    return {
      preferred: 'batch-with-updates',
      supported: ['batch-with-updates', 'insert-only'],
    };
  }

  async createSpan(args: CreateSpanArgs): Promise<void> {
    const { span } = args;
    try {
      const now = new Date();
      await this.db.insert({
        tableName: TABLE_SPANS,
        record: {
          ...span,
          createdAt: now,
          updatedAt: now,
        },
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'CREATE_SPAN', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: {
            spanId: span.spanId,
            traceId: span.traceId,
            spanType: span.spanType,
            name: span.name,
          },
        },
        error,
      );
    }
  }

  async batchCreateSpans(args: BatchCreateSpansArgs): Promise<void> {
    try {
      const now = new Date();
      const records = args.records.map(record => ({
        ...record,
        createdAt: now,
        updatedAt: now,
      }));
      await this.db.batchInsert({ tableName: TABLE_SPANS, records });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'BATCH_CREATE_SPANS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
        },
        error,
      );
    }
  }

  async updateSpan(args: UpdateSpanArgs): Promise<void> {
    const { traceId, spanId, updates } = args;
    try {
      await this.db.update({
        tableName: TABLE_SPANS,
        keys: { traceId, spanId },
        data: {
          ...updates,
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'UPDATE_SPAN', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { spanId, traceId },
        },
        error,
      );
    }
  }

  async batchUpdateSpans(args: BatchUpdateSpansArgs): Promise<void> {
    try {
      const now = new Date();
      await this.db.batchUpdate({
        tableName: TABLE_SPANS,
        updates: args.records.map(record => ({
          keys: { traceId: record.traceId, spanId: record.spanId },
          data: { ...record.updates, updatedAt: now },
        })),
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'BATCH_UPDATE_SPANS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
        },
        error,
      );
    }
  }

  async getSpan(args: GetSpanArgs): Promise<GetSpanResponse | null> {
    const { traceId, spanId } = args;
    try {
      const tableName = quoteIdent(TABLE_SPANS, 'table name');
      const [rows] = await this.database.run({
        sql: `SELECT * FROM ${tableName} WHERE ${quoteIdent('traceId', 'column name')} = @traceId
              AND ${quoteIdent('spanId', 'column name')} = @spanId LIMIT 1`,
        params: { traceId, spanId },
        json: true,
      });
      const row = (rows as Array<Record<string, any>>)[0];
      if (!row) return null;
      return {
        span: transformFromSpannerRow<SpanRecord>({ tableName: TABLE_SPANS, row }),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'GET_SPAN', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { traceId, spanId },
        },
        error,
      );
    }
  }

  async getRootSpan(args: GetRootSpanArgs): Promise<GetRootSpanResponse | null> {
    const { traceId } = args;
    try {
      const tableName = quoteIdent(TABLE_SPANS, 'table name');
      const [rows] = await this.database.run({
        sql: `SELECT * FROM ${tableName} WHERE ${quoteIdent('traceId', 'column name')} = @traceId
              AND ${quoteIdent('parentSpanId', 'column name')} IS NULL LIMIT 1`,
        params: { traceId },
        json: true,
      });
      const row = (rows as Array<Record<string, any>>)[0];
      if (!row) return null;
      return {
        span: transformFromSpannerRow<SpanRecord>({ tableName: TABLE_SPANS, row }),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'GET_ROOT_SPAN', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { traceId },
        },
        error,
      );
    }
  }

  async getTrace(args: GetTraceArgs): Promise<GetTraceResponse | null> {
    const { traceId } = args;
    try {
      const tableName = quoteIdent(TABLE_SPANS, 'table name');
      const [rows] = await this.database.run({
        sql: `SELECT * FROM ${tableName} WHERE ${quoteIdent('traceId', 'column name')} = @traceId
              ORDER BY ${quoteIdent('startedAt', 'column name')} ASC`,
        params: { traceId },
        json: true,
      });
      const spans = rows as Array<Record<string, any>>;
      if (spans.length === 0) return null;
      return {
        traceId,
        spans: spans.map(row => transformFromSpannerRow<SpanRecord>({ tableName: TABLE_SPANS, row })),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'GET_TRACE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { traceId },
        },
        error,
      );
    }
  }

  async getTraceLight(args: GetTraceArgs): Promise<GetTraceLightResponse | null> {
    const { traceId } = args;
    try {
      const tableName = quoteIdent(TABLE_SPANS, 'table name');
      const [rows] = await this.database.run({
        sql: `SELECT ${quoteIdent('traceId', 'column name')}, ${quoteIdent('spanId', 'column name')},
              ${quoteIdent('parentSpanId', 'column name')}, ${quoteIdent('name', 'column name')},
              ${quoteIdent('entityType', 'column name')}, ${quoteIdent('entityId', 'column name')},
              ${quoteIdent('entityName', 'column name')},
              ${quoteIdent('spanType', 'column name')}, ${quoteIdent('error', 'column name')},
              ${quoteIdent('isEvent', 'column name')},
              ${quoteIdent('startedAt', 'column name')}, ${quoteIdent('endedAt', 'column name')},
              ${quoteIdent('createdAt', 'column name')}, ${quoteIdent('updatedAt', 'column name')}
              FROM ${tableName} WHERE ${quoteIdent('traceId', 'column name')} = @traceId
              ORDER BY ${quoteIdent('startedAt', 'column name')} ASC`,
        params: { traceId },
        json: true,
      });
      const spans = rows as Array<Record<string, any>>;
      if (spans.length === 0) return null;
      return {
        traceId,
        spans: spans.map(row => transformFromSpannerRow<LightSpanRecord>({ tableName: TABLE_SPANS, row })),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'GET_TRACE_LIGHT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { traceId },
        },
        error,
      );
    }
  }

  async listTraces(args: ListTracesArgs): Promise<ListTracesResponse> {
    const { filters, pagination, orderBy } = listTracesArgsSchema.parse(args);
    const page = pagination?.page ?? 0;
    const perPage = pagination?.perPage ?? 10;

    const tableName = quoteIdent(TABLE_SPANS, 'table name');
    const rAlias = 'r';

    try {
      // Root-only filter. The aliased columns let the hasChildError EXISTS
      // subquery correlate without ambiguity.
      const conditions: string[] = [`${rAlias}.${quoteIdent('parentSpanId', 'column name')} IS NULL`];
      const params: Record<string, any> = {};
      const types: Record<string, any> = {};
      let pi = 0;
      const nextParam = () => `f${pi++}`;
      const bindScalar = (col: string, value: any, op = '='): void => {
        const param = nextParam();
        conditions.push(`${rAlias}.${quoteIdent(col, 'column name')} ${op} @${param}`);
        params[param] = value instanceof Date ? value.toISOString() : value;
        const colType = TABLE_SCHEMAS[TABLE_SPANS]?.[col]?.type;
        if (colType === 'timestamp') {
          types[param] = 'timestamp';
        }
      };

      if (filters) {
        if (filters.startedAt?.start) {
          bindScalar('startedAt', filters.startedAt.start, '>=');
        }
        if (filters.startedAt?.end) {
          bindScalar('startedAt', filters.startedAt.end, '<=');
        }
        if (filters.endedAt?.start) {
          bindScalar('endedAt', filters.endedAt.start, '>=');
        }
        if (filters.endedAt?.end) {
          bindScalar('endedAt', filters.endedAt.end, '<=');
        }

        if (filters.spanType !== undefined) bindScalar('spanType', filters.spanType);

        if (filters.entityType !== undefined) bindScalar('entityType', filters.entityType);
        if (filters.entityId !== undefined) bindScalar('entityId', filters.entityId);
        if (filters.entityName !== undefined) bindScalar('entityName', filters.entityName);

        if (filters.userId !== undefined) bindScalar('userId', filters.userId);
        if (filters.organizationId !== undefined) bindScalar('organizationId', filters.organizationId);
        if (filters.resourceId !== undefined) bindScalar('resourceId', filters.resourceId);

        if (filters.runId !== undefined) bindScalar('runId', filters.runId);
        if (filters.sessionId !== undefined) bindScalar('sessionId', filters.sessionId);
        if (filters.threadId !== undefined) bindScalar('threadId', filters.threadId);
        if (filters.requestId !== undefined) bindScalar('requestId', filters.requestId);

        if (filters.environment !== undefined) bindScalar('environment', filters.environment);
        if (filters.source !== undefined) bindScalar('source', filters.source);
        if (filters.serviceName !== undefined) bindScalar('serviceName', filters.serviceName);

        // Scope (JSON) is stored as a tagged record; filter each property
        // using JSON_VALUE so common one-shot lookups still hit the index.
        if (filters.scope != null) {
          for (const [key, value] of Object.entries(filters.scope as Record<string, unknown>)) {
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) throw invalidTraceFilterKey('scope', key);
            const param = nextParam();
            conditions.push(`JSON_VALUE(${rAlias}.${quoteIdent('scope', 'column name')}, '$.${key}') = @${param}`);
            params[param] = typeof value === 'string' ? value : JSON.stringify(value);
          }
        }

        // Same approach for metadata: per-key JSON_VALUE equality. PG's
        // jsonb `@>` containment is faster for nested objects, but Spanner
        // has no native equivalent so we settle for top-level scalar match.
        if (filters.metadata != null) {
          for (const [key, value] of Object.entries(filters.metadata as Record<string, unknown>)) {
            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) throw invalidTraceFilterKey('metadata', key);
            const param = nextParam();
            conditions.push(`JSON_VALUE(${rAlias}.${quoteIdent('metadata', 'column name')}, '$.${key}') = @${param}`);
            params[param] = typeof value === 'string' ? value : JSON.stringify(value);
          }
        }

        // Tags are a JSON array; require every requested tag to appear in
        // the stored array. We unnest with JSON_QUERY_ARRAY per tag rather
        // than emitting a single contains expression because Spanner JSON
        // has no array-containment operator.
        if (filters.tags != null && filters.tags.length > 0) {
          for (const tag of filters.tags) {
            const param = nextParam();
            conditions.push(
              `EXISTS (SELECT 1 FROM UNNEST(JSON_QUERY_ARRAY(${rAlias}.${quoteIdent('tags', 'column name')})) AS t WHERE JSON_VALUE(t) = @${param})`,
            );
            params[param] = typeof tag === 'string' ? tag : JSON.stringify(tag);
          }
        }

        if (filters.status !== undefined) {
          switch (filters.status) {
            case TraceStatus.ERROR:
              conditions.push(`${rAlias}.${quoteIdent('error', 'column name')} IS NOT NULL`);
              break;
            case TraceStatus.RUNNING:
              conditions.push(
                `${rAlias}.${quoteIdent('endedAt', 'column name')} IS NULL AND ${rAlias}.${quoteIdent('error', 'column name')} IS NULL`,
              );
              break;
            case TraceStatus.SUCCESS:
              conditions.push(
                `${rAlias}.${quoteIdent('endedAt', 'column name')} IS NOT NULL AND ${rAlias}.${quoteIdent('error', 'column name')} IS NULL`,
              );
              break;
          }
        }

        if (filters.hasChildError !== undefined) {
          // Spanner correlated subqueries can reference outer columns via the
          // alias
          const existsClause = `EXISTS (SELECT 1 FROM ${tableName} c WHERE c.${quoteIdent('traceId', 'column name')} = ${rAlias}.${quoteIdent('traceId', 'column name')} AND c.${quoteIdent('error', 'column name')} IS NOT NULL)`;
          conditions.push(filters.hasChildError ? existsClause : `NOT ${existsClause}`);
        }
      }

      const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const orderField = orderBy?.field ?? 'startedAt';
      const sortDirection = (orderBy?.direction ?? 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      // Emulate NULLS FIRST/LAST: Spanner has no syntax for it, so we put a
      // synthetic "is null" expression in front of the real ordering column.
      // For endedAt we want NULLS FIRST on DESC (running traces float to the
      // top when viewing newest) and NULLS LAST on ASC (running traces sink
      // to the bottom when viewing oldest). startedAt is NOT NULL so no
      // emulation is needed there.
      const nullsClause =
        orderField === 'endedAt'
          ? `(${rAlias}.${quoteIdent(orderField, 'column name')} IS NULL) ${sortDirection === 'DESC' ? 'DESC' : 'ASC'}, `
          : '';
      const orderSql = `ORDER BY ${nullsClause}${rAlias}.${quoteIdent(orderField, 'column name')} ${sortDirection}, ${rAlias}.${quoteIdent('spanId', 'column name')} ${sortDirection}`;

      const [countRows] = await this.database.run({
        sql: `SELECT COUNT(*) AS count FROM ${tableName} ${rAlias} ${whereSql}`,
        params,
        types,
        json: true,
      });
      const total = Number((countRows as Array<{ count: number | string }>)[0]?.count ?? 0);

      if (total === 0) {
        return {
          pagination: { total: 0, page, perPage, hasMore: false },
          spans: [],
        };
      }

      const [rows] = await this.database.run({
        sql: `SELECT ${rAlias}.* FROM ${tableName} ${rAlias} ${whereSql} ${orderSql} LIMIT @limit OFFSET @offset`,
        params: { ...params, limit: perPage, offset: page * perPage },
        types: { ...types, limit: 'int64', offset: 'int64' },
        json: true,
      });

      const spans = (rows as Array<Record<string, any>>).map(row =>
        transformFromSpannerRow<SpanRecord>({ tableName: TABLE_SPANS, row }),
      );

      return {
        pagination: {
          total,
          page,
          perPage,
          hasMore: (page + 1) * perPage < total,
        },
        spans: toTraceSpans(spans),
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'LIST_TRACES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
        },
        error,
      );
    }
  }

  async batchDeleteTraces(args: BatchDeleteTracesArgs): Promise<void> {
    try {
      if (args.traceIds.length === 0) return;
      const tableName = quoteIdent(TABLE_SPANS, 'table name');
      const params: Record<string, any> = {};
      const placeholders = args.traceIds.map((id, i) => {
        const name = `t${i}`;
        params[name] = id;
        return `@${name}`;
      });
      await this.db.runDml({
        sql: `DELETE FROM ${tableName} WHERE ${quoteIdent('traceId', 'column name')} IN (${placeholders.join(', ')})`,
        params,
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'BATCH_DELETE_TRACES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
        },
        error,
      );
    }
  }

  override async batchCreateMetrics(args: BatchCreateMetricsArgs): Promise<void> {
    if (this.disableMetrics) throw this.metricsDisabledError('BATCH_CREATE_METRICS');
    return metricsOps.batchCreateMetrics(this.database, args);
  }

  override async listMetrics(args: ListMetricsArgs): Promise<ListMetricsResponse> {
    if (this.disableMetrics) throw this.metricsDisabledError('LIST_METRICS');
    return metricsOps.listMetrics(this.database, args, this.readOptions());
  }

  override async getMetricAggregate(args: GetMetricAggregateArgs): Promise<GetMetricAggregateResponse> {
    if (this.disableMetrics) throw this.metricsDisabledError('GET_METRIC_AGGREGATE');
    return metricsOps.getMetricAggregate(this.database, args, this.readOptions());
  }

  override async getMetricBreakdown(args: GetMetricBreakdownArgs): Promise<GetMetricBreakdownResponse> {
    if (this.disableMetrics) throw this.metricsDisabledError('GET_METRIC_BREAKDOWN');
    return metricsOps.getMetricBreakdown(this.database, args, this.readOptions());
  }

  override async getMetricTimeSeries(args: GetMetricTimeSeriesArgs): Promise<GetMetricTimeSeriesResponse> {
    if (this.disableMetrics) throw this.metricsDisabledError('GET_METRIC_TIME_SERIES');
    return metricsOps.getMetricTimeSeries(this.database, args, this.readOptions());
  }

  override async getMetricPercentiles(args: GetMetricPercentilesArgs): Promise<GetMetricPercentilesResponse> {
    if (this.disableMetrics) throw this.metricsDisabledError('GET_METRIC_PERCENTILES');
    return metricsOps.getMetricPercentiles(this.database, args, this.readOptions());
  }

  override async getMetricNames(args: GetMetricNamesArgs): Promise<GetMetricNamesResponse> {
    if (this.disableMetrics) throw this.metricsDisabledError('GET_METRIC_NAMES');
    return metricsOps.getMetricNames(this.database, args, this.readOptions());
  }

  override async getMetricLabelKeys(args: GetMetricLabelKeysArgs): Promise<GetMetricLabelKeysResponse> {
    if (this.disableMetrics) throw this.metricsDisabledError('GET_METRIC_LABEL_KEYS');
    return metricsOps.getMetricLabelKeys(this.database, args, this.readOptions());
  }

  override async getMetricLabelValues(args: GetMetricLabelValuesArgs): Promise<GetMetricLabelValuesResponse> {
    if (this.disableMetrics) throw this.metricsDisabledError('GET_METRIC_LABEL_VALUES');
    return metricsOps.getMetricLabelValues(this.database, args, this.readOptions());
  }
}
