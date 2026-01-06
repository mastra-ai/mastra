import type { ListScoresResponse } from '@mastra/core/evals';
import type { SpanType } from '@mastra/core/observability';
import type {
  TraceRecord,
  ListTracesArgs,
  ListTracesResponse,
  SpanIds,
  PaginationArgs,
  SpanRecord,
  PaginationInfo,
  ScoreTracesRequest,
  ScoreTracesResponse,
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

export class Observability extends BaseResource {
  constructor(options: ClientOptions) {
    super(options);
  }

  /**
   * Retrieves a specific trace by ID
   * @param traceId - ID of the trace to retrieve
   * @returns Promise containing the trace with all its spans
   */
  getTrace(traceId: string): Promise<TraceRecord> {
    return this.request(`/api/observability/traces/${traceId}`);
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
    return this.request(`/api/observability/traces${queryString ? `?${queryString}` : ''}`);
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
    return this.request(`/api/observability/traces${queryString ? `?${queryString}` : ''}`);
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
      `/api/observability/traces/${encodeURIComponent(traceId)}/${encodeURIComponent(spanId)}/scores${queryString ? `?${queryString}` : ''}`,
    );
  }

  /**
   * Scores one or more traces using a specified scorer.
   * @param params - Scorer name and targets to score
   * @returns Promise containing the scoring status
   */
  score(params: ScoreTracesRequest): Promise<ScoreTracesResponse> {
    return this.request(`/api/observability/traces/score`, {
      method: 'POST',
      body: { ...params },
    });
  }
}
