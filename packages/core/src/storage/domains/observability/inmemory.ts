import type { TracingStrategy } from '../../../ai-tracing';
import { ErrorCategory, ErrorDomain, MastraError } from '../../../error';
import type { AISpanRecord, AITraceRecord, AITracesPaginatedArg, PaginationInfo } from '../../types';
import type { StoreOperations } from '../operations';
import { ObservabilityStorage } from './base';

export type InMemoryObservability = Map<string, AISpanRecord>;
export class ObservabilityInMemory extends ObservabilityStorage {
  operations: StoreOperations;
  collection: InMemoryObservability;

  constructor({ collection, operations }: { collection: InMemoryObservability; operations: StoreOperations }) {
    super();
    this.collection = collection;
    this.operations = operations;
  }

  public get aiTracingStrategy(): {
    preferred: TracingStrategy;
    supported: TracingStrategy[];
  } {
    return {
      preferred: 'realtime',
      supported: ['realtime', 'batch-with-updates', 'insert-only'],
    };
  }

  async createAISpan(span: AISpanRecord): Promise<void> {
    this.validateCreateAISpan(span);
    const id = this.generateId(span);
    this.collection.set(id, span);
  }

  private validateCreateAISpan(record: AISpanRecord): void {
    if (!record.spanId) {
      throw new MastraError({
        id: 'OBSERVABILITY_SPAN_ID_REQUIRED',
        domain: ErrorDomain.MASTRA_OBSERVABILITY,
        category: ErrorCategory.SYSTEM,
        text: 'Span ID is required for creating a span',
      });
    }

    if (!record.traceId) {
      throw new MastraError({
        id: 'OBSERVABILITY_TRACE_ID_REQUIRED',
        domain: ErrorDomain.MASTRA_OBSERVABILITY,
        category: ErrorCategory.SYSTEM,
        text: 'Trace ID is required for creating a span',
      });
    }
  }

  private generateId({ traceId, spanId }: { traceId: string; spanId: string }): string {
    return `${traceId}-${spanId}`;
  }

  async getAITrace(traceId: string): Promise<AITraceRecord | null> {
    const spans = Array.from(this.collection.values()).filter(span => span.traceId === traceId);
    if (spans.length === 0) {
      return null;
    }
    spans.sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());

    return {
      traceId,
      spans,
    };
  }

  async getAITracesPaginated({
    filters,
    pagination,
  }: AITracesPaginatedArg): Promise<{ pagination: PaginationInfo; spans: AISpanRecord[] }> {
    const allRootSpans = this.filterForRootSpans(Array.from(this.collection.values()));
    const filteredRootSpans = this.filterSpansByFilter(allRootSpans, filters);

    const startDate = pagination?.dateRange?.start;
    const endDate = pagination?.dateRange?.end;
    const filteredRootSpansByDate = this.filterSpansByDate(filteredRootSpans, startDate, endDate);

    const total = filteredRootSpansByDate.length;
    const page = pagination?.page ?? 0;
    const perPage = pagination?.perPage ?? 10;

    const start = page * perPage;
    const end = start + perPage;
    const paged = this.filterSpansByPagination(filteredRootSpansByDate, pagination);

    return {
      spans: paged,
      pagination: { total, page, perPage, hasMore: end < total },
    };
  }

  private filterForRootSpans(spans: AISpanRecord[]): AISpanRecord[] {
    return spans.filter(span => span.parentSpanId === null);
  }

  private filterSpansByDate(
    spans: AISpanRecord[],
    startDate: Date | undefined,
    endDate: Date | undefined,
  ): AISpanRecord[] {
    return spans.filter(span => {
      if (startDate && span.startedAt < startDate) return false;
      if (endDate && span.startedAt > endDate) return false;
      return true;
    });
  }

  private filterSpansByFilter(spans: AISpanRecord[], filter: AITracesPaginatedArg['filters']): AISpanRecord[] {
    return spans.filter(span => {
      if (filter?.name && span.name !== filter.name) return false;
      if (filter?.spanType && span.spanType !== filter.spanType) return false;
      return true;
    });
  }

  private filterSpansByPagination(
    spans: AISpanRecord[],
    pagination: AITracesPaginatedArg['pagination'],
  ): AISpanRecord[] {
    const page = pagination?.page ?? 0;
    const perPage = pagination?.perPage ?? 10;
    const start = page * perPage;
    const end = start + perPage;
    return spans.slice(start, end);
  }

  async updateAISpan(params: {
    spanId: string;
    traceId: string;
    updates: Partial<Omit<AISpanRecord, 'spanId' | 'traceId'>>;
  }): Promise<void> {
    const id = this.generateId({ traceId: params.traceId, spanId: params.spanId });
    const span = this.collection.get(id);

    if (!span) {
      throw new MastraError({
        id: 'OBSERVABILITY_UPDATE_AI_SPAN_NOT_FOUND',
        domain: ErrorDomain.MASTRA_OBSERVABILITY,
        category: ErrorCategory.SYSTEM,
        text: 'Span not found for update',
      });
    }

    this.collection.set(id, { ...span, ...params.updates });
  }

  async batchCreateAISpans(args: { records: AISpanRecord[] }): Promise<void> {
    for (const record of args.records) {
      this.validateCreateAISpan(record);
      const id = this.generateId({ traceId: record.traceId, spanId: record.spanId });
      this.collection.set(id, record);
    }
  }

  async batchUpdateAISpans(args: {
    records: { traceId: string; spanId: string; updates: Partial<Omit<AISpanRecord, 'spanId' | 'traceId'>> }[];
  }): Promise<void> {
    for (const record of args.records) {
      const id = this.generateId({ traceId: record.traceId, spanId: record.spanId });
      const span = this.collection.get(id);
      if (!span) {
        throw new MastraError({
          id: 'OBSERVABILITY_BATCH_UPDATE_AI_SPAN_NOT_FOUND',
          domain: ErrorDomain.MASTRA_OBSERVABILITY,
          category: ErrorCategory.SYSTEM,
          text: 'Span not found for batch update',
        });
      }
      this.collection.set(id, { ...span, ...record.updates });
    }
  }

  async batchDeleteAITraces(args: { traceIds: string[] }): Promise<void> {
    for (const traceId of args.traceIds) {
      const spans = Array.from(this.collection.values()).filter(span => span.traceId === traceId);
      for (const span of spans) {
        this.collection.delete(this.generateId({ traceId: span.traceId, spanId: span.spanId }));
      }
    }
  }
}
