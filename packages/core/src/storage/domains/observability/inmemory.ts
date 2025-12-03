import { ErrorCategory, ErrorDomain, MastraError } from '../../../error';
import type { TracingStorageStrategy } from '../../../observability';
import type {
  SpanRecord,
  TraceRecord,
  TracesPaginatedArg,
  CreateSpanRecord,
  PaginationInfo,
  UpdateSpanRecord,
} from '../../types';
import type { StoreOperations } from '../operations';
import { ObservabilityStorage } from './base';

export type InMemoryObservability = Map<string, SpanRecord>;
export class ObservabilityInMemory extends ObservabilityStorage {
  operations: StoreOperations;
  collection: InMemoryObservability;

  constructor({ collection, operations }: { collection: InMemoryObservability; operations: StoreOperations }) {
    super();
    this.collection = collection;
    this.operations = operations;
  }

  public get tracingStrategy(): {
    preferred: TracingStorageStrategy;
    supported: TracingStorageStrategy[];
  } {
    return {
      preferred: 'realtime',
      supported: ['realtime', 'batch-with-updates', 'insert-only'],
    };
  }

  async createSpan(span: CreateSpanRecord): Promise<void> {
    this.validateCreateSpan(span);
    const id = this.generateId(span);
    const record = span as SpanRecord;
    record.createdAt = new Date();
    record.updatedAt = record.createdAt;
    this.collection.set(id, record);
  }

  async batchCreateSpans(args: { records: CreateSpanRecord[] }): Promise<void> {
    for (const record of args.records) {
      await this.createSpan(record);
    }
  }

  private validateCreateSpan(record: CreateSpanRecord): void {
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

  async getTrace(traceId: string): Promise<TraceRecord | null> {
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

  async getTracesPaginated({
    filters,
    pagination,
  }: TracesPaginatedArg): Promise<{ pagination: PaginationInfo; spans: SpanRecord[] }> {
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

  private filterForRootSpans(spans: SpanRecord[]): SpanRecord[] {
    return spans.filter(span => span.parentSpanId === null);
  }

  private filterSpansByDate(spans: SpanRecord[], startDate: Date | undefined, endDate: Date | undefined): SpanRecord[] {
    return spans.filter(span => {
      if (startDate && span.startedAt < startDate) return false;
      if (endDate && span.startedAt > endDate) return false;
      return true;
    });
  }

  private filterSpansByFilter(spans: SpanRecord[], filter: TracesPaginatedArg['filters']): SpanRecord[] {
    return spans.filter(span => {
      // Span type filter
      if (filter?.spanType && span.spanType !== filter.spanType) return false;

      // Entity filters
      if (filter?.entityType && span.entityType !== filter.entityType) return false;
      if (filter?.entityId && span.entityId !== filter.entityId) return false;
      if (filter?.entityName && span.entityName !== filter.entityName) return false;

      // Status filter (derived from error/endedAt)
      if (filter?.status) {
        const derivedStatus = span.error ? 'error' : span.endedAt === null ? 'running' : 'success';
        if (derivedStatus !== filter.status) return false;
      }

      // Identity & Tenancy filters
      if (filter?.userId && span.userId !== filter.userId) return false;
      if (filter?.organizationId && span.organizationId !== filter.organizationId) return false;
      if (filter?.resourceId && span.resourceId !== filter.resourceId) return false;

      // Correlation ID filters
      if (filter?.runId && span.runId !== filter.runId) return false;
      if (filter?.sessionId && span.sessionId !== filter.sessionId) return false;
      if (filter?.threadId && span.threadId !== filter.threadId) return false;
      if (filter?.requestId && span.requestId !== filter.requestId) return false;

      // Deployment context filters
      if (filter?.environment && span.environment !== filter.environment) return false;
      if (filter?.source && span.source !== filter.source) return false;
      if (filter?.serviceName && span.serviceName !== filter.serviceName) return false;
      if (filter?.deploymentId && span.deploymentId !== filter.deploymentId) return false;

      // Tag filter - match if span has any of the requested tags
      if (filter?.tags && filter.tags.length > 0) {
        if (!span.tags || !filter.tags.some(tag => span.tags?.includes(tag))) return false;
      }

      // JSONB filters - match key-value pairs
      if (filter?.metadata) {
        for (const [key, value] of Object.entries(filter.metadata)) {
          if (span.metadata?.[key] !== value) return false;
        }
      }

      if (filter?.scope) {
        for (const [key, value] of Object.entries(filter.scope)) {
          if (span.scope?.[key] !== value) return false;
        }
      }

      if (filter?.versionInfo) {
        for (const [key, value] of Object.entries(filter.versionInfo)) {
          if (span.versionInfo?.[key] !== value) return false;
        }
      }

      return true;
    });
  }

  private filterSpansByPagination(spans: SpanRecord[], pagination: TracesPaginatedArg['pagination']): SpanRecord[] {
    const page = pagination?.page ?? 0;
    const perPage = pagination?.perPage ?? 10;
    const start = page * perPage;
    const end = start + perPage;
    return spans.slice(start, end);
  }

  async updateSpan(params: { spanId: string; traceId: string; updates: Partial<UpdateSpanRecord> }): Promise<void> {
    const id = this.generateId(params);
    const span = this.collection.get(id);

    if (!span) {
      throw new MastraError({
        id: 'OBSERVABILITY_UPDATE_SPAN_NOT_FOUND',
        domain: ErrorDomain.MASTRA_OBSERVABILITY,
        category: ErrorCategory.SYSTEM,
        text: 'Span not found for update',
      });
    }

    this.collection.set(id, { ...span, ...params.updates, updatedAt: new Date() });
  }

  async batchUpdateSpans(args: {
    records: {
      traceId: string;
      spanId: string;
      updates: Partial<UpdateSpanRecord>;
    }[];
  }): Promise<void> {
    for (const record of args.records) {
      await this.updateSpan(record);
    }
  }

  async batchDeleteTraces(args: { traceIds: string[] }): Promise<void> {
    for (const traceId of args.traceIds) {
      const spans = Array.from(this.collection.values()).filter(span => span.traceId === traceId);
      for (const span of spans) {
        this.collection.delete(this.generateId(span));
      }
    }
  }
}
