import type { AISpanType } from '@mastra/core/ai-tracing';
import type { AISpanRecord, AITrace } from '@mastra/core/storage';
import type { ClientOptions } from '../types';
import { BaseResource } from './base';

export class Observability extends BaseResource {
  constructor(options: ClientOptions) {
    super(options);
  }

  /**
   * Retrieves a specific AI trace by ID
   * @param traceId - ID of the trace to retrieve
   * @returns Promise containing the AI trace with all its spans
   */
  getTrace(traceId: string): Promise<AITrace> {
    return this.request(`/api/observability/traces/${traceId}`);
  }

  /**
   * Retrieves paginated list of AI traces with optional filtering
   * @param params - Parameters for pagination and filtering
   * @returns Promise containing paginated traces and pagination info
   */
  getTraces(params?: {
    page?: number;
    perPage?: number;
    name?: string;
    spanType?: AISpanType;
    dateRange?: {
      start?: string | Date;
      end?: string | Date;
    };
    attributes?: Record<string, any>;
  }): Promise<{
    spans: AISpanRecord[];
    total: number;
    page: number;
    perPage: number;
    hasMore: boolean;
  }> {
    const { page, perPage, name, spanType, dateRange, attributes } = params || {};
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
    if (dateRange) {
      const dateRangeStr = JSON.stringify({
        start: dateRange.start instanceof Date ? dateRange.start.toISOString() : dateRange.start,
        end: dateRange.end instanceof Date ? dateRange.end.toISOString() : dateRange.end,
      });
      searchParams.set('dateRange', dateRangeStr);
    }
    if (attributes) {
      searchParams.set('attributes', JSON.stringify(attributes));
    }

    const queryString = searchParams.toString();
    return this.request(`/api/observability/traces${queryString ? `?${queryString}` : ''}`);
  }
}
