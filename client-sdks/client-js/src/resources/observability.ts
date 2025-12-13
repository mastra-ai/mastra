import type { ListScoresResponse } from '@mastra/core/evals';
import type {
  TraceRecord,
  ListTracesArgs,
  ListTracesResponse,
  SpanIds,
  PaginationArgs,
  ScoreTracesRequest,
  ScoreTracesResponse,
} from '@mastra/core/storage';
import type { ClientOptions } from '../types';
import { toQueryParams } from '../utils';
import { BaseResource } from './base';

export type ListScoresBySpanParams = SpanIds & PaginationArgs;

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
    return this.request(`/api/observability/traces/${encodeURIComponent(traceId)}`);
  }

  /**
   * Retrieves paginated list of traces with optional filtering and sorting
   * @param params - Parameters for pagination, filtering, and ordering
   * @returns Promise containing paginated traces and pagination info
   */
  getTraces(params: ListTracesArgs = {}): Promise<ListTracesResponse> {
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

  score(params: ScoreTracesRequest): Promise<ScoreTracesResponse> {
    return this.request(`/api/observability/traces/score`, {
      method: 'POST',
      body: { ...params },
    });
  }
}
