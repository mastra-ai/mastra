import { ErrorCategory, ErrorDomain, MastraError } from '../../../error';
import type { PaginationInfo } from '../../types';
import { jsonValueEquals } from '../../utils';
import type { InMemoryDB } from '../inmemory-db';
import { ObservabilityStorage } from './base';
import type {
  BatchCreateSpansArgs,
  BatchDeleteTracesArgs,
  BatchUpdateSpansArgs,
  CreateSpanArgs,
  CreateSpanRecord,
  GetRootSpanArgs,
  GetRootSpanResponse,
  GetSpanArgs,
  GetSpanResponse,
  GetTraceArgs,
  GetTraceResponse,
  ListTracesArgs,
  ListTracesResponse,
  SpanRecord,
  TracingStorageStrategy,
  UpdateSpanArgs,
} from './types';
import { listTracesArgsSchema, toTraceListItems, TraceStatus } from './types';

/**
 * Internal structure for storing a trace with computed properties for efficient filtering
 */
export interface TraceEntry {
  /** All spans in this trace, keyed by spanId */
  spans: Record<string, SpanRecord>;
  /** Root span for this trace (parentSpanId === null) */
  rootSpan: SpanRecord | null;
  /** Computed trace status based on root span state */
  status: TraceStatus;
  /** True if any span in the trace has an error */
  hasChildError: boolean;
}

export class ObservabilityInMemory extends ObservabilityStorage {
  private db: InMemoryDB;

  constructor({ db }: { db: InMemoryDB }) {
    super();
    this.db = db;
  }

  async dangerouslyClearAll(): Promise<void> {
    this.db.traces.clear();
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

  async createSpan(args: CreateSpanArgs): Promise<void> {
    const { span } = args;
    this.validateCreateSpan(span);
    const now = new Date();
    const record: SpanRecord = {
      ...span,
      createdAt: now,
      updatedAt: now,
    };

    this.upsertSpanToTrace(record);
  }

  async batchCreateSpans(args: BatchCreateSpansArgs): Promise<void> {
    const now = new Date();
    for (const span of args.records) {
      this.validateCreateSpan(span);
      const record: SpanRecord = {
        ...span,
        createdAt: now,
        updatedAt: now,
      };
      this.upsertSpanToTrace(record);
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

  /**
   * Inserts or updates a span in the trace and recomputes trace-level properties
   */
  private upsertSpanToTrace(span: SpanRecord): void {
    const { traceId, spanId } = span;
    let traceEntry = this.db.traces.get(traceId);

    if (!traceEntry) {
      traceEntry = {
        spans: {},
        rootSpan: null,
        status: TraceStatus.RUNNING,
        hasChildError: false,
      };
      this.db.traces.set(traceId, traceEntry);
    }

    traceEntry.spans[spanId] = span;

    // Update root span if this is a root span
    if (span.parentSpanId === null) {
      traceEntry.rootSpan = span;
    }

    this.recomputeTraceProperties(traceEntry);
  }

  /**
   * Recomputes derived trace properties from all spans
   */
  private recomputeTraceProperties(traceEntry: TraceEntry): void {
    const spans = Object.values(traceEntry.spans);
    if (spans.length === 0) return;

    // Compute hasChildError (use != null to catch both null and undefined)
    traceEntry.hasChildError = spans.some(s => s.error != null);

    // Compute status from root span
    const rootSpan = traceEntry.rootSpan;
    if (rootSpan) {
      if (rootSpan.error != null) {
        traceEntry.status = TraceStatus.ERROR;
      } else if (rootSpan.endedAt === null) {
        traceEntry.status = TraceStatus.RUNNING;
      } else {
        traceEntry.status = TraceStatus.SUCCESS;
      }
    } else {
      // No root span yet, consider it running
      traceEntry.status = TraceStatus.RUNNING;
    }
  }

  async getSpan(args: GetSpanArgs): Promise<GetSpanResponse | null> {
    const { traceId, spanId } = args;
    const traceEntry = this.db.traces.get(traceId);
    if (!traceEntry) {
      return null;
    }

    const span = traceEntry.spans[spanId];
    if (!span) {
      return null;
    }

    return { span };
  }

  async getRootSpan(args: GetRootSpanArgs): Promise<GetRootSpanResponse | null> {
    const { traceId } = args;
    const traceEntry = this.db.traces.get(traceId);
    if (!traceEntry || !traceEntry.rootSpan) {
      return null;
    }

    return { span: traceEntry.rootSpan };
  }

  async getTrace(args: GetTraceArgs): Promise<GetTraceResponse | null> {
    const { traceId } = args;
    const traceEntry = this.db.traces.get(traceId);
    if (!traceEntry) {
      return null;
    }

    const spans = Object.values(traceEntry.spans);
    if (spans.length === 0) {
      return null;
    }

    // Sort spans by startedAt
    spans.sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());

    return {
      traceId,
      spans,
    };
  }

  async listTraces(args: ListTracesArgs): Promise<ListTracesResponse> {
    // Parse args through schema to apply defaults
    const { filters, pagination, orderBy } = listTracesArgsSchema.parse(args);

    // Collect all traces that match filters
    const matchingRootSpans: SpanRecord[] = [];

    for (const [, traceEntry] of this.db.traces) {
      if (!traceEntry.rootSpan) continue;

      if (this.traceMatchesFilters(traceEntry, filters)) {
        matchingRootSpans.push(traceEntry.rootSpan);
      }
    }

    // Sort by orderBy field
    const { field: sortField, direction: sortDirection } = orderBy;

    matchingRootSpans.sort((a, b) => {
      if (sortField === 'endedAt') {
        const aVal = a.endedAt;
        const bVal = b.endedAt;

        // Handle nullish values (running spans with null endedAt)
        // For endedAt DESC: NULLs FIRST (running spans on top when viewing newest)
        // For endedAt ASC: NULLs LAST (running spans at end when viewing oldest)
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return sortDirection === 'DESC' ? -1 : 1;
        if (bVal == null) return sortDirection === 'DESC' ? 1 : -1;

        const diff = aVal.getTime() - bVal.getTime();
        return sortDirection === 'DESC' ? -diff : diff;
      } else {
        // startedAt is never null (required field)
        const diff = a.startedAt.getTime() - b.startedAt.getTime();
        return sortDirection === 'DESC' ? -diff : diff;
      }
    });

    // Apply pagination
    const total = matchingRootSpans.length;
    const { page, perPage } = pagination;
    const start = page * perPage;
    const end = start + perPage;

    const paged = matchingRootSpans.slice(start, end);

    return {
      spans: toTraceListItems(paged),
      pagination: { total, page, perPage, hasMore: end < total },
    };
  }

  /**
   * Check if a trace matches all provided filters
   */
  private traceMatchesFilters(traceEntry: TraceEntry, filters: ListTracesArgs['filters']): boolean {
    if (!filters) return true;

    const rootSpan = traceEntry.rootSpan;
    if (!rootSpan) return false;

    // Date range filters on startedAt (based on root span)
    if (filters.startedAt) {
      if (filters.startedAt.start && rootSpan.startedAt < filters.startedAt.start) {
        return false;
      }
      if (filters.startedAt.end && rootSpan.startedAt > filters.startedAt.end) {
        return false;
      }
    }

    // Date range filters on endedAt (based on root span)
    if (filters.endedAt) {
      // If root span is still running (endedAt is nullish), it doesn't match endedAt filters
      if (rootSpan.endedAt == null) {
        return false;
      }
      if (filters.endedAt.start && rootSpan.endedAt < filters.endedAt.start) {
        return false;
      }
      if (filters.endedAt.end && rootSpan.endedAt > filters.endedAt.end) {
        return false;
      }
    }

    // Span type filter (on root span)
    if (filters.spanType !== undefined && rootSpan.spanType !== filters.spanType) {
      return false;
    }

    // Entity filters
    if (filters.entityType !== undefined && rootSpan.entityType !== filters.entityType) {
      return false;
    }
    if (filters.entityId !== undefined && rootSpan.entityId !== filters.entityId) {
      return false;
    }
    if (filters.entityName !== undefined && rootSpan.entityName !== filters.entityName) {
      return false;
    }

    // Identity & Tenancy filters
    if (filters.userId !== undefined && rootSpan.userId !== filters.userId) {
      return false;
    }
    if (filters.organizationId !== undefined && rootSpan.organizationId !== filters.organizationId) {
      return false;
    }
    if (filters.resourceId !== undefined && rootSpan.resourceId !== filters.resourceId) {
      return false;
    }

    // Correlation ID filters
    if (filters.runId !== undefined && rootSpan.runId !== filters.runId) {
      return false;
    }
    if (filters.sessionId !== undefined && rootSpan.sessionId !== filters.sessionId) {
      return false;
    }
    if (filters.threadId !== undefined && rootSpan.threadId !== filters.threadId) {
      return false;
    }
    if (filters.requestId !== undefined && rootSpan.requestId !== filters.requestId) {
      return false;
    }

    // Deployment context filters
    if (filters.environment !== undefined && rootSpan.environment !== filters.environment) {
      return false;
    }
    if (filters.source !== undefined && rootSpan.source !== filters.source) {
      return false;
    }
    if (filters.serviceName !== undefined && rootSpan.serviceName !== filters.serviceName) {
      return false;
    }

    // Scope filter (partial match - all provided keys must match)
    // Use != null to handle both null and undefined (nullish filter fields)
    if (filters.scope != null && rootSpan.scope != null) {
      for (const [key, value] of Object.entries(filters.scope)) {
        if (!jsonValueEquals(rootSpan.scope[key], value)) {
          return false;
        }
      }
    } else if (filters.scope != null && rootSpan.scope == null) {
      return false;
    }

    // Metadata filter (partial match - all provided keys must match)
    // Use != null to handle both null and undefined (nullish filter fields)
    if (filters.metadata != null && rootSpan.metadata != null) {
      for (const [key, value] of Object.entries(filters.metadata)) {
        if (!jsonValueEquals(rootSpan.metadata[key], value)) {
          return false;
        }
      }
    } else if (filters.metadata != null && rootSpan.metadata == null) {
      return false;
    }

    // Tags filter (all provided tags must be present)
    // Use != null to handle both null and undefined (nullish filter fields)
    if (filters.tags != null && filters.tags.length > 0) {
      if (rootSpan.tags == null) {
        return false;
      }
      for (const tag of filters.tags) {
        if (!rootSpan.tags.includes(tag)) {
          return false;
        }
      }
    }

    // Derived status filter
    if (filters.status !== undefined && traceEntry.status !== filters.status) {
      return false;
    }

    // Has child error filter
    if (filters.hasChildError !== undefined && traceEntry.hasChildError !== filters.hasChildError) {
      return false;
    }

    return true;
  }

  async updateSpan(args: UpdateSpanArgs): Promise<void> {
    const { traceId, spanId, updates } = args;
    const traceEntry = this.db.traces.get(traceId);

    if (!traceEntry) {
      throw new MastraError({
        id: 'OBSERVABILITY_UPDATE_SPAN_NOT_FOUND',
        domain: ErrorDomain.MASTRA_OBSERVABILITY,
        category: ErrorCategory.SYSTEM,
        text: 'Trace not found for span update',
      });
    }

    const span = traceEntry.spans[spanId];
    if (!span) {
      throw new MastraError({
        id: 'OBSERVABILITY_UPDATE_SPAN_NOT_FOUND',
        domain: ErrorDomain.MASTRA_OBSERVABILITY,
        category: ErrorCategory.SYSTEM,
        text: 'Span not found for update',
      });
    }

    const updatedSpan: SpanRecord = {
      ...span,
      ...updates,
      updatedAt: new Date(),
    };

    traceEntry.spans[spanId] = updatedSpan;

    // Update root span reference if this is the root span
    if (updatedSpan.parentSpanId === null) {
      traceEntry.rootSpan = updatedSpan;
    }

    this.recomputeTraceProperties(traceEntry);
  }

  async batchUpdateSpans(args: BatchUpdateSpansArgs): Promise<void> {
    for (const record of args.records) {
      await this.updateSpan(record);
    }
  }

  async batchDeleteTraces(args: BatchDeleteTracesArgs): Promise<void> {
    for (const traceId of args.traceIds) {
      this.db.traces.delete(traceId);
    }
  }
}
