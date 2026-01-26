import {
  listTracesArgsSchema,
  ObservabilityStorage,
  TABLE_SPANS,
  TraceStatus,
  safelyParseJSON,
} from '@mastra/core/storage';
import type {
  SpanRecord,
  TracingStorageStrategy,
  ListTracesArgs,
  UpdateSpanArgs,
  BatchDeleteTracesArgs,
  BatchUpdateSpansArgs,
  BatchCreateSpansArgs,
  CreateSpanArgs,
  GetSpanArgs,
  GetSpanResponse,
  GetRootSpanArgs,
  GetRootSpanResponse,
  GetTraceArgs,
  GetTraceResponse,
  ListTracesResponse,
} from '@mastra/core/storage';

import { ConvexDB, resolveConvexConfig } from '../../db';
import type { ConvexDomainConfig } from '../../db';

/**
 * Raw span record as stored in Convex (dates stored as ISO strings)
 */
type RawSpanRecord = Omit<SpanRecord, 'startedAt' | 'endedAt' | 'createdAt' | 'updatedAt'> & {
  id: string; // Composite ID (traceId-spanId) added during storage
  startedAt: string;
  endedAt?: string | null;
  createdAt: string;
  updatedAt?: string | null;
};

/**
 * Convex storage adapter for observability (traces/spans).
 * Enables Mastra Studio observability features with Convex as the storage backend.
 */
export class ObservabilityConvex extends ObservabilityStorage {
  #db: ConvexDB;

  /** Tables managed by this domain */
  static readonly MANAGED_TABLES = [TABLE_SPANS] as const;

  constructor(config: ConvexDomainConfig) {
    super();
    const client = resolveConvexConfig(config);
    this.#db = new ConvexDB(client);
  }

  async init(): Promise<void> {
    // No-op for Convex; schema is managed server-side via schema.ts
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.clearTable({ tableName: TABLE_SPANS });
  }

  public override get tracingStrategy(): {
    preferred: TracingStorageStrategy;
    supported: TracingStorageStrategy[];
  } {
    return {
      // Convex works best with batch operations due to its mutation model
      preferred: 'batch-with-updates',
      supported: ['batch-with-updates', 'insert-only'],
    };
  }

  async createSpan(args: CreateSpanArgs): Promise<void> {
    const { span } = args;
    const record = this.spanToRecord(span);
    await this.#db.insert({ tableName: TABLE_SPANS, record });
  }

  async getSpan(args: GetSpanArgs): Promise<GetSpanResponse | null> {
    const { traceId, spanId } = args;

    // Query all spans for this trace and find the matching one
    const rows = await this.#db.queryTable<RawSpanRecord>(TABLE_SPANS, [{ field: 'traceId', value: traceId }]);

    const row = rows.find(r => r.spanId === spanId);
    if (!row) {
      return null;
    }

    return {
      span: this.recordToSpan(row),
    };
  }

  async getRootSpan(args: GetRootSpanArgs): Promise<GetRootSpanResponse | null> {
    const { traceId } = args;

    // Query all spans for this trace and find the root (parentSpanId is null/undefined)
    const rows = await this.#db.queryTable<RawSpanRecord>(TABLE_SPANS, [{ field: 'traceId', value: traceId }]);

    const row = rows.find(r => !r.parentSpanId);
    if (!row) {
      return null;
    }

    return {
      span: this.recordToSpan(row),
    };
  }

  async getTrace(args: GetTraceArgs): Promise<GetTraceResponse | null> {
    const { traceId } = args;

    const rows = await this.#db.queryTable<RawSpanRecord>(TABLE_SPANS, [{ field: 'traceId', value: traceId }]);

    if (!rows || rows.length === 0) {
      return null;
    }

    // Sort by startedAt ascending
    rows.sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());

    return {
      traceId,
      spans: rows.map(row => this.recordToSpan(row)),
    };
  }

  async updateSpan(args: UpdateSpanArgs): Promise<void> {
    const { traceId, spanId, updates } = args;

    // Load the existing span
    const rows = await this.#db.queryTable<RawSpanRecord>(TABLE_SPANS, [{ field: 'traceId', value: traceId }]);

    const existing = rows.find(r => r.spanId === spanId);
    if (!existing) {
      // Span doesn't exist, nothing to update
      return;
    }

    // Prepare the updated record
    const updatedRecord: Record<string, any> = { ...existing };

    // Apply updates
    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        if (value instanceof Date) {
          updatedRecord[key] = value.toISOString();
        } else {
          updatedRecord[key] = value;
        }
      }
    }

    updatedRecord.updatedAt = new Date().toISOString();

    await this.#db.insert({ tableName: TABLE_SPANS, record: updatedRecord });
  }

  async listTraces(args: ListTracesArgs): Promise<ListTracesResponse> {
    // Parse args through schema to apply defaults
    const { filters, pagination, orderBy } = listTracesArgsSchema.parse(args);
    const { page, perPage } = pagination;

    // Get all spans and filter to root spans (parentSpanId is null/undefined)
    let rows = await this.#db.queryTable<RawSpanRecord>(TABLE_SPANS, undefined);

    // Filter to root spans only
    rows = rows.filter(row => !row.parentSpanId);

    // Apply filters
    if (filters) {
      rows = this.applyFilters(rows, filters);
    }

    // Sort by orderBy field
    const sortField = orderBy.field;
    const sortDirection = orderBy.direction;
    rows.sort((a, b) => {
      const aValue = a[sortField] ? new Date(a[sortField] as string).getTime() : 0;
      const bValue = b[sortField] ? new Date(b[sortField] as string).getTime() : 0;

      // Handle null endedAt values (running spans)
      if (sortField === 'endedAt') {
        if (!a[sortField] && !b[sortField]) return 0;
        if (!a[sortField]) return sortDirection === 'DESC' ? -1 : 1;
        if (!b[sortField]) return sortDirection === 'DESC' ? 1 : -1;
      }

      return sortDirection === 'DESC' ? bValue - aValue : aValue - bValue;
    });

    const total = rows.length;
    const offset = page * perPage;
    const paginatedRows = rows.slice(offset, offset + perPage);

    return {
      pagination: {
        total,
        page,
        perPage,
        hasMore: offset + perPage < total,
      },
      spans: paginatedRows.map(row => this.recordToSpan(row)),
    };
  }

  async batchCreateSpans(args: BatchCreateSpansArgs): Promise<void> {
    if (args.records.length === 0) return;

    const records = args.records.map(span => this.spanToRecord(span));
    await this.#db.batchInsert({ tableName: TABLE_SPANS, records });
  }

  async batchUpdateSpans(args: BatchUpdateSpansArgs): Promise<void> {
    // Convex doesn't have native batch update, so we process each update sequentially
    for (const record of args.records) {
      await this.updateSpan({
        traceId: record.traceId,
        spanId: record.spanId,
        updates: record.updates,
      });
    }
  }

  async batchDeleteTraces(args: BatchDeleteTracesArgs): Promise<void> {
    const { traceIds } = args;
    if (traceIds.length === 0) return;

    // Get all spans for the given traceIds
    const rows = await this.#db.queryTable<RawSpanRecord>(TABLE_SPANS, undefined);
    const idsToDelete = rows.filter(row => traceIds.includes(row.traceId)).map(row => row.id as string);

    if (idsToDelete.length > 0) {
      await this.#db.deleteMany(TABLE_SPANS, idsToDelete);
    }
  }

  // ============================================================================
  // Private Helper Methods
  // ============================================================================

  /**
   * Convert a span record from the create input to a storage record
   */
  private spanToRecord(span: CreateSpanArgs['span']): Record<string, any> {
    const record: Record<string, any> = { ...span };

    // Generate a composite ID for the span (traceId-spanId)
    record.id = `${span.traceId}-${span.spanId}`;

    // Convert dates to ISO strings
    if (span.startedAt instanceof Date) {
      record.startedAt = span.startedAt.toISOString();
    }
    if (span.endedAt instanceof Date) {
      record.endedAt = span.endedAt.toISOString();
    }

    // Set timestamps
    const now = new Date().toISOString();
    record.createdAt = now;
    record.updatedAt = now;

    return record;
  }

  /**
   * Convert a raw storage record back to a SpanRecord
   */
  private recordToSpan(row: RawSpanRecord): SpanRecord {
    return {
      ...row,
      // Parse JSONB fields if they're strings
      attributes: typeof row.attributes === 'string' ? safelyParseJSON(row.attributes) : row.attributes,
      metadata: typeof row.metadata === 'string' ? safelyParseJSON(row.metadata) : row.metadata,
      scope: typeof row.scope === 'string' ? safelyParseJSON(row.scope) : row.scope,
      links: typeof row.links === 'string' ? safelyParseJSON(row.links) : row.links,
      input: typeof row.input === 'string' ? safelyParseJSON(row.input) : row.input,
      output: typeof row.output === 'string' ? safelyParseJSON(row.output) : row.output,
      error: typeof row.error === 'string' ? safelyParseJSON(row.error) : row.error,
      tags: typeof row.tags === 'string' ? safelyParseJSON(row.tags) : row.tags,
      // Convert ISO strings back to Dates
      startedAt: new Date(row.startedAt),
      endedAt: row.endedAt ? new Date(row.endedAt) : undefined,
      createdAt: new Date(row.createdAt),
      updatedAt: row.updatedAt ? new Date(row.updatedAt) : undefined,
    } as SpanRecord;
  }

  /**
   * Apply filters to a list of raw span records
   */
  private applyFilters(rows: RawSpanRecord[], filters: NonNullable<ListTracesArgs['filters']>): RawSpanRecord[] {
    return rows.filter(row => {
      // Date range filters
      if (filters.startedAt?.start) {
        if (new Date(row.startedAt) < filters.startedAt.start) return false;
      }
      if (filters.startedAt?.end) {
        if (new Date(row.startedAt) > filters.startedAt.end) return false;
      }
      if (filters.endedAt?.start && row.endedAt) {
        if (new Date(row.endedAt) < filters.endedAt.start) return false;
      }
      if (filters.endedAt?.end && row.endedAt) {
        if (new Date(row.endedAt) > filters.endedAt.end) return false;
      }

      // Span type filter
      if (filters.spanType !== undefined && row.spanType !== filters.spanType) return false;

      // Entity filters
      if (filters.entityType !== undefined && row.entityType !== filters.entityType) return false;
      if (filters.entityId !== undefined && row.entityId !== filters.entityId) return false;
      if (filters.entityName !== undefined && row.entityName !== filters.entityName) return false;

      // Identity & Tenancy filters
      if (filters.userId !== undefined && row.userId !== filters.userId) return false;
      if (filters.organizationId !== undefined && row.organizationId !== filters.organizationId) return false;
      if (filters.resourceId !== undefined && row.resourceId !== filters.resourceId) return false;

      // Correlation ID filters
      if (filters.runId !== undefined && row.runId !== filters.runId) return false;
      if (filters.sessionId !== undefined && row.sessionId !== filters.sessionId) return false;
      if (filters.threadId !== undefined && row.threadId !== filters.threadId) return false;
      if (filters.requestId !== undefined && row.requestId !== filters.requestId) return false;

      // Deployment context filters
      if (filters.environment !== undefined && row.environment !== filters.environment) return false;
      if (filters.source !== undefined && row.source !== filters.source) return false;
      if (filters.serviceName !== undefined && row.serviceName !== filters.serviceName) return false;

      // Scope filter (object containment)
      if (filters.scope != null) {
        const rowScope = typeof row.scope === 'string' ? safelyParseJSON(row.scope) : row.scope;
        if (!this.containsAll(rowScope, filters.scope)) return false;
      }

      // Metadata filter (object containment)
      if (filters.metadata != null) {
        const rowMetadata = typeof row.metadata === 'string' ? safelyParseJSON(row.metadata) : row.metadata;
        if (!this.containsAll(rowMetadata, filters.metadata)) return false;
      }

      // Tags filter (all tags must be present)
      if (filters.tags != null && filters.tags.length > 0) {
        const rowTags = typeof row.tags === 'string' ? safelyParseJSON(row.tags) : row.tags;
        if (!Array.isArray(rowTags) || !filters.tags.every(tag => rowTags.includes(tag))) return false;
      }

      // Status filter (derived from error and endedAt)
      if (filters.status !== undefined) {
        const hasError = row.error != null;
        const isRunning = !row.endedAt && !hasError;
        const isSuccess = row.endedAt != null && !hasError;

        switch (filters.status) {
          case TraceStatus.ERROR:
            if (!hasError) return false;
            break;
          case TraceStatus.RUNNING:
            if (!isRunning) return false;
            break;
          case TraceStatus.SUCCESS:
            if (!isSuccess) return false;
            break;
        }
      }

      // hasChildError filter would require loading all spans for the trace
      // For now, we only check the root span's error status
      // A full implementation would query child spans

      return true;
    });
  }

  /**
   * Check if target object contains all key-value pairs from source
   */
  private containsAll(target: unknown, source: Record<string, unknown>): boolean {
    if (!target || typeof target !== 'object') return false;
    const targetObj = target as Record<string, unknown>;
    return Object.entries(source).every(([key, value]) => targetObj[key] === value);
  }
}
