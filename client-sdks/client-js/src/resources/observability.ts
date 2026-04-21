import type { ListScoresResponse, Trajectory } from '@mastra/core/evals';
import type { SpanType } from '@mastra/core/observability';
import type {
  TraceRecord,
  GetTraceLightResponse,
  GetSpanResponse,
  ListTracesArgs,
  ListTracesResponse,
  SpanIds,
  PaginationArgs,
  SpanRecord,
  PaginationInfo,
  ScoreTracesRequest,
  ScoreTracesResponse,
  // Logs
  ListLogsArgs,
  ListLogsResponse,
  // Scores (observability)
  ListScoresArgs,
  ListScoresResponse as ListScoresResponseNew,
  CreateScoreBody,
  CreateScoreResponse,
  GetScoreAggregateArgs,
  GetScoreAggregateResponse,
  GetScoreBreakdownArgs,
  GetScoreBreakdownResponse,
  GetScoreTimeSeriesArgs,
  GetScoreTimeSeriesResponse,
  GetScorePercentilesArgs,
  GetScorePercentilesResponse,
  // Feedback
  ListFeedbackArgs,
  ListFeedbackResponse,
  CreateFeedbackBody,
  CreateFeedbackResponse,
  GetFeedbackAggregateArgs,
  GetFeedbackAggregateResponse,
  GetFeedbackBreakdownArgs,
  GetFeedbackBreakdownResponse,
  GetFeedbackTimeSeriesArgs,
  GetFeedbackTimeSeriesResponse,
  GetFeedbackPercentilesArgs,
  GetFeedbackPercentilesResponse,
  // Metrics OLAP
  GetMetricAggregateArgs,
  GetMetricAggregateResponse,
  GetMetricBreakdownArgs,
  GetMetricBreakdownResponse,
  GetMetricTimeSeriesArgs,
  GetMetricTimeSeriesResponse,
  GetMetricPercentilesArgs,
  GetMetricPercentilesResponse,
  // Discovery
  GetMetricNamesArgs,
  GetMetricNamesResponse,
  GetMetricLabelKeysArgs,
  GetMetricLabelKeysResponse,
  GetMetricLabelValuesArgs,
  GetMetricLabelValuesResponse,
  GetEntityTypesResponse,
  GetEntityNamesArgs,
  GetEntityNamesResponse,
  GetServiceNamesResponse,
  GetEnvironmentsResponse,
  GetTagsArgs,
  GetTagsResponse,
} from '@mastra/core/storage';
import type { ClientOptions } from '../types';
import { toQueryParams } from '../utils';
import { BaseResource } from './base';

// ============================================================================
// Legacy Types (for backward compatibility with main branch API)
// ============================================================================

/**
 * Legacy pagination arguments from main branch.
 * @deprecated Use ListTracesArgs instead with the new listTraces() method.
 */
export interface LegacyPaginationArgs {
  dateRange?: {
    start?: Date;
    end?: Date;
  };
  page?: number;
  perPage?: number;
}

/**
 * Legacy traces query parameters from main branch.
 * @deprecated Use ListTracesArgs instead with the new listTraces() method.
 */
export interface LegacyTracesPaginatedArg {
  filters?: {
    name?: string;
    spanType?: SpanType;
    entityId?: string;
    entityType?: 'agent' | 'workflow';
  };
  pagination?: LegacyPaginationArgs;
}

/**
 * Legacy response type from main branch.
 * @deprecated Use ListTracesResponse instead.
 */
export interface LegacyGetTracesResponse {
  spans: SpanRecord[];
  pagination: PaginationInfo;
}

export type ListScoresBySpanParams = SpanIds & PaginationArgs;

// ============================================================================
// Observability Resource
// ============================================================================

/** Client resource for interacting with the Mastra observability API (traces, logs, scores, feedback, and metrics). */
export class Observability extends BaseResource {
  constructor(options: ClientOptions) {
    super(options);
  }

  // --------------------------------------------------------------------------
  // Traces
  // --------------------------------------------------------------------------

  /**
   * Retrieves a specific trace by ID
   * @param traceId - ID of the trace to retrieve
   * @returns Promise containing the trace with all its spans
   */
  getTrace(traceId: string): Promise<TraceRecord> {
    return this.request(`/observability/traces/${traceId}`);
  }

  /**
   * Retrieves a lightweight trace by ID (timeline fields only).
   * Excludes heavy fields (input, output, attributes, metadata, tags, links)
   * for ~97% payload reduction compared to getTrace.
   *
   * @param traceId - ID of the trace to retrieve
   * @returns Promise containing the trace with lightweight spans
   */
  getTraceLight(traceId: string): Promise<GetTraceLightResponse> {
    return this.request(`/observability/traces/${traceId}/light`);
  }

  /**
   * Retrieves a single span with full details by trace ID and span ID.
   *
   * @param traceId - ID of the trace containing the span
   * @param spanId - ID of the span to retrieve
   * @returns Promise containing the full span record
   */
  getSpan(traceId: string, spanId: string): Promise<GetSpanResponse> {
    return this.request(`/observability/traces/${traceId}/spans/${spanId}`);
  }

  /**
   * Extracts a structured trajectory from a trace's spans.
   *
   * @param traceId - ID of the trace to extract trajectory from
   * @returns Promise containing the trajectory with ordered steps
   */
  getTraceTrajectory(traceId: string): Promise<Trajectory> {
    return this.request(`/observability/traces/${traceId}/trajectory`);
  }

  /**
   * Retrieves paginated list of traces with optional filtering.
   * This is the legacy API preserved for backward compatibility.
   *
   * @param params - Parameters for pagination and filtering (legacy format)
   * @returns Promise containing paginated traces and pagination info
   * @deprecated Use {@link listTraces} instead for new features like ordering and more filters.
   */
  getTraces(params: LegacyTracesPaginatedArg): Promise<LegacyGetTracesResponse> {
    const { pagination, filters } = params;
    const { page, perPage, dateRange } = pagination || {};
    const { name, spanType, entityId, entityType } = filters || {};
    const searchParams = new URLSearchParams();

    if (page !== undefined) {
      searchParams.set('page', String(page));
    }
    if (perPage !== undefined) {
      searchParams.set('perPage', String(perPage));
    }
    if (name) {
      searchParams.set('name', name);
    }
    if (spanType !== undefined) {
      searchParams.set('spanType', String(spanType));
    }
    if (entityId && entityType) {
      searchParams.set('entityId', entityId);
      searchParams.set('entityType', entityType);
    }

    if (dateRange) {
      const dateRangeStr = JSON.stringify({
        start: dateRange.start instanceof Date ? dateRange.start.toISOString() : dateRange.start,
        end: dateRange.end instanceof Date ? dateRange.end.toISOString() : dateRange.end,
      });
      searchParams.set('dateRange', dateRangeStr);
    }

    const queryString = searchParams.toString();
    return this.request(`/observability/traces${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Retrieves paginated list of traces with optional filtering and sorting.
   * This is the new API with improved filtering options.
   *
   * @param params - Parameters for pagination, filtering, and ordering
   * @returns Promise containing paginated traces and pagination info
   */
  listTraces(params: ListTracesArgs = {}): Promise<ListTracesResponse> {
    const queryString = toQueryParams(params, ['filters', 'pagination', 'orderBy']);
    return this.request(`/observability/traces${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Retrieves scores by trace ID and span ID
   * @param params - Parameters containing trace ID, span ID, and pagination options
   * @returns Promise containing scores and pagination info
   */
  listScoresBySpan(params: ListScoresBySpanParams): Promise<ListScoresResponse> {
    const { traceId, spanId, ...pagination } = params;
    const queryString = toQueryParams(pagination);
    return this.request(
      `/observability/traces/${encodeURIComponent(traceId)}/${encodeURIComponent(spanId)}/scores${queryString ? `?${queryString}` : ''}`,
    );
  }

  /**
   * Scores one or more traces using a specified scorer.
   * @param params - Scorer name and targets to score
   * @returns Promise containing the scoring status
   */
  score(params: ScoreTracesRequest): Promise<ScoreTracesResponse> {
    return this.request(`/observability/traces/score`, {
      method: 'POST',
      body: { ...params },
    });
  }

  // --------------------------------------------------------------------------
  // Logs
  // --------------------------------------------------------------------------

  /**
   * Retrieves a paginated list of logs with optional filtering and sorting.
   */
  listLogs(params: ListLogsArgs = {}): Promise<ListLogsResponse> {
    const queryString = toQueryParams(params, ['filters', 'pagination', 'orderBy']);
    return this.request(`/observability/logs${queryString ? `?${queryString}` : ''}`);
  }

  // --------------------------------------------------------------------------
  // Scores (observability storage)
  // --------------------------------------------------------------------------

  /**
   * Retrieves a paginated list of scores with optional filtering and sorting.
   */
  listScores(params: ListScoresArgs = {}): Promise<ListScoresResponseNew> {
    const queryString = toQueryParams(params, ['filters', 'pagination', 'orderBy']);
    return this.request(`/observability/scores${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Creates a single score record in the observability store.
   * Timestamp is set server-side.
   */
  createScore(params: CreateScoreBody): Promise<CreateScoreResponse> {
    return this.request(`/observability/scores`, {
      method: 'POST',
      body: params,
    });
  }

  /**
   * Returns an aggregated score value with optional period-over-period comparison.
   */
  getScoreAggregate(params: GetScoreAggregateArgs): Promise<GetScoreAggregateResponse> {
    return this.request(`/observability/scores/aggregate`, {
      method: 'POST',
      body: params,
    });
  }

  /**
   * Returns score values grouped by specified dimensions.
   */
  getScoreBreakdown(params: GetScoreBreakdownArgs): Promise<GetScoreBreakdownResponse> {
    return this.request(`/observability/scores/breakdown`, {
      method: 'POST',
      body: params,
    });
  }

  /**
   * Returns score values bucketed by time interval with optional grouping.
   */
  getScoreTimeSeries(params: GetScoreTimeSeriesArgs): Promise<GetScoreTimeSeriesResponse> {
    return this.request(`/observability/scores/timeseries`, {
      method: 'POST',
      body: params,
    });
  }

  /**
   * Returns percentile values for scores bucketed by time interval.
   */
  getScorePercentiles(params: GetScorePercentilesArgs): Promise<GetScorePercentilesResponse> {
    return this.request(`/observability/scores/percentiles`, {
      method: 'POST',
      body: params,
    });
  }

  // --------------------------------------------------------------------------
  // Feedback
  // --------------------------------------------------------------------------

  /**
   * Retrieves a paginated list of feedback with optional filtering and sorting.
   */
  listFeedback(params: ListFeedbackArgs = {}): Promise<ListFeedbackResponse> {
    const queryString = toQueryParams(params, ['filters', 'pagination', 'orderBy']);
    return this.request(`/observability/feedback${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Creates a single feedback record in the observability store.
   * Timestamp is set server-side.
   */
  createFeedback(params: CreateFeedbackBody): Promise<CreateFeedbackResponse> {
    return this.request(`/observability/feedback`, {
      method: 'POST',
      body: params,
    });
  }

  /**
   * Returns an aggregated feedback value with optional period-over-period comparison.
   */
  getFeedbackAggregate(params: GetFeedbackAggregateArgs): Promise<GetFeedbackAggregateResponse> {
    return this.request(`/observability/feedback/aggregate`, {
      method: 'POST',
      body: params,
    });
  }

  /**
   * Returns feedback values grouped by specified dimensions.
   */
  getFeedbackBreakdown(params: GetFeedbackBreakdownArgs): Promise<GetFeedbackBreakdownResponse> {
    return this.request(`/observability/feedback/breakdown`, {
      method: 'POST',
      body: params,
    });
  }

  /**
   * Returns feedback values bucketed by time interval with optional grouping.
   */
  getFeedbackTimeSeries(params: GetFeedbackTimeSeriesArgs): Promise<GetFeedbackTimeSeriesResponse> {
    return this.request(`/observability/feedback/timeseries`, {
      method: 'POST',
      body: params,
    });
  }

  /**
   * Returns percentile values for feedback bucketed by time interval.
   */
  getFeedbackPercentiles(params: GetFeedbackPercentilesArgs): Promise<GetFeedbackPercentilesResponse> {
    return this.request(`/observability/feedback/percentiles`, {
      method: 'POST',
      body: params,
    });
  }

  // --------------------------------------------------------------------------
  // Metrics OLAP
  // --------------------------------------------------------------------------

  /**
   * Returns an aggregated metric value with optional period-over-period comparison.
   */
  getMetricAggregate(params: GetMetricAggregateArgs): Promise<GetMetricAggregateResponse> {
    return this.request(`/observability/metrics/aggregate`, {
      method: 'POST',
      body: params,
    });
  }

  /**
   * Returns metric values grouped by specified dimensions.
   */
  getMetricBreakdown(params: GetMetricBreakdownArgs): Promise<GetMetricBreakdownResponse> {
    return this.request(`/observability/metrics/breakdown`, {
      method: 'POST',
      body: params,
    });
  }

  /**
   * Returns metric values bucketed by time interval with optional grouping.
   */
  getMetricTimeSeries(params: GetMetricTimeSeriesArgs): Promise<GetMetricTimeSeriesResponse> {
    return this.request(`/observability/metrics/timeseries`, {
      method: 'POST',
      body: params,
    });
  }

  /**
   * Returns percentile values for a metric bucketed by time interval.
   */
  getMetricPercentiles(params: GetMetricPercentilesArgs): Promise<GetMetricPercentilesResponse> {
    return this.request(`/observability/metrics/percentiles`, {
      method: 'POST',
      body: params,
    });
  }

  // --------------------------------------------------------------------------
  // Discovery
  // --------------------------------------------------------------------------

  /**
   * Returns distinct metric names with optional prefix filtering.
   */
  getMetricNames(params: GetMetricNamesArgs = {}): Promise<GetMetricNamesResponse> {
    const queryString = toQueryParams(params);
    return this.request(`/observability/discovery/metric-names${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Returns distinct label keys for a given metric.
   */
  getMetricLabelKeys(params: GetMetricLabelKeysArgs): Promise<GetMetricLabelKeysResponse> {
    const queryString = toQueryParams(params);
    return this.request(`/observability/discovery/metric-label-keys${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Returns distinct values for a given metric label key.
   */
  getMetricLabelValues(params: GetMetricLabelValuesArgs): Promise<GetMetricLabelValuesResponse> {
    const queryString = toQueryParams(params);
    return this.request(`/observability/discovery/metric-label-values${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Returns distinct entity types from observability data.
   */
  getEntityTypes(): Promise<GetEntityTypesResponse> {
    return this.request(`/observability/discovery/entity-types`);
  }

  /**
   * Returns distinct entity names with optional type filtering.
   */
  getEntityNames(params: GetEntityNamesArgs = {}): Promise<GetEntityNamesResponse> {
    const queryString = toQueryParams(params);
    return this.request(`/observability/discovery/entity-names${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Returns distinct service names from observability data.
   */
  getServiceNames(): Promise<GetServiceNamesResponse> {
    return this.request(`/observability/discovery/service-names`);
  }

  /**
   * Returns distinct environments from observability data.
   */
  getEnvironments(): Promise<GetEnvironmentsResponse> {
    return this.request(`/observability/discovery/environments`);
  }

  /**
   * Returns distinct tags with optional entity type filtering.
   */
  getTags(params: GetTagsArgs = {}): Promise<GetTagsResponse> {
    const queryString = toQueryParams(params);
    return this.request(`/observability/discovery/tags${queryString ? `?${queryString}` : ''}`);
  }
}
