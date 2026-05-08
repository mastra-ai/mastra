import { ErrorCategory, ErrorDomain, MastraError } from '../../../error';
import { EntityType } from '../../../observability';
import { jsonValueEquals } from '../../utils';
import type { InMemoryDB } from '../inmemory-db';
import { ObservabilityStorage } from './base';
import type {
  GetEntityTypesArgs,
  GetEntityTypesResponse,
  GetEntityNamesArgs,
  GetEntityNamesResponse,
  GetServiceNamesArgs,
  GetServiceNamesResponse,
  GetEnvironmentsArgs,
  GetEnvironmentsResponse,
  GetTagsArgs,
  GetTagsResponse,
  GetMetricNamesArgs,
  GetMetricNamesResponse,
  GetMetricLabelKeysArgs,
  GetMetricLabelKeysResponse,
  GetMetricLabelValuesArgs,
  GetMetricLabelValuesResponse,
} from './discovery';
import { listFeedbackArgsSchema } from './feedback';
import type {
  BatchCreateFeedbackArgs,
  CreateFeedbackArgs,
  FeedbackFilter,
  GetFeedbackAggregateArgs,
  GetFeedbackAggregateResponse,
  GetFeedbackBreakdownArgs,
  GetFeedbackBreakdownResponse,
  GetFeedbackPercentilesArgs,
  GetFeedbackPercentilesResponse,
  GetFeedbackTimeSeriesArgs,
  GetFeedbackTimeSeriesResponse,
  ListFeedbackArgs,
  ListFeedbackResponse,
  FeedbackRecord,
} from './feedback';
import { listLogsArgsSchema } from './logs';
import type { BatchCreateLogsArgs, ListLogsArgs, ListLogsResponse, LogRecord } from './logs';
import type {
  BatchCreateMetricsArgs,
  MetricRecord,
  ListMetricsArgs,
  ListMetricsResponse,
  GetMetricAggregateArgs,
  GetMetricAggregateResponse,
  GetMetricBreakdownArgs,
  GetMetricBreakdownResponse,
  GetMetricTimeSeriesArgs,
  GetMetricTimeSeriesResponse,
  GetMetricPercentilesArgs,
  GetMetricPercentilesResponse,
  AggregationType,
} from './metrics';
import { listMetricsArgsSchema } from './metrics';
import { listScoresArgsSchema } from './scores';
import type {
  BatchCreateScoresArgs,
  CreateScoreArgs,
  GetScoreAggregateArgs,
  GetScoreAggregateResponse,
  GetScoreBreakdownArgs,
  GetScoreBreakdownResponse,
  GetScorePercentilesArgs,
  GetScorePercentilesResponse,
  GetScoreTimeSeriesArgs,
  GetScoreTimeSeriesResponse,
  ListScoresArgs,
  ListScoresResponse,
  ScoreRecord,
} from './scores';
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
  GetStructureResponse,
  GetTraceArgs,
  GetTraceResponse,
  LightSpanRecord,
  ListBranchesArgs,
  ListBranchesResponse,
  ListTracesArgs,
  ListTracesResponse,
  SpanRecord,
  UpdateSpanArgs,
} from './tracing';

import {
  BRANCH_SPAN_TYPE_SET,
  listBranchesArgsSchema,
  listTracesArgsSchema,
  TraceStatus,
  toTraceSpan,
  toTraceSpans,
} from './tracing';

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

/** In-memory implementation of ObservabilityStorage for testing and development. */
export class ObservabilityInMemory extends ObservabilityStorage {
  private db: InMemoryDB;

  constructor({ db }: { db: InMemoryDB }) {
    super();
    this.db = db;
  }

  async dangerouslyClearAll(): Promise<void> {
    this.db.traces.clear();
    this.db.metricRecords.length = 0;
    this.db.logRecords.length = 0;
    this.db.scoreRecords.length = 0;
    this.db.feedbackRecords.length = 0;
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
    if (span.parentSpanId == null) {
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
      } else if (rootSpan.endedAt == null) {
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

  async getTraceLight(args: GetTraceArgs): Promise<GetStructureResponse | null> {
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
      spans: spans.map(
        (span): LightSpanRecord => ({
          traceId: span.traceId,
          spanId: span.spanId,
          parentSpanId: span.parentSpanId,
          name: span.name,
          spanType: span.spanType,
          isEvent: span.isEvent,
          startedAt: span.startedAt,
          endedAt: span.endedAt,
          error: span.error,
          entityType: span.entityType,
          entityId: span.entityId,
          entityName: span.entityName,
          createdAt: span.createdAt,
          updatedAt: span.updatedAt,
        }),
      ),
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
      spans: toTraceSpans(paged),
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
    if (filters.entityVersionId !== undefined && rootSpan.entityVersionId !== filters.entityVersionId) {
      return false;
    }

    // Experimentation
    if (filters.experimentId !== undefined && rootSpan.experimentId !== filters.experimentId) {
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

  async listBranches(args: ListBranchesArgs): Promise<ListBranchesResponse> {
    const { filters, pagination, orderBy } = listBranchesArgsSchema.parse(args);

    const allowedSpanTypes = filters?.spanType
      ? BRANCH_SPAN_TYPE_SET.has(filters.spanType)
        ? new Set([filters.spanType])
        : new Set<typeof filters.spanType>()
      : BRANCH_SPAN_TYPE_SET;

    const matches: SpanRecord[] = [];
    for (const [, traceEntry] of this.db.traces) {
      for (const span of Object.values(traceEntry.spans)) {
        if (!allowedSpanTypes.has(span.spanType)) continue;
        if (!this.spanMatchesBranchFilters(span, filters)) continue;
        matches.push(span);
      }
    }

    const { field: sortField, direction: sortDirection } = orderBy;
    matches.sort((a, b) => {
      if (sortField === 'endedAt') {
        const aVal = a.endedAt;
        const bVal = b.endedAt;
        if (aVal == null && bVal == null) return 0;
        if (aVal == null) return sortDirection === 'DESC' ? -1 : 1;
        if (bVal == null) return sortDirection === 'DESC' ? 1 : -1;
        const diff = aVal.getTime() - bVal.getTime();
        return sortDirection === 'DESC' ? -diff : diff;
      }
      const diff = a.startedAt.getTime() - b.startedAt.getTime();
      return sortDirection === 'DESC' ? -diff : diff;
    });

    const total = matches.length;
    const { page, perPage } = pagination;
    const start = page * perPage;
    const end = start + perPage;
    const paged = matches.slice(start, end);

    return {
      pagination: { total, page, perPage, hasMore: end < total },
      branches: paged.map(toTraceSpan),
    };
  }

  /**
   * Check if a single anchor span matches all provided branch filters. All
   * predicates apply to the span itself (not the trace root) -- this is the
   * key difference from {@link traceMatchesFilters}.
   */
  private spanMatchesBranchFilters(span: SpanRecord, filters: ListBranchesArgs['filters']): boolean {
    if (!filters) return true;

    if (filters.startedAt) {
      if (filters.startedAt.start && span.startedAt < filters.startedAt.start) return false;
      if (filters.startedAt.end && span.startedAt > filters.startedAt.end) return false;
    }
    if (filters.endedAt) {
      if (span.endedAt == null) return false;
      if (filters.endedAt.start && span.endedAt < filters.endedAt.start) return false;
      if (filters.endedAt.end && span.endedAt > filters.endedAt.end) return false;
    }

    if (filters.traceId !== undefined && span.traceId !== filters.traceId) return false;

    if (filters.entityType !== undefined && span.entityType !== filters.entityType) return false;
    if (filters.entityId !== undefined && span.entityId !== filters.entityId) return false;
    if (filters.entityName !== undefined && span.entityName !== filters.entityName) return false;
    if (filters.entityVersionId !== undefined && span.entityVersionId !== filters.entityVersionId) return false;
    if (filters.parentEntityType !== undefined && span.parentEntityType !== filters.parentEntityType) return false;
    if (filters.parentEntityId !== undefined && span.parentEntityId !== filters.parentEntityId) return false;
    if (filters.parentEntityName !== undefined && span.parentEntityName !== filters.parentEntityName) return false;
    if (filters.parentEntityVersionId !== undefined && span.parentEntityVersionId !== filters.parentEntityVersionId)
      return false;
    if (filters.rootEntityType !== undefined && span.rootEntityType !== filters.rootEntityType) return false;
    if (filters.rootEntityId !== undefined && span.rootEntityId !== filters.rootEntityId) return false;
    if (filters.rootEntityName !== undefined && span.rootEntityName !== filters.rootEntityName) return false;
    if (filters.rootEntityVersionId !== undefined && span.rootEntityVersionId !== filters.rootEntityVersionId)
      return false;

    if (filters.experimentId !== undefined && span.experimentId !== filters.experimentId) return false;
    if (filters.userId !== undefined && span.userId !== filters.userId) return false;
    if (filters.organizationId !== undefined && span.organizationId !== filters.organizationId) return false;
    if (filters.resourceId !== undefined && span.resourceId !== filters.resourceId) return false;
    if (filters.runId !== undefined && span.runId !== filters.runId) return false;
    if (filters.sessionId !== undefined && span.sessionId !== filters.sessionId) return false;
    if (filters.threadId !== undefined && span.threadId !== filters.threadId) return false;
    if (filters.requestId !== undefined && span.requestId !== filters.requestId) return false;
    if (filters.environment !== undefined && span.environment !== filters.environment) return false;
    if (filters.source !== undefined && span.source !== filters.source) return false;
    if (filters.serviceName !== undefined && span.serviceName !== filters.serviceName) return false;

    if (filters.scope != null && span.scope != null) {
      for (const [key, value] of Object.entries(filters.scope)) {
        if (!jsonValueEquals(span.scope[key], value)) return false;
      }
    } else if (filters.scope != null && span.scope == null) {
      return false;
    }

    if (filters.metadata != null && span.metadata != null) {
      for (const [key, value] of Object.entries(filters.metadata)) {
        if (!jsonValueEquals(span.metadata[key], value)) return false;
      }
    } else if (filters.metadata != null && span.metadata == null) {
      return false;
    }

    if (filters.tags != null && filters.tags.length > 0) {
      if (span.tags == null) return false;
      for (const tag of filters.tags) {
        if (!span.tags.includes(tag)) return false;
      }
    }

    if (filters.status !== undefined) {
      const spanStatus = toTraceSpan(span).status;
      if (spanStatus !== filters.status) return false;
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
    if (updatedSpan.parentSpanId == null) {
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

  // ============================================================================
  // Metrics
  // ============================================================================

  async batchCreateMetrics(args: BatchCreateMetricsArgs): Promise<void> {
    for (const metric of args.metrics) {
      this.db.metricRecords.push(metric as MetricRecord);
    }
  }

  async listMetrics(args: ListMetricsArgs): Promise<ListMetricsResponse> {
    const { filters, pagination, orderBy } = listMetricsArgsSchema.parse(args);

    let matching = this.filterMetrics(filters as Record<string, unknown>);

    const dir = orderBy.direction === 'DESC' ? -1 : 1;
    matching.sort((a, b) => dir * (a.timestamp.getTime() - b.timestamp.getTime()));

    const total = matching.length;
    const page = Number(pagination.page);
    const perPage = Number(pagination.perPage);
    const start = page * perPage;

    return {
      metrics: matching.slice(start, start + perPage),
      pagination: { total, page, perPage, hasMore: start + perPage < total },
    };
  }

  private filterMetrics(filters?: Record<string, unknown>): MetricRecord[] {
    if (!filters) return [...this.db.metricRecords];
    return this.db.metricRecords.filter(m => {
      if (filters.timestamp) {
        const ts = filters.timestamp as { start?: Date; end?: Date; startExclusive?: boolean; endExclusive?: boolean };
        if (ts.start && (ts.startExclusive ? m.timestamp <= ts.start : m.timestamp < ts.start)) return false;
        if (ts.end && (ts.endExclusive ? m.timestamp >= ts.end : m.timestamp > ts.end)) return false;
      }
      if (filters.name != null) {
        if (!(filters.name as string[]).includes(m.name)) return false;
      }
      if (filters.traceId !== undefined && m.traceId !== filters.traceId) return false;
      if (filters.spanId !== undefined && m.spanId !== filters.spanId) return false;
      if (filters.provider !== undefined && m.provider !== filters.provider) return false;
      if (filters.model !== undefined && m.model !== filters.model) return false;
      if (filters.costUnit !== undefined && m.costUnit !== filters.costUnit) return false;
      if (filters.entityType !== undefined && m.entityType !== filters.entityType) return false;
      if (filters.entityName !== undefined && m.entityName !== filters.entityName) return false;
      if (filters.entityVersionId !== undefined && m.entityVersionId !== filters.entityVersionId) return false;
      if (filters.parentEntityVersionId !== undefined && m.parentEntityVersionId !== filters.parentEntityVersionId)
        return false;
      if (filters.rootEntityVersionId !== undefined && m.rootEntityVersionId !== filters.rootEntityVersionId)
        return false;
      if (filters.userId !== undefined && m.userId !== filters.userId) return false;
      if (filters.organizationId !== undefined && m.organizationId !== filters.organizationId) return false;
      if (filters.resourceId !== undefined && m.resourceId !== filters.resourceId) return false;
      if (filters.runId !== undefined && m.runId !== filters.runId) return false;
      if (filters.sessionId !== undefined && m.sessionId !== filters.sessionId) return false;
      if (filters.threadId !== undefined && m.threadId !== filters.threadId) return false;
      if (filters.requestId !== undefined && m.requestId !== filters.requestId) return false;
      if (filters.experimentId !== undefined && m.experimentId !== filters.experimentId) return false;
      if (filters.serviceName !== undefined && m.serviceName !== filters.serviceName) return false;
      if (filters.environment !== undefined && m.environment !== filters.environment) return false;
      const metricExecutionSource = m.executionSource ?? m.source ?? null;
      if (filters.executionSource !== undefined && metricExecutionSource !== filters.executionSource) return false;
      if (filters.source !== undefined && metricExecutionSource !== filters.source) return false;
      if (filters.parentEntityType !== undefined && m.parentEntityType !== filters.parentEntityType) return false;
      if (filters.parentEntityName !== undefined && m.parentEntityName !== filters.parentEntityName) return false;
      if (filters.rootEntityType !== undefined && m.rootEntityType !== filters.rootEntityType) return false;
      if (filters.rootEntityName !== undefined && m.rootEntityName !== filters.rootEntityName) return false;
      if (filters.tags != null && Array.isArray(filters.tags) && filters.tags.length > 0) {
        if (m.tags == null) return false;
        for (const tag of filters.tags) {
          if (!m.tags.includes(tag)) return false;
        }
      }
      if (filters.labels) {
        const labelFilters = filters.labels as Record<string, string>;
        for (const [k, v] of Object.entries(labelFilters)) {
          if (m.labels[k] !== v) return false;
        }
      }
      return true;
    });
  }

  private aggregate(
    values: number[],
    type: AggregationType,
    timestamps?: number[],
    distinctValues?: Array<string | number | null | undefined>,
  ): number | null {
    if (type === 'count_distinct') {
      if (!distinctValues) return 0;
      const set = new Set<string | number>();
      for (const v of distinctValues) {
        if (v === null || v === undefined) continue;
        set.add(v);
      }
      return set.size;
    }
    if (values.length === 0) return null;
    switch (type) {
      case 'sum':
        return values.reduce((a, b) => a + b, 0);
      case 'avg':
        return values.reduce((a, b) => a + b, 0) / values.length;
      case 'min':
        return Math.min(...values);
      case 'max':
        return Math.max(...values);
      case 'count':
        return values.length;
      case 'last': {
        if (!timestamps || timestamps.length !== values.length) {
          return values[values.length - 1]!;
        }

        let latestIndex = 0;
        let latestTimestamp = timestamps[0]!;

        for (let i = 1; i < timestamps.length; i++) {
          const timestamp = timestamps[i]!;
          if (timestamp >= latestTimestamp) {
            latestTimestamp = timestamp;
            latestIndex = i;
          }
        }

        return values[latestIndex]!;
      }
      default:
        return values.reduce((a, b) => a + b, 0);
    }
  }

  private extractDistinctValues(
    records: MetricRecord[],
    distinctColumn: string | undefined,
  ): Array<string | number | null | undefined> | undefined {
    if (!distinctColumn) return undefined;
    return records.map(r => {
      const raw = (r as unknown as Record<string, unknown>)[distinctColumn];
      if (raw === null || raw === undefined) return null;
      if (typeof raw === 'string' || typeof raw === 'number') return raw;
      return String(raw);
    });
  }

  private interpolatePercentile(sortedValues: number[], percentile: number): number {
    if (sortedValues.length === 0) return 0;

    const position = percentile * (sortedValues.length - 1);
    const lowerIndex = Math.floor(position);
    const upperIndex = Math.ceil(position);
    const lowerValue = sortedValues[lowerIndex]!;
    const upperValue = sortedValues[upperIndex]!;

    if (lowerIndex === upperIndex) {
      return lowerValue;
    }

    return lowerValue + (upperValue - lowerValue) * (position - lowerIndex);
  }

  /**
   * Cost is returned alongside value-based OLAP results so callers can derive
   * token and monetary views from the same filtered scan.
   */
  private summarizeCost(records: MetricRecord[]): { estimatedCost: number | null; costUnit: string | null } {
    const costValues = records
      .map(record => record.estimatedCost)
      .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    const costUnits = new Set(
      records.map(record => record.costUnit).filter((unit): unit is string => typeof unit === 'string'),
    );

    return {
      estimatedCost: costValues.length > 0 ? costValues.reduce((sum, value) => sum + value, 0) : null,
      costUnit: costUnits.size === 1 ? Array.from(costUnits)[0]! : null,
    };
  }

  async getMetricAggregate(args: GetMetricAggregateArgs): Promise<GetMetricAggregateResponse> {
    const names = Array.isArray(args.name) ? args.name : [args.name];
    const filtered = this.filterMetrics(args.filters as Record<string, unknown>).filter(m => names.includes(m.name));
    const value = this.aggregate(
      filtered.map(m => m.value),
      args.aggregation,
      undefined,
      this.extractDistinctValues(filtered, args.distinctColumn),
    );
    const costSummary = this.summarizeCost(filtered);

    if (args.comparePeriod && args.filters?.timestamp) {
      const ts = args.filters.timestamp;
      if (ts.start && ts.end) {
        const duration = ts.end.getTime() - ts.start.getTime();
        let prevStart: Date;
        let prevEnd: Date;

        switch (args.comparePeriod) {
          case 'previous_period':
            prevStart = new Date(ts.start.getTime() - duration);
            prevEnd = new Date(ts.end.getTime() - duration);
            break;
          case 'previous_day':
            prevStart = new Date(ts.start.getTime() - 86400000);
            prevEnd = new Date(ts.end.getTime() - 86400000);
            break;
          case 'previous_week':
            prevStart = new Date(ts.start.getTime() - 604800000);
            prevEnd = new Date(ts.end.getTime() - 604800000);
            break;
        }

        const prevFiltered = this.filterMetrics({
          ...(args.filters as Record<string, unknown>),
          timestamp: { ...ts, start: prevStart, end: prevEnd },
        }).filter(m => names.includes(m.name));
        const previousValue = this.aggregate(
          prevFiltered.map(m => m.value),
          args.aggregation,
          undefined,
          this.extractDistinctValues(prevFiltered, args.distinctColumn),
        );
        const previousCostSummary = this.summarizeCost(prevFiltered);

        let changePercent: number | null = null;
        if (previousValue !== null && previousValue !== 0 && value !== null) {
          changePercent = ((value - previousValue) / Math.abs(previousValue)) * 100;
        }

        let costChangePercent: number | null = null;
        if (
          previousCostSummary.estimatedCost !== null &&
          previousCostSummary.estimatedCost !== 0 &&
          costSummary.estimatedCost !== null
        ) {
          costChangePercent =
            ((costSummary.estimatedCost - previousCostSummary.estimatedCost) /
              Math.abs(previousCostSummary.estimatedCost)) *
            100;
        }

        return {
          value,
          estimatedCost: costSummary.estimatedCost,
          costUnit: costSummary.costUnit,
          previousValue,
          previousEstimatedCost: previousCostSummary.estimatedCost,
          changePercent,
          costChangePercent,
        };
      }
    }

    return { value, estimatedCost: costSummary.estimatedCost, costUnit: costSummary.costUnit };
  }

  async getMetricBreakdown(args: GetMetricBreakdownArgs): Promise<GetMetricBreakdownResponse> {
    const names = Array.isArray(args.name) ? args.name : [args.name];
    const filtered = this.filterMetrics(args.filters as Record<string, unknown>).filter(m => names.includes(m.name));

    const groupMap = new Map<string, MetricRecord[]>();
    for (const m of filtered) {
      const dims: Record<string, string | null> = {};
      for (const col of args.groupBy) {
        dims[col] = ((m as Record<string, unknown>)[col] as string | null | undefined) ?? m.labels[col] ?? null;
      }
      const key = JSON.stringify(dims);
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(m);
    }

    const groups = Array.from(groupMap.entries()).map(([key, records]) => {
      const costSummary = this.summarizeCost(records);
      return {
        dimensions: JSON.parse(key) as Record<string, string | null>,
        value:
          this.aggregate(
            records.map(record => record.value),
            args.aggregation,
            undefined,
            this.extractDistinctValues(records, args.distinctColumn),
          ) ?? 0,
        estimatedCost: costSummary.estimatedCost,
        costUnit: costSummary.costUnit,
      };
    });

    const direction = args.orderDirection === 'ASC' ? 1 : -1;
    groups.sort((a, b) => (a.value - b.value) * direction);

    const limited = typeof args.limit === 'number' ? groups.slice(0, args.limit) : groups;
    return { groups: limited };
  }

  async getMetricTimeSeries(args: GetMetricTimeSeriesArgs): Promise<GetMetricTimeSeriesResponse> {
    const names = Array.isArray(args.name) ? args.name : [args.name];
    const filtered = this.filterMetrics(args.filters as Record<string, unknown>).filter(m => names.includes(m.name));

    const intervalMs = this.intervalToMs(args.interval);

    if (args.groupBy && args.groupBy.length > 0) {
      const seriesMap = new Map<string, Map<number, MetricRecord[]>>();
      for (const m of filtered) {
        const key = args.groupBy
          .map(col => String((m as Record<string, unknown>)[col] ?? m.labels[col] ?? ''))
          .join('|');
        if (!seriesMap.has(key)) seriesMap.set(key, new Map());
        const bucket = Math.floor(m.timestamp.getTime() / intervalMs) * intervalMs;
        const bucketMap = seriesMap.get(key)!;
        if (!bucketMap.has(bucket)) bucketMap.set(bucket, []);
        bucketMap.get(bucket)!.push(m);
      }

      return {
        series: Array.from(seriesMap.entries()).map(([name, bucketMap]) => {
          const seriesRecords = Array.from(bucketMap.values()).flat();
          const costSummary = this.summarizeCost(seriesRecords);
          return {
            name,
            costUnit: costSummary.costUnit,
            points: Array.from(bucketMap.entries())
              .sort(([a], [b]) => a - b)
              .map(([ts, records]) => ({
                timestamp: new Date(ts),
                value:
                  this.aggregate(
                    records.map(record => record.value),
                    args.aggregation,
                    undefined,
                    this.extractDistinctValues(records, args.distinctColumn),
                  ) ?? 0,
                estimatedCost: this.summarizeCost(records).estimatedCost,
              })),
          };
        }),
      };
    }

    const bucketMap = new Map<number, MetricRecord[]>();
    for (const m of filtered) {
      const bucket = Math.floor(m.timestamp.getTime() / intervalMs) * intervalMs;
      if (!bucketMap.has(bucket)) bucketMap.set(bucket, []);
      bucketMap.get(bucket)!.push(m);
    }

    const metricName = Array.isArray(args.name) ? args.name.join(',') : args.name;
    const costSummary = this.summarizeCost(filtered);
    return {
      series: [
        {
          name: metricName,
          costUnit: costSummary.costUnit,
          points: Array.from(bucketMap.entries())
            .sort(([a], [b]) => a - b)
            .map(([ts, records]) => ({
              timestamp: new Date(ts),
              value:
                this.aggregate(
                  records.map(record => record.value),
                  args.aggregation,
                  undefined,
                  this.extractDistinctValues(records, args.distinctColumn),
                ) ?? 0,
              estimatedCost: this.summarizeCost(records).estimatedCost,
            })),
        },
      ],
    };
  }

  async getMetricPercentiles(args: GetMetricPercentilesArgs): Promise<GetMetricPercentilesResponse> {
    const filtered = this.filterMetrics(args.filters as Record<string, unknown>).filter(m => m.name === args.name);
    const intervalMs = this.intervalToMs(args.interval);

    const bucketMap = new Map<number, number[]>();
    for (const m of filtered) {
      const bucket = Math.floor(m.timestamp.getTime() / intervalMs) * intervalMs;
      if (!bucketMap.has(bucket)) bucketMap.set(bucket, []);
      bucketMap.get(bucket)!.push(m.value);
    }

    const sortedBuckets = Array.from(bucketMap.entries()).sort(([a], [b]) => a - b);

    return {
      series: args.percentiles.map(p => ({
        percentile: p,
        points: sortedBuckets.map(([ts, values]) => {
          const sorted = [...values].sort((a, b) => a - b);
          const idx = Math.min(Math.floor(p * sorted.length), sorted.length - 1);
          return { timestamp: new Date(ts), value: sorted[idx] ?? 0 };
        }),
      })),
    };
  }

  private intervalToMs(interval: string): number {
    switch (interval) {
      case '1m':
        return 60_000;
      case '5m':
        return 300_000;
      case '15m':
        return 900_000;
      case '1h':
        return 3_600_000;
      case '1d':
        return 86_400_000;
      default:
        return 3_600_000;
    }
  }

  // ============================================================================
  // Discovery / Metadata Methods
  // ============================================================================

  async getMetricNames(args: GetMetricNamesArgs): Promise<GetMetricNamesResponse> {
    const nameSet = new Set<string>();
    for (const m of this.db.metricRecords) {
      if (args.prefix && !m.name.startsWith(args.prefix)) continue;
      nameSet.add(m.name);
    }
    let names = Array.from(nameSet).sort();
    if (args.limit) names = names.slice(0, args.limit);
    return { names };
  }

  async getMetricLabelKeys(args: GetMetricLabelKeysArgs): Promise<GetMetricLabelKeysResponse> {
    const keySet = new Set<string>();
    for (const m of this.db.metricRecords) {
      if (m.name !== args.metricName) continue;
      for (const key of Object.keys(m.labels)) {
        keySet.add(key);
      }
    }
    return { keys: Array.from(keySet).sort() };
  }

  async getMetricLabelValues(args: GetMetricLabelValuesArgs): Promise<GetMetricLabelValuesResponse> {
    const valueSet = new Set<string>();
    for (const m of this.db.metricRecords) {
      if (m.name !== args.metricName) continue;
      const val = m.labels[args.labelKey];
      if (val === undefined) continue;
      if (args.prefix && !val.startsWith(args.prefix)) continue;
      valueSet.add(val);
    }
    let values = Array.from(valueSet).sort();
    if (args.limit) values = values.slice(0, args.limit);
    return { values };
  }

  async getEntityTypes(_args: GetEntityTypesArgs): Promise<GetEntityTypesResponse> {
    const validTypes = new Set(Object.values(EntityType));
    const typeSet = new Set<EntityType>();
    for (const [, traceEntry] of this.db.traces) {
      for (const span of Object.values(traceEntry.spans)) {
        if (span.entityType && validTypes.has(span.entityType as EntityType)) {
          typeSet.add(span.entityType as EntityType);
        }
      }
    }
    return { entityTypes: Array.from(typeSet).sort() };
  }

  async getEntityNames(args: GetEntityNamesArgs): Promise<GetEntityNamesResponse> {
    const nameSet = new Set<string>();
    for (const [, traceEntry] of this.db.traces) {
      for (const span of Object.values(traceEntry.spans)) {
        if (!span.entityName) continue;
        if (args.entityType && span.entityType !== args.entityType) continue;
        nameSet.add(span.entityName);
      }
    }
    return { names: Array.from(nameSet).sort() };
  }

  async getServiceNames(_args: GetServiceNamesArgs): Promise<GetServiceNamesResponse> {
    const nameSet = new Set<string>();
    for (const [, traceEntry] of this.db.traces) {
      for (const span of Object.values(traceEntry.spans)) {
        if (span.serviceName) nameSet.add(span.serviceName);
      }
    }
    return { serviceNames: Array.from(nameSet).sort() };
  }

  async getEnvironments(_args: GetEnvironmentsArgs): Promise<GetEnvironmentsResponse> {
    const envSet = new Set<string>();
    for (const [, traceEntry] of this.db.traces) {
      for (const span of Object.values(traceEntry.spans)) {
        if (span.environment) envSet.add(span.environment);
      }
    }
    return { environments: Array.from(envSet).sort() };
  }

  async getTags(args: GetTagsArgs): Promise<GetTagsResponse> {
    const tagSet = new Set<string>();
    for (const [, traceEntry] of this.db.traces) {
      for (const span of Object.values(traceEntry.spans)) {
        if (!span.tags) continue;
        if (args.entityType && span.entityType !== args.entityType) continue;
        for (const tag of span.tags) {
          tagSet.add(tag);
        }
      }
    }
    return { tags: Array.from(tagSet).sort() };
  }

  // ============================================================================
  // Logs
  // ============================================================================

  async batchCreateLogs(args: BatchCreateLogsArgs): Promise<void> {
    for (const log of args.logs) {
      this.db.logRecords.push(log as LogRecord);
    }
  }

  async listLogs(args: ListLogsArgs): Promise<ListLogsResponse> {
    const { filters, pagination, orderBy } = listLogsArgsSchema.parse(args);

    let matching = this.db.logRecords.filter(log => this.logMatchesFilters(log, filters));

    // Sort
    const dir = orderBy.direction === 'DESC' ? -1 : 1;
    matching.sort((a, b) => dir * (a.timestamp.getTime() - b.timestamp.getTime()));

    // Paginate
    const total = matching.length;
    const page = Number(pagination.page);
    const perPage = Number(pagination.perPage);
    const start = page * perPage;

    return {
      logs: matching.slice(start, start + perPage),
      pagination: { total, page, perPage, hasMore: start + perPage < total },
    };
  }

  private logMatchesFilters(log: LogRecord, filters?: ListLogsArgs['filters']): boolean {
    if (!filters) return true;

    if (filters.timestamp) {
      if (
        filters.timestamp.start &&
        (filters.timestamp.startExclusive
          ? log.timestamp <= filters.timestamp.start
          : log.timestamp < filters.timestamp.start)
      ) {
        return false;
      }
      if (
        filters.timestamp.end &&
        (filters.timestamp.endExclusive
          ? log.timestamp >= filters.timestamp.end
          : log.timestamp > filters.timestamp.end)
      ) {
        return false;
      }
    }
    if (filters.level !== undefined) {
      const levels = Array.isArray(filters.level) ? filters.level : [filters.level];
      if (!levels.includes(log.level)) return false;
    }
    if (filters.traceId !== undefined && log.traceId !== filters.traceId) return false;
    if (filters.spanId !== undefined && log.spanId !== filters.spanId) return false;
    if (filters.entityType !== undefined && log.entityType !== filters.entityType) return false;
    if (filters.entityName !== undefined && log.entityName !== filters.entityName) return false;
    if (filters.entityVersionId !== undefined && log.entityVersionId !== filters.entityVersionId) return false;
    if (filters.parentEntityVersionId !== undefined && log.parentEntityVersionId !== filters.parentEntityVersionId)
      return false;
    if (filters.rootEntityVersionId !== undefined && log.rootEntityVersionId !== filters.rootEntityVersionId)
      return false;
    if (filters.userId !== undefined && log.userId !== filters.userId) return false;
    if (filters.organizationId !== undefined && log.organizationId !== filters.organizationId) return false;
    if (filters.resourceId !== undefined && log.resourceId !== filters.resourceId) return false;
    if (filters.runId !== undefined && log.runId !== filters.runId) return false;
    if (filters.sessionId !== undefined && log.sessionId !== filters.sessionId) return false;
    if (filters.threadId !== undefined && log.threadId !== filters.threadId) return false;
    if (filters.requestId !== undefined && log.requestId !== filters.requestId) return false;
    if (filters.parentEntityType !== undefined && log.parentEntityType !== filters.parentEntityType) return false;
    if (filters.parentEntityName !== undefined && log.parentEntityName !== filters.parentEntityName) return false;
    if (filters.rootEntityType !== undefined && log.rootEntityType !== filters.rootEntityType) return false;
    if (filters.rootEntityName !== undefined && log.rootEntityName !== filters.rootEntityName) return false;
    if (filters.serviceName !== undefined && log.serviceName !== filters.serviceName) return false;
    if (filters.environment !== undefined && log.environment !== filters.environment) return false;
    const logExecutionSource = log.executionSource ?? log.source ?? null;
    if (filters.executionSource !== undefined && logExecutionSource !== filters.executionSource) return false;
    if (filters.source !== undefined && logExecutionSource !== filters.source) return false;
    if (filters.experimentId !== undefined && log.experimentId !== filters.experimentId) return false;
    if (filters.tags != null && filters.tags.length > 0) {
      if (log.tags == null) return false;
      for (const tag of filters.tags) {
        if (!log.tags.includes(tag)) return false;
      }
    }

    return true;
  }

  // ============================================================================
  // Scores
  // ============================================================================

  async createScore(args: CreateScoreArgs): Promise<void> {
    const scoreSource = args.score.scoreSource ?? args.score.source ?? null;
    this.db.scoreRecords.push({
      ...args.score,
      scoreSource,
      source: scoreSource,
    } as ScoreRecord);
  }

  async batchCreateScores(args: BatchCreateScoresArgs): Promise<void> {
    for (const score of args.scores) {
      const scoreSource = score.scoreSource ?? score.source ?? null;
      this.db.scoreRecords.push({
        ...score,
        scoreSource,
        source: scoreSource,
      } as ScoreRecord);
    }
  }

  async listScores(args: ListScoresArgs): Promise<ListScoresResponse> {
    const { filters, pagination, orderBy } = listScoresArgsSchema.parse(args);

    let matching = this.db.scoreRecords.filter(score => this.scoreMatchesFilters(score, filters));

    // Sort
    const dir = orderBy.direction === 'DESC' ? -1 : 1;
    if (orderBy.field === 'score') {
      matching.sort((a, b) => dir * (a.score - b.score));
    } else {
      matching.sort((a, b) => dir * (a.timestamp.getTime() - b.timestamp.getTime()));
    }

    // Paginate
    const total = matching.length;
    const page = Number(pagination.page);
    const perPage = Number(pagination.perPage);
    const start = page * perPage;

    return {
      scores: matching.slice(start, start + perPage),
      pagination: { total, page, perPage, hasMore: start + perPage < total },
    };
  }

  async getScoreById(scoreId: string): Promise<ScoreRecord | null> {
    return this.db.scoreRecords.find(score => score.scoreId === scoreId) ?? null;
  }

  private scoreMatchesFilters(score: ScoreRecord, filters?: ListScoresArgs['filters']): boolean {
    if (!filters) return true;

    if (filters.timestamp) {
      if (filters.timestamp.start && score.timestamp < filters.timestamp.start) return false;
      if (filters.timestamp.end && score.timestamp > filters.timestamp.end) return false;
    }
    if (filters.traceId !== undefined && score.traceId !== filters.traceId) return false;
    if (filters.spanId !== undefined && score.spanId !== filters.spanId) return false;
    if (filters.entityType !== undefined && score.entityType !== filters.entityType) return false;
    if (filters.entityName !== undefined && score.entityName !== filters.entityName) return false;
    if (filters.entityVersionId !== undefined && score.entityVersionId !== filters.entityVersionId) return false;
    if (filters.parentEntityVersionId !== undefined && score.parentEntityVersionId !== filters.parentEntityVersionId)
      return false;
    if (filters.rootEntityVersionId !== undefined && score.rootEntityVersionId !== filters.rootEntityVersionId)
      return false;
    if (filters.userId !== undefined && score.userId !== filters.userId) return false;
    if (filters.organizationId !== undefined && score.organizationId !== filters.organizationId) return false;
    if (filters.resourceId !== undefined && score.resourceId !== filters.resourceId) return false;
    if (filters.runId !== undefined && score.runId !== filters.runId) return false;
    if (filters.sessionId !== undefined && score.sessionId !== filters.sessionId) return false;
    if (filters.threadId !== undefined && score.threadId !== filters.threadId) return false;
    if (filters.requestId !== undefined && score.requestId !== filters.requestId) return false;
    if (filters.parentEntityType !== undefined && score.parentEntityType !== filters.parentEntityType) return false;
    if (filters.parentEntityName !== undefined && score.parentEntityName !== filters.parentEntityName) return false;
    if (filters.rootEntityType !== undefined && score.rootEntityType !== filters.rootEntityType) return false;
    if (filters.rootEntityName !== undefined && score.rootEntityName !== filters.rootEntityName) return false;
    if (filters.serviceName !== undefined && score.serviceName !== filters.serviceName) return false;
    if (filters.environment !== undefined && score.environment !== filters.environment) return false;
    if (filters.executionSource !== undefined && score.executionSource !== filters.executionSource) return false;
    if (filters.scorerId !== undefined) {
      const names = Array.isArray(filters.scorerId) ? filters.scorerId : [filters.scorerId];
      if (!names.includes(score.scorerId)) return false;
    }
    const scoreSource = score.scoreSource ?? score.source ?? null;
    if (filters.scoreSource !== undefined && scoreSource !== filters.scoreSource) return false;
    if (filters.source !== undefined && scoreSource !== filters.source) return false;
    if (filters.experimentId !== undefined && score.experimentId !== filters.experimentId) return false;
    if (filters.tags != null && filters.tags.length > 0) {
      if (score.tags == null) return false;
      for (const tag of filters.tags) {
        if (!score.tags.includes(tag)) return false;
      }
    }

    return true;
  }

  async getScoreAggregate(args: GetScoreAggregateArgs): Promise<GetScoreAggregateResponse> {
    const filtered = this.db.scoreRecords
      .filter(score => this.scoreMatchesFilters(score, args.filters))
      .filter(score => score.scorerId === args.scorerId)
      .filter(score => (args.scoreSource ? (score.scoreSource ?? score.source ?? null) === args.scoreSource : true));
    const value = this.aggregate(
      filtered.map(score => score.score),
      args.aggregation,
      filtered.map(score => score.timestamp.getTime()),
    );

    if (args.comparePeriod && args.filters?.timestamp) {
      const previousRange = this.getComparisonDateRange(args.comparePeriod, args.filters.timestamp);
      if (previousRange) {
        const previousFiltered = this.db.scoreRecords
          .filter(score =>
            this.scoreMatchesFilters(score, {
              ...(args.filters ?? {}),
              timestamp: previousRange,
            }),
          )
          .filter(score => score.scorerId === args.scorerId)
          .filter(score =>
            args.scoreSource ? (score.scoreSource ?? score.source ?? null) === args.scoreSource : true,
          );

        const previousValue = this.aggregate(
          previousFiltered.map(score => score.score),
          args.aggregation,
          previousFiltered.map(score => score.timestamp.getTime()),
        );

        let changePercent: number | null = null;
        if (previousValue !== null && previousValue !== 0 && value !== null) {
          changePercent = ((value - previousValue) / Math.abs(previousValue)) * 100;
        }

        return { value, previousValue, changePercent };
      }
    }

    return { value };
  }

  async getScoreBreakdown(args: GetScoreBreakdownArgs): Promise<GetScoreBreakdownResponse> {
    const filtered = this.db.scoreRecords
      .filter(score => this.scoreMatchesFilters(score, args.filters))
      .filter(score => score.scorerId === args.scorerId)
      .filter(score => (args.scoreSource ? (score.scoreSource ?? score.source ?? null) === args.scoreSource : true));

    const groupMap = new Map<string, ScoreRecord[]>();
    for (const score of filtered) {
      const dims: Record<string, string | null> = {};
      for (const col of args.groupBy) {
        const value = (score as Record<string, unknown>)[col];
        dims[col] = value === null || value === undefined ? null : String(value);
      }
      const key = JSON.stringify(dims);
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(score);
    }

    const groups = Array.from(groupMap.entries()).map(([key, records]) => ({
      dimensions: JSON.parse(key) as Record<string, string | null>,
      value:
        this.aggregate(
          records.map(record => record.score),
          args.aggregation,
          records.map(record => record.timestamp.getTime()),
        ) ?? 0,
    }));
    groups.sort((a, b) => b.value - a.value);

    return { groups };
  }

  async getScoreTimeSeries(args: GetScoreTimeSeriesArgs): Promise<GetScoreTimeSeriesResponse> {
    const filtered = this.db.scoreRecords
      .filter(score => this.scoreMatchesFilters(score, args.filters))
      .filter(score => score.scorerId === args.scorerId)
      .filter(score => (args.scoreSource ? (score.scoreSource ?? score.source ?? null) === args.scoreSource : true));
    const intervalMs = this.intervalToMs(args.interval);

    if (args.groupBy && args.groupBy.length > 0) {
      const seriesMap = new Map<string, Map<number, ScoreRecord[]>>();
      const seriesNames = new Map<string, string>();

      for (const score of filtered) {
        const values = args.groupBy.map(col => (score as Record<string, unknown>)[col] ?? '');
        const key = JSON.stringify(values);
        if (!seriesMap.has(key)) seriesMap.set(key, new Map());
        if (!seriesNames.has(key)) {
          seriesNames.set(
            key,
            values.map(value => (value === null || value === undefined ? '' : String(value))).join('|'),
          );
        }
        const bucket = Math.floor(score.timestamp.getTime() / intervalMs) * intervalMs;
        const bucketMap = seriesMap.get(key)!;
        if (!bucketMap.has(bucket)) bucketMap.set(bucket, []);
        bucketMap.get(bucket)!.push(score);
      }

      return {
        series: Array.from(seriesMap.entries()).map(([key, bucketMap]) => ({
          name: seriesNames.get(key)!,
          points: Array.from(bucketMap.entries())
            .sort(([a], [b]) => a - b)
            .map(([ts, records]) => ({
              timestamp: new Date(ts),
              value:
                this.aggregate(
                  records.map(record => record.score),
                  args.aggregation,
                  records.map(record => record.timestamp.getTime()),
                ) ?? 0,
            })),
        })),
      };
    }

    const bucketMap = new Map<number, ScoreRecord[]>();
    for (const score of filtered) {
      const bucket = Math.floor(score.timestamp.getTime() / intervalMs) * intervalMs;
      if (!bucketMap.has(bucket)) bucketMap.set(bucket, []);
      bucketMap.get(bucket)!.push(score);
    }

    return {
      series: [
        {
          name: args.scoreSource ? `${args.scorerId}|${args.scoreSource}` : args.scorerId,
          points: Array.from(bucketMap.entries())
            .sort(([a], [b]) => a - b)
            .map(([ts, records]) => ({
              timestamp: new Date(ts),
              value:
                this.aggregate(
                  records.map(record => record.score),
                  args.aggregation,
                  records.map(record => record.timestamp.getTime()),
                ) ?? 0,
            })),
        },
      ],
    };
  }

  async getScorePercentiles(args: GetScorePercentilesArgs): Promise<GetScorePercentilesResponse> {
    const filtered = this.db.scoreRecords
      .filter(score => this.scoreMatchesFilters(score, args.filters))
      .filter(score => score.scorerId === args.scorerId)
      .filter(score => (args.scoreSource ? (score.scoreSource ?? score.source ?? null) === args.scoreSource : true));
    const intervalMs = this.intervalToMs(args.interval);

    const bucketMap = new Map<number, number[]>();
    for (const score of filtered) {
      const bucket = Math.floor(score.timestamp.getTime() / intervalMs) * intervalMs;
      if (!bucketMap.has(bucket)) bucketMap.set(bucket, []);
      bucketMap.get(bucket)!.push(score.score);
    }

    const sortedBuckets = Array.from(bucketMap.entries()).sort(([a], [b]) => a - b);

    return {
      series: args.percentiles.map(percentile => ({
        percentile,
        points: sortedBuckets.map(([ts, values]) => {
          const sorted = [...values].sort((a, b) => a - b);
          return { timestamp: new Date(ts), value: this.interpolatePercentile(sorted, percentile) };
        }),
      })),
    };
  }

  private getNumericFeedbackValue(value: FeedbackRecord['value']): number | null {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length === 0) return null;
      const numeric = Number(trimmed);
      return Number.isFinite(numeric) ? numeric : null;
    }

    return null;
  }

  private getComparisonDateRange(
    comparePeriod: 'previous_period' | 'previous_day' | 'previous_week',
    timestamp: { start?: Date; end?: Date; startExclusive?: boolean; endExclusive?: boolean },
  ): { start: Date; end: Date; startExclusive?: boolean; endExclusive?: boolean } | null {
    if (!timestamp.start || !timestamp.end) return null;

    const duration = timestamp.end.getTime() - timestamp.start.getTime();
    switch (comparePeriod) {
      case 'previous_period':
        return {
          start: new Date(timestamp.start.getTime() - duration),
          end: new Date(timestamp.end.getTime() - duration),
          startExclusive: timestamp.startExclusive,
          endExclusive: timestamp.endExclusive,
        };
      case 'previous_day':
        return {
          start: new Date(timestamp.start.getTime() - 86_400_000),
          end: new Date(timestamp.end.getTime() - 86_400_000),
          startExclusive: timestamp.startExclusive,
          endExclusive: timestamp.endExclusive,
        };
      case 'previous_week':
        return {
          start: new Date(timestamp.start.getTime() - 604_800_000),
          end: new Date(timestamp.end.getTime() - 604_800_000),
          startExclusive: timestamp.startExclusive,
          endExclusive: timestamp.endExclusive,
        };
    }
  }

  // ============================================================================
  // Feedback
  // ============================================================================

  async createFeedback(args: CreateFeedbackArgs): Promise<void> {
    this.db.feedbackRecords.push({
      ...args.feedback,
      feedbackSource: args.feedback.feedbackSource ?? args.feedback.source ?? '',
      source: args.feedback.feedbackSource ?? args.feedback.source ?? '',
      feedbackUserId:
        args.feedback.feedbackUserId ??
        args.feedback.userId ??
        (typeof args.feedback.metadata?.userId === 'string' ? args.feedback.metadata.userId : null),
    } as FeedbackRecord);
  }

  async batchCreateFeedback(args: BatchCreateFeedbackArgs): Promise<void> {
    for (const fb of args.feedbacks) {
      this.db.feedbackRecords.push({
        ...fb,
        feedbackSource: fb.feedbackSource ?? fb.source ?? '',
        source: fb.feedbackSource ?? fb.source ?? '',
        feedbackUserId:
          fb.feedbackUserId ?? fb.userId ?? (typeof fb.metadata?.userId === 'string' ? fb.metadata.userId : null),
      } as FeedbackRecord);
    }
  }

  async listFeedback(args: ListFeedbackArgs): Promise<ListFeedbackResponse> {
    const { filters, pagination, orderBy } = listFeedbackArgsSchema.parse(args);

    let matching = this.db.feedbackRecords.filter(fb => this.feedbackMatchesFilters(fb, filters));

    // Sort
    const dir = orderBy.direction === 'DESC' ? -1 : 1;
    matching.sort((a, b) => dir * (a.timestamp.getTime() - b.timestamp.getTime()));

    // Paginate
    const total = matching.length;
    const page = Number(pagination.page);
    const perPage = Number(pagination.perPage);
    const start = page * perPage;

    return {
      feedback: matching.slice(start, start + perPage),
      pagination: { total, page, perPage, hasMore: start + perPage < total },
    };
  }

  async getFeedbackAggregate(args: GetFeedbackAggregateArgs): Promise<GetFeedbackAggregateResponse> {
    const filtered = this.db.feedbackRecords
      .filter(feedback => this.feedbackMatchesFilters(feedback, args.filters))
      .filter(feedback => feedback.feedbackType === args.feedbackType)
      .filter(feedback =>
        args.feedbackSource ? (feedback.feedbackSource ?? feedback.source ?? '') === args.feedbackSource : true,
      );
    const numericEntries = filtered.flatMap(feedback => {
      const numericValue = this.getNumericFeedbackValue(feedback.value);
      return numericValue === null ? [] : [{ numericValue, timestamp: feedback.timestamp.getTime() }];
    });
    const value = this.aggregate(
      numericEntries.map(entry => entry.numericValue),
      args.aggregation,
      numericEntries.map(entry => entry.timestamp),
    );

    if (args.comparePeriod && args.filters?.timestamp) {
      const previousRange = this.getComparisonDateRange(args.comparePeriod, args.filters.timestamp);
      if (previousRange) {
        const previousNumericEntries = this.db.feedbackRecords
          .filter(feedback =>
            this.feedbackMatchesFilters(feedback, {
              ...(args.filters ?? {}),
              timestamp: previousRange,
            }),
          )
          .filter(feedback => feedback.feedbackType === args.feedbackType)
          .filter(feedback =>
            args.feedbackSource ? (feedback.feedbackSource ?? feedback.source ?? '') === args.feedbackSource : true,
          )
          .flatMap(feedback => {
            const numericValue = this.getNumericFeedbackValue(feedback.value);
            return numericValue === null ? [] : [{ numericValue, timestamp: feedback.timestamp.getTime() }];
          });

        const previousValue = this.aggregate(
          previousNumericEntries.map(entry => entry.numericValue),
          args.aggregation,
          previousNumericEntries.map(entry => entry.timestamp),
        );
        let changePercent: number | null = null;
        if (previousValue !== null && previousValue !== 0 && value !== null) {
          changePercent = ((value - previousValue) / Math.abs(previousValue)) * 100;
        }

        return { value, previousValue, changePercent };
      }
    }

    return { value };
  }

  async getFeedbackBreakdown(args: GetFeedbackBreakdownArgs): Promise<GetFeedbackBreakdownResponse> {
    const filtered = this.db.feedbackRecords
      .filter(feedback => this.feedbackMatchesFilters(feedback, args.filters))
      .filter(feedback => feedback.feedbackType === args.feedbackType)
      .filter(feedback =>
        args.feedbackSource ? (feedback.feedbackSource ?? feedback.source ?? '') === args.feedbackSource : true,
      )
      .filter(feedback => this.getNumericFeedbackValue(feedback.value) !== null);

    const groupMap = new Map<string, FeedbackRecord[]>();
    for (const feedback of filtered) {
      const dims: Record<string, string | null> = {};
      for (const col of args.groupBy) {
        const rawValue = (feedback as Record<string, unknown>)[col];
        dims[col] = rawValue === null || rawValue === undefined ? null : String(rawValue);
      }
      const key = JSON.stringify(dims);
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(feedback);
    }

    const groups = Array.from(groupMap.entries()).map(([key, records]) => ({
      dimensions: JSON.parse(key) as Record<string, string | null>,
      value: (() => {
        const numericEntries = records.flatMap(record => {
          const numericValue = this.getNumericFeedbackValue(record.value);
          return numericValue === null ? [] : [{ numericValue, timestamp: record.timestamp.getTime() }];
        });

        return (
          this.aggregate(
            numericEntries.map(entry => entry.numericValue),
            args.aggregation,
            numericEntries.map(entry => entry.timestamp),
          ) ?? 0
        );
      })(),
    }));
    groups.sort((a, b) => b.value - a.value);

    return { groups };
  }

  async getFeedbackTimeSeries(args: GetFeedbackTimeSeriesArgs): Promise<GetFeedbackTimeSeriesResponse> {
    const filtered = this.db.feedbackRecords
      .filter(feedback => this.feedbackMatchesFilters(feedback, args.filters))
      .filter(feedback => feedback.feedbackType === args.feedbackType)
      .filter(feedback =>
        args.feedbackSource ? (feedback.feedbackSource ?? feedback.source ?? '') === args.feedbackSource : true,
      )
      .filter(feedback => this.getNumericFeedbackValue(feedback.value) !== null);
    const intervalMs = this.intervalToMs(args.interval);

    if (args.groupBy && args.groupBy.length > 0) {
      const seriesMap = new Map<string, Map<number, FeedbackRecord[]>>();
      const seriesNames = new Map<string, string>();

      for (const feedback of filtered) {
        const values = args.groupBy.map(col => (feedback as Record<string, unknown>)[col] ?? '');
        const key = JSON.stringify(values);
        if (!seriesMap.has(key)) seriesMap.set(key, new Map());
        if (!seriesNames.has(key)) {
          seriesNames.set(
            key,
            values.map(value => (value === null || value === undefined ? '' : String(value))).join('|'),
          );
        }
        const bucket = Math.floor(feedback.timestamp.getTime() / intervalMs) * intervalMs;
        const bucketMap = seriesMap.get(key)!;
        if (!bucketMap.has(bucket)) bucketMap.set(bucket, []);
        bucketMap.get(bucket)!.push(feedback);
      }

      return {
        series: Array.from(seriesMap.entries()).map(([key, bucketMap]) => ({
          name: seriesNames.get(key)!,
          points: Array.from(bucketMap.entries())
            .sort(([a], [b]) => a - b)
            .map(([ts, records]) => ({
              timestamp: new Date(ts),
              value: (() => {
                const numericEntries = records.flatMap(record => {
                  const numericValue = this.getNumericFeedbackValue(record.value);
                  return numericValue === null ? [] : [{ numericValue, timestamp: record.timestamp.getTime() }];
                });

                return (
                  this.aggregate(
                    numericEntries.map(entry => entry.numericValue),
                    args.aggregation,
                    numericEntries.map(entry => entry.timestamp),
                  ) ?? 0
                );
              })(),
            })),
        })),
      };
    }

    const bucketMap = new Map<number, FeedbackRecord[]>();
    for (const feedback of filtered) {
      const bucket = Math.floor(feedback.timestamp.getTime() / intervalMs) * intervalMs;
      if (!bucketMap.has(bucket)) bucketMap.set(bucket, []);
      bucketMap.get(bucket)!.push(feedback);
    }

    return {
      series: [
        {
          name: args.feedbackSource ? `${args.feedbackType}|${args.feedbackSource}` : args.feedbackType,
          points: Array.from(bucketMap.entries())
            .sort(([a], [b]) => a - b)
            .map(([ts, records]) => ({
              timestamp: new Date(ts),
              value: (() => {
                const numericEntries = records.flatMap(record => {
                  const numericValue = this.getNumericFeedbackValue(record.value);
                  return numericValue === null ? [] : [{ numericValue, timestamp: record.timestamp.getTime() }];
                });

                return (
                  this.aggregate(
                    numericEntries.map(entry => entry.numericValue),
                    args.aggregation,
                    numericEntries.map(entry => entry.timestamp),
                  ) ?? 0
                );
              })(),
            })),
        },
      ],
    };
  }

  async getFeedbackPercentiles(args: GetFeedbackPercentilesArgs): Promise<GetFeedbackPercentilesResponse> {
    const filtered = this.db.feedbackRecords
      .filter(feedback => this.feedbackMatchesFilters(feedback, args.filters))
      .filter(feedback => feedback.feedbackType === args.feedbackType)
      .filter(feedback =>
        args.feedbackSource ? (feedback.feedbackSource ?? feedback.source ?? '') === args.feedbackSource : true,
      );
    const intervalMs = this.intervalToMs(args.interval);

    const bucketMap = new Map<number, number[]>();
    for (const feedback of filtered) {
      const numericValue = this.getNumericFeedbackValue(feedback.value);
      if (numericValue === null) continue;
      const bucket = Math.floor(feedback.timestamp.getTime() / intervalMs) * intervalMs;
      if (!bucketMap.has(bucket)) bucketMap.set(bucket, []);
      bucketMap.get(bucket)!.push(numericValue);
    }

    const sortedBuckets = Array.from(bucketMap.entries()).sort(([a], [b]) => a - b);

    return {
      series: args.percentiles.map(percentile => ({
        percentile,
        points: sortedBuckets.map(([ts, values]) => {
          const sorted = [...values].sort((a, b) => a - b);
          return { timestamp: new Date(ts), value: this.interpolatePercentile(sorted, percentile) };
        }),
      })),
    };
  }

  private feedbackMatchesFilters(fb: FeedbackRecord, filters?: FeedbackFilter): boolean {
    if (!filters) return true;

    if (filters.timestamp) {
      if (filters.timestamp.start && fb.timestamp < filters.timestamp.start) return false;
      if (filters.timestamp.end && fb.timestamp > filters.timestamp.end) return false;
    }
    if (filters.traceId !== undefined && fb.traceId !== filters.traceId) return false;
    if (filters.spanId !== undefined && fb.spanId !== filters.spanId) return false;
    if (filters.entityType !== undefined && fb.entityType !== filters.entityType) return false;
    if (filters.entityName !== undefined && fb.entityName !== filters.entityName) return false;
    if (filters.entityVersionId !== undefined && fb.entityVersionId !== filters.entityVersionId) return false;
    if (filters.parentEntityVersionId !== undefined && fb.parentEntityVersionId !== filters.parentEntityVersionId)
      return false;
    if (filters.rootEntityVersionId !== undefined && fb.rootEntityVersionId !== filters.rootEntityVersionId)
      return false;
    if (filters.userId !== undefined && fb.userId !== filters.userId) return false;
    if (filters.organizationId !== undefined && fb.organizationId !== filters.organizationId) return false;
    if (filters.resourceId !== undefined && fb.resourceId !== filters.resourceId) return false;
    if (filters.runId !== undefined && fb.runId !== filters.runId) return false;
    if (filters.sessionId !== undefined && fb.sessionId !== filters.sessionId) return false;
    if (filters.threadId !== undefined && fb.threadId !== filters.threadId) return false;
    if (filters.requestId !== undefined && fb.requestId !== filters.requestId) return false;
    if (filters.parentEntityType !== undefined && fb.parentEntityType !== filters.parentEntityType) return false;
    if (filters.parentEntityName !== undefined && fb.parentEntityName !== filters.parentEntityName) return false;
    if (filters.rootEntityType !== undefined && fb.rootEntityType !== filters.rootEntityType) return false;
    if (filters.rootEntityName !== undefined && fb.rootEntityName !== filters.rootEntityName) return false;
    if (filters.serviceName !== undefined && fb.serviceName !== filters.serviceName) return false;
    if (filters.environment !== undefined && fb.environment !== filters.environment) return false;
    if (filters.executionSource !== undefined && fb.executionSource !== filters.executionSource) return false;
    if (filters.feedbackType !== undefined) {
      const types = Array.isArray(filters.feedbackType) ? filters.feedbackType : [filters.feedbackType];
      if (!types.includes(fb.feedbackType)) return false;
    }
    const feedbackSource = fb.feedbackSource ?? fb.source ?? '';
    if (filters.feedbackSource !== undefined && feedbackSource !== filters.feedbackSource) return false;
    if (filters.source !== undefined && feedbackSource !== filters.source) return false;
    if (filters.experimentId !== undefined && fb.experimentId !== filters.experimentId) return false;
    if (filters.feedbackUserId !== undefined && fb.feedbackUserId !== filters.feedbackUserId) return false;
    if (filters.tags != null && filters.tags.length > 0) {
      if (fb.tags == null) return false;
      for (const tag of filters.tags) {
        if (!fb.tags.includes(tag)) return false;
      }
    }

    return true;
  }
}
