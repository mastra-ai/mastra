import type { TraceRecord, TracesPaginatedArg } from '@mastra/core/storage';
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
   * @param params - Parameters for pagination and filtering
   * @returns Promise containing paginated traces and pagination info
   */
  getTraces(params: TracesPaginatedArg): Promise<GetTracesResponse> {
    const { pagination, filters } = params;
    const { page, perPage, dateRange } = pagination || {};
    const {
      spanType,
      entityId,
      entityType,
      entityName,
      status,
      tags,
      userId,
      organizationId,
      resourceId,
      runId,
      sessionId,
      threadId,
      requestId,
      environment,
      source,
      serviceName,
      deploymentId,
      metadata,
      scope,
      versionInfo,
    } = filters || {};
    const searchParams = new URLSearchParams();

    if (page !== undefined) {
      searchParams.set('page', String(page));
    }
    if (perPage !== undefined) {
      searchParams.set('perPage', String(perPage));
    }
    if (spanType !== undefined) {
      searchParams.set('spanType', String(spanType));
    }
    if (entityId) {
      searchParams.set('entityId', entityId);
    }
    if (entityType) {
      searchParams.set('entityType', entityType);
    }
    if (entityName) {
      searchParams.set('entityName', entityName);
    }
    if (status) {
      searchParams.set('status', status);
    }
    if (tags && tags.length > 0) {
      searchParams.set('tags', tags.join(','));
    }
    // Identity & Tenancy
    if (userId) {
      searchParams.set('userId', userId);
    }
    if (organizationId) {
      searchParams.set('organizationId', organizationId);
    }
    if (resourceId) {
      searchParams.set('resourceId', resourceId);
    }
    // Correlation IDs
    if (runId) {
      searchParams.set('runId', runId);
    }
    if (sessionId) {
      searchParams.set('sessionId', sessionId);
    }
    if (threadId) {
      searchParams.set('threadId', threadId);
    }
    if (requestId) {
      searchParams.set('requestId', requestId);
    }
    // Deployment context
    if (environment) {
      searchParams.set('environment', environment);
    }
    if (source) {
      searchParams.set('source', source);
    }
    if (serviceName) {
      searchParams.set('serviceName', serviceName);
    }
    if (deploymentId) {
      searchParams.set('deploymentId', deploymentId);
    }
    // JSONB filters
    if (metadata) {
      searchParams.set('metadata', JSON.stringify(metadata));
    }
    if (scope) {
      searchParams.set('scope', JSON.stringify(scope));
    }
    if (versionInfo) {
      searchParams.set('versionInfo', JSON.stringify(versionInfo));
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
