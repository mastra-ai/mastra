/**
 * ClickHouse query provider for observability data.
 */

import type { ClickHouseClient } from '@clickhouse/client';
import { createClient } from '@clickhouse/client';

import { TABLE_NAMES } from '../schema/index.js';
import { runMigrations, checkSchemaStatus } from '../schema/migrations.js';
import type {
  QueryProviderConfig,
  TraceQueryOptions,
  SpanQueryOptions,
  LogQueryOptions,
  MetricQueryOptions,
  ScoreQueryOptions,
  PaginationInfo,
  TimeBucket,
  AggregationOptions,
  Trace,
  Span,
  Log,
  Metric,
  Score,
} from '../types.js';

/**
 * Default pagination values
 */
const DEFAULT_PAGE = 0;
const DEFAULT_PER_PAGE = 50;

/**
 * ClickHouseQueryProvider provides read access to observability data.
 * Implements the ObservabilityQueryProvider interface from @mastra/admin.
 */
export class ClickHouseQueryProvider {
  private readonly client: ClickHouseClient;
  private readonly debug: boolean;

  constructor(config: QueryProviderConfig) {
    // Create or use provided ClickHouse client
    if ('client' in config.clickhouse) {
      this.client = config.clickhouse.client;
    } else {
      this.client = createClient({
        url: config.clickhouse.url,
        username: config.clickhouse.username,
        password: config.clickhouse.password,
        database: config.clickhouse.database,
        ...config.clickhouse.options,
        clickhouse_settings: {
          date_time_input_format: 'best_effort',
          date_time_output_format: 'iso',
          use_client_time_zone: 1,
        },
      });
    }

    this.debug = config.debug ?? false;
  }

  /**
   * Initialize the query provider (ensures schema exists).
   */
  async init(): Promise<void> {
    const status = await checkSchemaStatus(this.client);
    if (!status.isInitialized) {
      await runMigrations(this.client);
    }
  }

  // ============================================================
  // Trace Queries
  // ============================================================

  /**
   * List traces with filtering and pagination.
   */
  async listTraces(options: TraceQueryOptions = {}): Promise<{ traces: Trace[]; pagination: PaginationInfo }> {
    const { conditions, params } = this.buildTraceConditions(options);
    const page = options.pagination?.page ?? DEFAULT_PAGE;
    const perPage = options.pagination?.perPage ?? DEFAULT_PER_PAGE;

    // Get total count
    const countQuery = `
      SELECT count() as total
      FROM ${TABLE_NAMES.TRACES} FINAL
      ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
    `;
    const countResult = await this.client.query({
      query: countQuery,
      query_params: params,
      format: 'JSONEachRow',
    });
    const countRows = await countResult.json<{ total: number }>();
    const total = countRows[0]?.total ?? 0;

    // Get paginated results
    const query = `
      SELECT *
      FROM ${TABLE_NAMES.TRACES} FINAL
      ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
      ORDER BY start_time DESC
      LIMIT {limit:UInt32} OFFSET {offset:UInt32}
    `;

    const result = await this.client.query({
      query,
      query_params: { ...params, limit: perPage, offset: page * perPage },
      format: 'JSONEachRow',
    });

    const rows = await result.json<Record<string, unknown>>();
    const traces = rows.map(row => this.transformTrace(row as Record<string, unknown>));

    return {
      traces,
      pagination: {
        total,
        page,
        perPage,
        hasMore: (page + 1) * perPage < total,
      },
    };
  }

  /**
   * Get a single trace by ID.
   */
  async getTrace(traceId: string): Promise<Trace | null> {
    const query = `
      SELECT * FROM ${TABLE_NAMES.TRACES} FINAL
      WHERE trace_id = {traceId:String}
      LIMIT 1
    `;

    const result = await this.client.query({
      query,
      query_params: { traceId },
      format: 'JSONEachRow',
    });

    const rows = await result.json<Record<string, unknown>>();
    const firstRow = rows[0];
    return firstRow ? this.transformTrace(firstRow) : null;
  }

  // ============================================================
  // Span Queries
  // ============================================================

  /**
   * List spans with filtering and pagination.
   */
  async listSpans(options: SpanQueryOptions = {}): Promise<{ spans: Span[]; pagination: PaginationInfo }> {
    const { conditions, params } = this.buildSpanConditions(options);
    const page = options.pagination?.page ?? DEFAULT_PAGE;
    const perPage = options.pagination?.perPage ?? DEFAULT_PER_PAGE;

    // Get total count
    const countQuery = `
      SELECT count() as total
      FROM ${TABLE_NAMES.SPANS} FINAL
      ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
    `;
    const countResult = await this.client.query({
      query: countQuery,
      query_params: params,
      format: 'JSONEachRow',
    });
    const countRows = await countResult.json<{ total: number }>();
    const total = countRows[0]?.total ?? 0;

    // Get paginated results
    const query = `
      SELECT *
      FROM ${TABLE_NAMES.SPANS} FINAL
      ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
      ORDER BY start_time DESC
      LIMIT {limit:UInt32} OFFSET {offset:UInt32}
    `;

    const result = await this.client.query({
      query,
      query_params: { ...params, limit: perPage, offset: page * perPage },
      format: 'JSONEachRow',
    });

    const rows = await result.json<Record<string, unknown>>();
    const spans = rows.map(row => this.transformSpan(row as Record<string, unknown>));

    return {
      spans,
      pagination: {
        total,
        page,
        perPage,
        hasMore: (page + 1) * perPage < total,
      },
    };
  }

  /**
   * Get spans for a trace.
   */
  async getSpansForTrace(traceId: string): Promise<Span[]> {
    const query = `
      SELECT * FROM ${TABLE_NAMES.SPANS} FINAL
      WHERE trace_id = {traceId:String}
      ORDER BY start_time ASC
    `;

    const result = await this.client.query({
      query,
      query_params: { traceId },
      format: 'JSONEachRow',
    });

    const rows = await result.json<Record<string, unknown>>();
    return rows.map(row => this.transformSpan(row as Record<string, unknown>));
  }

  // ============================================================
  // Log Queries
  // ============================================================

  /**
   * List logs with filtering and pagination.
   */
  async listLogs(options: LogQueryOptions = {}): Promise<{ logs: Log[]; pagination: PaginationInfo }> {
    const { conditions, params } = this.buildLogConditions(options);
    const page = options.pagination?.page ?? DEFAULT_PAGE;
    const perPage = options.pagination?.perPage ?? DEFAULT_PER_PAGE;

    // Get total count
    const countQuery = `
      SELECT count() as total
      FROM ${TABLE_NAMES.LOGS}
      ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
    `;
    const countResult = await this.client.query({
      query: countQuery,
      query_params: params,
      format: 'JSONEachRow',
    });
    const countRows = await countResult.json<{ total: number }>();
    const total = countRows[0]?.total ?? 0;

    // Get paginated results
    const query = `
      SELECT *
      FROM ${TABLE_NAMES.LOGS}
      ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
      ORDER BY timestamp DESC
      LIMIT {limit:UInt32} OFFSET {offset:UInt32}
    `;

    const result = await this.client.query({
      query,
      query_params: { ...params, limit: perPage, offset: page * perPage },
      format: 'JSONEachRow',
    });

    const rows = await result.json<Record<string, unknown>>();
    const logs = rows.map(row => this.transformLog(row as Record<string, unknown>));

    return {
      logs,
      pagination: {
        total,
        page,
        perPage,
        hasMore: (page + 1) * perPage < total,
      },
    };
  }

  // ============================================================
  // Metric Queries
  // ============================================================

  /**
   * List metrics with filtering and pagination.
   */
  async listMetrics(options: MetricQueryOptions = {}): Promise<{ metrics: Metric[]; pagination: PaginationInfo }> {
    const { conditions, params } = this.buildMetricConditions(options);
    const page = options.pagination?.page ?? DEFAULT_PAGE;
    const perPage = options.pagination?.perPage ?? DEFAULT_PER_PAGE;

    // Get total count
    const countQuery = `
      SELECT count() as total
      FROM ${TABLE_NAMES.METRICS}
      ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
    `;
    const countResult = await this.client.query({
      query: countQuery,
      query_params: params,
      format: 'JSONEachRow',
    });
    const countRows = await countResult.json<{ total: number }>();
    const total = countRows[0]?.total ?? 0;

    // Get paginated results
    const query = `
      SELECT *
      FROM ${TABLE_NAMES.METRICS}
      ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
      ORDER BY timestamp DESC
      LIMIT {limit:UInt32} OFFSET {offset:UInt32}
    `;

    const result = await this.client.query({
      query,
      query_params: { ...params, limit: perPage, offset: page * perPage },
      format: 'JSONEachRow',
    });

    const rows = await result.json<Record<string, unknown>>();
    const metrics = rows.map(row => this.transformMetric(row as Record<string, unknown>));

    return {
      metrics,
      pagination: {
        total,
        page,
        perPage,
        hasMore: (page + 1) * perPage < total,
      },
    };
  }

  // ============================================================
  // Score Queries
  // ============================================================

  /**
   * List scores with filtering and pagination.
   */
  async listScores(options: ScoreQueryOptions = {}): Promise<{ scores: Score[]; pagination: PaginationInfo }> {
    const { conditions, params } = this.buildScoreConditions(options);
    const page = options.pagination?.page ?? DEFAULT_PAGE;
    const perPage = options.pagination?.perPage ?? DEFAULT_PER_PAGE;

    // Get total count
    const countQuery = `
      SELECT count() as total
      FROM ${TABLE_NAMES.SCORES}
      ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
    `;
    const countResult = await this.client.query({
      query: countQuery,
      query_params: params,
      format: 'JSONEachRow',
    });
    const countRows = await countResult.json<{ total: number }>();
    const total = countRows[0]?.total ?? 0;

    // Get paginated results
    const query = `
      SELECT *
      FROM ${TABLE_NAMES.SCORES}
      ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
      ORDER BY timestamp DESC
      LIMIT {limit:UInt32} OFFSET {offset:UInt32}
    `;

    const result = await this.client.query({
      query,
      query_params: { ...params, limit: perPage, offset: page * perPage },
      format: 'JSONEachRow',
    });

    const rows = await result.json<Record<string, unknown>>();
    const scores = rows.map(row => this.transformScore(row as Record<string, unknown>));

    return {
      scores,
      pagination: {
        total,
        page,
        perPage,
        hasMore: (page + 1) * perPage < total,
      },
    };
  }

  // ============================================================
  // Analytics / Aggregation Queries
  // ============================================================

  /**
   * Get trace count over time.
   */
  async getTraceCountTimeSeries(
    options: AggregationOptions & { projectId?: string; deploymentId?: string },
  ): Promise<TimeBucket[]> {
    const conditions: string[] = [];
    const params: Record<string, unknown> = {
      intervalSeconds: options.intervalSeconds,
    };

    if (options.timeRange?.start) {
      conditions.push('start_time >= {startTime:DateTime64(3)}');
      params.startTime = options.timeRange.start.getTime();
    }
    if (options.timeRange?.end) {
      conditions.push('start_time <= {endTime:DateTime64(3)}');
      params.endTime = options.timeRange.end.getTime();
    }
    if (options.projectId) {
      conditions.push('project_id = {projectId:String}');
      params.projectId = options.projectId;
    }
    if (options.deploymentId) {
      conditions.push('deployment_id = {deploymentId:String}');
      params.deploymentId = options.deploymentId;
    }

    const query = `
      SELECT
        toStartOfInterval(start_time, INTERVAL {intervalSeconds:UInt32} SECOND) AS timestamp,
        count() AS count
      FROM ${TABLE_NAMES.TRACES} FINAL
      ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
      GROUP BY timestamp
      ORDER BY timestamp ASC
    `;

    const result = await this.client.query({
      query,
      query_params: params,
      format: 'JSONEachRow',
    });

    const rows = await result.json<{ timestamp: string; count: number }>();
    return rows.map(r => ({
      timestamp: new Date(r.timestamp),
      count: r.count,
    }));
  }

  /**
   * Get error rate over time.
   */
  async getErrorRateTimeSeries(
    options: AggregationOptions & { projectId?: string; deploymentId?: string },
  ): Promise<TimeBucket[]> {
    const conditions: string[] = [];
    const params: Record<string, unknown> = {
      intervalSeconds: options.intervalSeconds,
    };

    if (options.timeRange?.start) {
      conditions.push('start_time >= {startTime:DateTime64(3)}');
      params.startTime = options.timeRange.start.getTime();
    }
    if (options.timeRange?.end) {
      conditions.push('start_time <= {endTime:DateTime64(3)}');
      params.endTime = options.timeRange.end.getTime();
    }
    if (options.projectId) {
      conditions.push('project_id = {projectId:String}');
      params.projectId = options.projectId;
    }
    if (options.deploymentId) {
      conditions.push('deployment_id = {deploymentId:String}');
      params.deploymentId = options.deploymentId;
    }

    const query = `
      SELECT
        toStartOfInterval(start_time, INTERVAL {intervalSeconds:UInt32} SECOND) AS timestamp,
        count() AS count,
        countIf(status = 'error') AS error_count,
        error_count / count AS error_rate
      FROM ${TABLE_NAMES.TRACES} FINAL
      ${conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''}
      GROUP BY timestamp
      ORDER BY timestamp ASC
    `;

    const result = await this.client.query({
      query,
      query_params: params,
      format: 'JSONEachRow',
    });

    const rows = await result.json<{
      timestamp: string;
      count: number;
      error_count: number;
      error_rate: number;
    }>();

    return rows.map(r => ({
      timestamp: new Date(r.timestamp),
      count: r.count,
      values: {
        errorCount: r.error_count,
        errorRate: r.error_rate,
      },
    }));
  }

  // ============================================================
  // Condition Builders
  // ============================================================

  private buildTraceConditions(options: TraceQueryOptions): {
    conditions: string[];
    params: Record<string, unknown>;
  } {
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    if (options.projectId) {
      conditions.push('project_id = {projectId:String}');
      params.projectId = options.projectId;
    }
    if (options.deploymentId) {
      conditions.push('deployment_id = {deploymentId:String}');
      params.deploymentId = options.deploymentId;
    }
    if (options.traceId) {
      conditions.push('trace_id = {traceId:String}');
      params.traceId = options.traceId;
    }
    if (options.status) {
      conditions.push('status = {status:String}');
      params.status = options.status;
    }
    if (options.name) {
      conditions.push('name LIKE {name:String}');
      params.name = `%${options.name}%`;
    }
    if (options.timeRange?.start) {
      conditions.push('start_time >= {startTime:DateTime64(3)}');
      params.startTime = options.timeRange.start.getTime();
    }
    if (options.timeRange?.end) {
      conditions.push('start_time <= {endTime:DateTime64(3)}');
      params.endTime = options.timeRange.end.getTime();
    }

    return { conditions, params };
  }

  private buildSpanConditions(options: SpanQueryOptions): {
    conditions: string[];
    params: Record<string, unknown>;
  } {
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    if (options.projectId) {
      conditions.push('project_id = {projectId:String}');
      params.projectId = options.projectId;
    }
    if (options.deploymentId) {
      conditions.push('deployment_id = {deploymentId:String}');
      params.deploymentId = options.deploymentId;
    }
    if (options.traceId) {
      conditions.push('trace_id = {traceId:String}');
      params.traceId = options.traceId;
    }
    if (options.spanId) {
      conditions.push('span_id = {spanId:String}');
      params.spanId = options.spanId;
    }
    if (options.parentSpanId) {
      conditions.push('parent_span_id = {parentSpanId:String}');
      params.parentSpanId = options.parentSpanId;
    }
    if (options.kind) {
      conditions.push('kind = {kind:String}');
      params.kind = options.kind;
    }
    if (options.name) {
      conditions.push('name LIKE {name:String}');
      params.name = `%${options.name}%`;
    }
    if (options.timeRange?.start) {
      conditions.push('start_time >= {startTime:DateTime64(3)}');
      params.startTime = options.timeRange.start.getTime();
    }
    if (options.timeRange?.end) {
      conditions.push('start_time <= {endTime:DateTime64(3)}');
      params.endTime = options.timeRange.end.getTime();
    }

    return { conditions, params };
  }

  private buildLogConditions(options: LogQueryOptions): {
    conditions: string[];
    params: Record<string, unknown>;
  } {
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    if (options.projectId) {
      conditions.push('project_id = {projectId:String}');
      params.projectId = options.projectId;
    }
    if (options.deploymentId) {
      conditions.push('deployment_id = {deploymentId:String}');
      params.deploymentId = options.deploymentId;
    }
    if (options.level) {
      conditions.push('level = {level:String}');
      params.level = options.level;
    }
    if (options.traceId) {
      conditions.push('trace_id = {traceId:String}');
      params.traceId = options.traceId;
    }
    if (options.spanId) {
      conditions.push('span_id = {spanId:String}');
      params.spanId = options.spanId;
    }
    if (options.message) {
      conditions.push('message LIKE {message:String}');
      params.message = `%${options.message}%`;
    }
    if (options.timeRange?.start) {
      conditions.push('timestamp >= {startTime:DateTime64(3)}');
      params.startTime = options.timeRange.start.getTime();
    }
    if (options.timeRange?.end) {
      conditions.push('timestamp <= {endTime:DateTime64(3)}');
      params.endTime = options.timeRange.end.getTime();
    }

    return { conditions, params };
  }

  private buildMetricConditions(options: MetricQueryOptions): {
    conditions: string[];
    params: Record<string, unknown>;
  } {
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    if (options.projectId) {
      conditions.push('project_id = {projectId:String}');
      params.projectId = options.projectId;
    }
    if (options.deploymentId) {
      conditions.push('deployment_id = {deploymentId:String}');
      params.deploymentId = options.deploymentId;
    }
    if (options.name) {
      conditions.push('name = {name:String}');
      params.name = options.name;
    }
    if (options.type) {
      conditions.push('type = {type:String}');
      params.type = options.type;
    }
    if (options.timeRange?.start) {
      conditions.push('timestamp >= {startTime:DateTime64(3)}');
      params.startTime = options.timeRange.start.getTime();
    }
    if (options.timeRange?.end) {
      conditions.push('timestamp <= {endTime:DateTime64(3)}');
      params.endTime = options.timeRange.end.getTime();
    }

    return { conditions, params };
  }

  private buildScoreConditions(options: ScoreQueryOptions): {
    conditions: string[];
    params: Record<string, unknown>;
  } {
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    if (options.projectId) {
      conditions.push('project_id = {projectId:String}');
      params.projectId = options.projectId;
    }
    if (options.deploymentId) {
      conditions.push('deployment_id = {deploymentId:String}');
      params.deploymentId = options.deploymentId;
    }
    if (options.name) {
      conditions.push('name = {name:String}');
      params.name = options.name;
    }
    if (options.traceId) {
      conditions.push('trace_id = {traceId:String}');
      params.traceId = options.traceId;
    }
    if (options.minValue !== undefined) {
      conditions.push('value >= {minValue:Float64}');
      params.minValue = options.minValue;
    }
    if (options.maxValue !== undefined) {
      conditions.push('value <= {maxValue:Float64}');
      params.maxValue = options.maxValue;
    }
    if (options.timeRange?.start) {
      conditions.push('timestamp >= {startTime:DateTime64(3)}');
      params.startTime = options.timeRange.start.getTime();
    }
    if (options.timeRange?.end) {
      conditions.push('timestamp <= {endTime:DateTime64(3)}');
      params.endTime = options.timeRange.end.getTime();
    }

    return { conditions, params };
  }

  // ============================================================
  // Transform Functions
  // ============================================================

  private transformTrace(row: Record<string, unknown>): Trace {
    return {
      traceId: row.trace_id as string,
      projectId: row.project_id as string,
      deploymentId: row.deployment_id as string,
      name: row.name as string,
      status: row.status as 'ok' | 'error' | 'unset',
      startTime: new Date(row.start_time as string),
      endTime: row.end_time ? new Date(row.end_time as string) : null,
      durationMs: row.duration_ms as number | null,
      metadata: row.metadata ? JSON.parse(row.metadata as string) : {},
    };
  }

  private transformSpan(row: Record<string, unknown>): Span {
    return {
      spanId: row.span_id as string,
      traceId: row.trace_id as string,
      parentSpanId: (row.parent_span_id as string) || null,
      projectId: row.project_id as string,
      deploymentId: row.deployment_id as string,
      name: row.name as string,
      kind: row.kind as 'internal' | 'server' | 'client' | 'producer' | 'consumer',
      status: row.status as 'ok' | 'error' | 'unset',
      startTime: new Date(row.start_time as string),
      endTime: row.end_time ? new Date(row.end_time as string) : null,
      durationMs: row.duration_ms as number | null,
      attributes: row.attributes ? JSON.parse(row.attributes as string) : {},
      events: row.events ? JSON.parse(row.events as string) : [],
    };
  }

  private transformLog(row: Record<string, unknown>): Log {
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      deploymentId: row.deployment_id as string,
      traceId: (row.trace_id as string) || null,
      spanId: (row.span_id as string) || null,
      level: row.level as 'debug' | 'info' | 'warn' | 'error',
      message: row.message as string,
      timestamp: new Date(row.timestamp as string),
      attributes: row.attributes ? JSON.parse(row.attributes as string) : {},
    };
  }

  private transformMetric(row: Record<string, unknown>): Metric {
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      deploymentId: row.deployment_id as string,
      name: row.name as string,
      type: row.type as 'counter' | 'gauge' | 'histogram',
      value: row.value as number,
      unit: (row.unit as string) || null,
      timestamp: new Date(row.timestamp as string),
      labels: row.labels ? JSON.parse(row.labels as string) : {},
    };
  }

  private transformScore(row: Record<string, unknown>): Score {
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      deploymentId: row.deployment_id as string,
      traceId: (row.trace_id as string) || null,
      name: row.name as string,
      value: row.value as number,
      normalizedValue: row.normalized_value as number | null,
      comment: (row.comment as string) || null,
      timestamp: new Date(row.timestamp as string),
      metadata: row.metadata ? JSON.parse(row.metadata as string) : {},
    };
  }
}
