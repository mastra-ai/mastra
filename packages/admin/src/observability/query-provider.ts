import type { Log, Metric, Score, Span, Trace } from './types';

/**
 * Time range filter for queries.
 */
export interface TimeRange {
  start: Date;
  end: Date;
}

/**
 * Pagination for query results.
 */
export interface QueryPagination {
  limit?: number;
  offset?: number;
}

/**
 * Trace query filters.
 */
export interface TraceQueryFilter {
  projectId?: string;
  deploymentId?: string;
  status?: 'ok' | 'error' | 'unset';
  timeRange?: TimeRange;
  minDurationMs?: number;
  maxDurationMs?: number;
}

/**
 * Span query filters.
 */
export interface SpanQueryFilter {
  projectId?: string;
  deploymentId?: string;
  traceId?: string;
  parentSpanId?: string | null;
  kind?: Span['kind'];
  status?: 'ok' | 'error' | 'unset';
  timeRange?: TimeRange;
}

/**
 * Log query filters.
 */
export interface LogQueryFilter {
  projectId?: string;
  deploymentId?: string;
  traceId?: string;
  level?: Log['level'] | Log['level'][];
  messageContains?: string;
  timeRange?: TimeRange;
}

/**
 * Metric query filters.
 */
export interface MetricQueryFilter {
  projectId?: string;
  deploymentId?: string;
  name?: string;
  type?: Metric['type'];
  labels?: Record<string, string>;
  timeRange?: TimeRange;
}

/**
 * Score query filters.
 */
export interface ScoreQueryFilter {
  projectId?: string;
  deploymentId?: string;
  traceId?: string;
  name?: string;
  minValue?: number;
  maxValue?: number;
  timeRange?: TimeRange;
}

/**
 * Aggregation result for metrics.
 */
export interface MetricAggregation {
  name: string;
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
  p50: number;
  p90: number;
  p99: number;
}

/**
 * Abstract interface for querying observability data.
 * Implementation: ClickHouseQueryProvider (observability/clickhouse/)
 */
export interface ObservabilityQueryProvider {
  // ============================================================================
  // Trace Queries
  // ============================================================================

  getTrace(traceId: string): Promise<Trace | null>;
  listTraces(filter: TraceQueryFilter, pagination?: QueryPagination): Promise<{ traces: Trace[]; total: number }>;
  getTraceSpans(traceId: string): Promise<Span[]>;

  // ============================================================================
  // Span Queries
  // ============================================================================

  getSpan(spanId: string): Promise<Span | null>;
  listSpans(filter: SpanQueryFilter, pagination?: QueryPagination): Promise<{ spans: Span[]; total: number }>;

  // ============================================================================
  // Log Queries
  // ============================================================================

  listLogs(filter: LogQueryFilter, pagination?: QueryPagination): Promise<{ logs: Log[]; total: number }>;
  searchLogs(query: string, filter: LogQueryFilter, pagination?: QueryPagination): Promise<{ logs: Log[]; total: number }>;

  // ============================================================================
  // Metric Queries
  // ============================================================================

  listMetrics(filter: MetricQueryFilter, pagination?: QueryPagination): Promise<{ metrics: Metric[]; total: number }>;
  aggregateMetrics(filter: MetricQueryFilter, groupBy?: string[]): Promise<MetricAggregation[]>;
  getMetricTimeSeries(name: string, filter: MetricQueryFilter, intervalMs: number): Promise<{ timestamp: Date; value: number }[]>;

  // ============================================================================
  // Score Queries
  // ============================================================================

  listScores(filter: ScoreQueryFilter, pagination?: QueryPagination): Promise<{ scores: Score[]; total: number }>;
  aggregateScores(filter: ScoreQueryFilter, groupBy?: string[]): Promise<{ name: string; avg: number; count: number }[]>;
}
