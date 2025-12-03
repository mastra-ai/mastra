import { serializeTracesParams, type TraceRecord, type TracesPaginatedArg } from '@mastra/core/storage';
import type { ClientOptions, GetTracesResponse, ListScoresBySpanParams, ListScoresResponse } from '../types';
import { BaseResource } from './base';

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
   * Retrieves paginated list of traces with optional filtering
   *
   * Uses the shared serializeTracesParams from @mastra/core/storage for
   * consistent query param serialization with the server. Uses qs bracket notation:
   * - pagination[page], pagination[perPage]
   * - filters[dateRange][start], filters[dateRange][end]
   * - filters[tags][0], filters[tags][1], ...
   * - filters[metadata][key]
   * - filters[hasChildError]
   *
   * @param params - Parameters for pagination and filtering
   * @returns Promise containing paginated traces and pagination info
   */
  getTraces(params: TracesPaginatedArg = {}): Promise<GetTracesResponse> {
    // Use the shared utility to serialize params to qs bracket notation
    const queryString = serializeTracesParams(params);
    return this.request(`/api/observability/traces${queryString ? `?${queryString}` : ''}`);
  }

  /**
   * Retrieves scores by trace ID and span ID
   * @param params - Parameters containing trace ID, span ID, and pagination options
   * @returns Promise containing scores and pagination info
   */
  public listScoresBySpan(params: ListScoresBySpanParams): Promise<ListScoresResponse> {
    const { traceId, spanId, page, perPage } = params;
    const searchParams = new URLSearchParams();

    if (page !== undefined) {
      searchParams.set('page', String(page));
    }
    if (perPage !== undefined) {
      searchParams.set('perPage', String(perPage));
    }

    const queryString = searchParams.toString();
    return this.request(
      `/api/observability/traces/${encodeURIComponent(traceId)}/${encodeURIComponent(spanId)}/scores${queryString ? `?${queryString}` : ''}`,
    );
  }

  score(params: {
    scorerName: string;
    targets: Array<{ traceId: string; spanId?: string }>;
  }): Promise<{ status: string; message: string }> {
    return this.request(`/api/observability/traces/score`, {
      method: 'POST',
      body: { ...params },
    });
  }
}
