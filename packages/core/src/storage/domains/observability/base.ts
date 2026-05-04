import { ErrorCategory, ErrorDomain, MastraError } from '../../../error';
import { StorageDomain } from '../base';
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
import type {
  BatchCreateFeedbackArgs,
  CreateFeedbackArgs,
  ListFeedbackArgs,
  ListFeedbackResponse,
  GetFeedbackAggregateArgs,
  GetFeedbackAggregateResponse,
  GetFeedbackBreakdownArgs,
  GetFeedbackBreakdownResponse,
  GetFeedbackTimeSeriesArgs,
  GetFeedbackTimeSeriesResponse,
  GetFeedbackPercentilesArgs,
  GetFeedbackPercentilesResponse,
} from './feedback';
import type { BatchCreateLogsArgs, ListLogsArgs, ListLogsResponse } from './logs';
import type {
  BatchCreateMetricsArgs,
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
} from './metrics';
import type {
  BatchCreateScoresArgs,
  CreateScoreArgs,
  ListScoresArgs,
  ListScoresResponse,
  ScoreRecord,
  GetScoreAggregateArgs,
  GetScoreAggregateResponse,
  GetScoreBreakdownArgs,
  GetScoreBreakdownResponse,
  GetScoreTimeSeriesArgs,
  GetScoreTimeSeriesResponse,
  GetScorePercentilesArgs,
  GetScorePercentilesResponse,
} from './scores';
import type {
  BatchCreateSpansArgs,
  BatchDeleteTracesArgs,
  BatchUpdateSpansArgs,
  CreateSpanArgs,
  GetBranchArgs,
  GetBranchResponse,
  GetRootSpanArgs,
  GetRootSpanResponse,
  GetSpanArgs,
  GetSpanResponse,
  GetSpansArgs,
  GetSpansResponse,
  GetStructureResponse,
  GetTraceArgs,
  GetTraceResponse,
  GetTraceLightResponse,
  ListBranchesArgs,
  ListBranchesResponse,
  ListTracesArgs,
  ListTracesResponse,
  UpdateSpanArgs,
} from './tracing';
import { extractBranchSpans, getBranchArgsSchema } from './tracing';
import type { ObservabilityStorageStrategy, TracingStorageStrategy } from './types';

/**
 * Base storage class for observability data (traces, metrics, logs, scores, feedback).
 * Not abstract -- provides default implementations that throw "not implemented" errors.
 * Storage adapters override only the methods they support.
 */
export class ObservabilityStorage extends StorageDomain {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'OBSERVABILITY',
    });
  }

  async dangerouslyClearAll(): Promise<void> {
    // Default no-op - subclasses override
  }

  /**
   * Provides hints for tracing strategy selection by the DefaultExporter.
   * Storage adapters can override this to specify their preferred and supported strategies.
   */
  public get observabilityStrategy(): {
    preferred: ObservabilityStorageStrategy;
    supported: ObservabilityStorageStrategy[];
  } {
    return {
      preferred: 'batch-with-updates', // Default for most SQL stores
      supported: ['realtime', 'batch-with-updates', 'insert-only'],
    };
  }

  /**
   * Provides hints for tracing strategy selection by the DefaultExporter.
   * Storage adapters can override this to specify their preferred and supported strategies.
   * @deprecated Use {@link observabilityStrategy} instead.
   * @see {@link observabilityStrategy} for the replacement property.
   */
  public get tracingStrategy(): {
    preferred: TracingStorageStrategy;
    supported: TracingStorageStrategy[];
  } {
    return this.observabilityStrategy;
  }

  /**
   * Reports the tracing strategy currently in effect for this attached observability store.
   *
   * Single-strategy stores can rely on the default implementation. Multi-strategy stores
   * should override this getter only when they can determine the actual configured mode
   * from storage-owned configuration, not exporter state.
   */
  public get runtimeTracingStrategy(): TracingStorageStrategy | undefined {
    const supportedStrategies = this.observabilityStrategy.supported;
    return supportedStrategies.length === 1 ? supportedStrategies[0] : undefined;
  }

  /**
   * Creates a single Span record in the storage provider.
   */
  async createSpan(_args: CreateSpanArgs): Promise<void> {
    throw new MastraError({
      id: 'OBSERVABILITY_CREATE_SPAN_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support creating spans',
    });
  }

  /**
   * Updates a single Span with partial data. Primarily used for realtime trace creation.
   *
   * @deprecated This method only works with stores that support span updates,
   * It will be removed in the future. Instead try to add all data to a span before
   * ending it.
   */
  async updateSpan(_args: UpdateSpanArgs): Promise<void> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_UPDATE_SPAN_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support updating spans',
    });
  }

  /**
   * Retrieves a single span.
   */
  async getSpan(_args: GetSpanArgs): Promise<GetSpanResponse | null> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_GET_SPAN_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support getting spans',
    });
  }

  /**
   * Retrieves a single root span.
   */
  async getRootSpan(_args: GetRootSpanArgs): Promise<GetRootSpanResponse | null> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_GET_ROOT_SPAN_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support getting root spans',
    });
  }

  /**
   * Retrieves a single trace with all its associated spans.
   */
  async getTrace(_args: GetTraceArgs): Promise<GetTraceResponse | null> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_GET_TRACE_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support getting traces',
    });
  }

  /**
   * Retrieves the structural skeleton of a trace -- parent/child links, span
   * type, timing, and status -- with heavy fields (input, output, attributes,
   * metadata, tags, links) excluded. Intended for waterfall/timeline rendering
   * where the full payload would be wasteful.
   *
   * Default implementation forwards to {@link getTraceLight} (the legacy
   * override surface). Backends should override either method -- the response
   * shape is identical, and the unimplemented one delegates to the
   * implemented one. The cycle guard is what makes that safe.
   */
  async getStructure(args: GetTraceArgs): Promise<GetStructureResponse | null> {
    if (this.getTraceLight === ObservabilityStorage.prototype.getTraceLight) {
      throw new MastraError({
        id: 'OBSERVABILITY_STORAGE_GET_STRUCTURE_NOT_IMPLEMENTED',
        domain: ErrorDomain.MASTRA_OBSERVABILITY,
        category: ErrorCategory.SYSTEM,
        text: 'This storage provider does not support getting trace structure',
      });
    }
    return this.getTraceLight(args);
  }

  /**
   * @deprecated Use {@link getStructure} instead. Default implementation
   * forwards to {@link getStructure} so backends that only override the
   * canonical name still work for legacy callers.
   */
  async getTraceLight(args: GetTraceArgs): Promise<GetTraceLightResponse | null> {
    if (this.getStructure === ObservabilityStorage.prototype.getStructure) {
      throw new MastraError({
        id: 'OBSERVABILITY_STORAGE_GET_TRACE_LIGHT_NOT_IMPLEMENTED',
        domain: ErrorDomain.MASTRA_OBSERVABILITY,
        category: ErrorCategory.SYSTEM,
        text: 'This storage provider does not support getting lightweight traces',
      });
    }
    return this.getStructure(args);
  }

  /**
   * Retrieves the subtree of spans rooted at a given span, optionally bounded
   * to `depth` levels of descendants.
   *
   * Default implementation prefers a two-step path: fetch the lightweight
   * structure to determine which spans belong to the branch, then batch-fetch
   * only those with full data. This avoids pulling the entire trace when the
   * branch is a small slice of a large trace. Backends that don't yet
   * implement {@link getStructure} or {@link getSpans} fall back to fetching
   * the full trace and walking it in memory.
   */
  async getBranch(args: GetBranchArgs): Promise<GetBranchResponse | null> {
    const parsed = getBranchArgsSchema.parse(args);

    // Optimized path: skeleton walk → batch fetch the branch's spans.
    try {
      const skeleton = await this.getStructure({ traceId: parsed.traceId });
      if (!skeleton) return null;
      const branchSpanIds = extractBranchSpans(skeleton.spans, parsed.spanId, parsed.depth).map(s => s.spanId);
      if (branchSpanIds.length === 0) return null;
      const { spans } = await this.getSpans({ traceId: parsed.traceId, spanIds: branchSpanIds });
      if (spans.length === 0) return null;
      spans.sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
      return { traceId: parsed.traceId, spans };
    } catch (error) {
      const isFallbackTrigger =
        error instanceof MastraError &&
        (error.id === 'OBSERVABILITY_STORAGE_GET_STRUCTURE_NOT_IMPLEMENTED' ||
          error.id === 'OBSERVABILITY_STORAGE_GET_TRACE_LIGHT_NOT_IMPLEMENTED' ||
          error.id === 'OBSERVABILITY_STORAGE_GET_SPANS_NOT_IMPLEMENTED');
      if (!isFallbackTrigger) throw error;
    }

    // Fallback: pull the whole trace, walk in memory.
    const trace = await this.getTrace({ traceId: parsed.traceId });
    if (!trace) return null;
    const spans = extractBranchSpans(trace.spans, parsed.spanId, parsed.depth);
    if (spans.length === 0) return null;
    return { traceId: parsed.traceId, spans };
  }

  /**
   * Batch-fetches spans by spanId within a single trace. Used by the
   * optimized {@link getBranch} path to fetch only the spans that belong to
   * the requested branch (after walking the lightweight structure to identify
   * them) instead of pulling the entire trace.
   */
  async getSpans(_args: GetSpansArgs): Promise<GetSpansResponse> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_GET_SPANS_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support batch-fetching spans',
    });
  }

  /**
   * Retrieves a list of traces with optional filtering.
   */
  async listTraces(_args: ListTracesArgs): Promise<ListTracesResponse> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_LIST_TRACES_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support listing traces',
    });
  }

  /**
   * Lists trace branches across all traces. Unlike {@link listTraces} (which
   * returns one row per root-rooted trace), each row here is a single branch
   * anchor span, including ones nested under a different root entity -- useful
   * for "show me every run of agent X" regardless of caller. Pairs with
   * {@link getBranch} to expand a single branch into its subtree.
   */
  async listBranches(_args: ListBranchesArgs): Promise<ListBranchesResponse> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_LIST_BRANCHES_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support listing trace branches',
    });
  }

  /**
   * Creates multiple Spans in a single batch.
   */
  async batchCreateSpans(_args: BatchCreateSpansArgs): Promise<void> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_BATCH_CREATE_SPAN_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support batch creating spans',
    });
  }

  /**
   * Updates multiple Spans in a single batch.
   */
  async batchUpdateSpans(_args: BatchUpdateSpansArgs): Promise<void> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_BATCH_UPDATE_SPANS_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support batch updating spans',
    });
  }

  /**
   * Deletes multiple traces and all their associated spans in a single batch operation.
   */
  async batchDeleteTraces(_args: BatchDeleteTracesArgs): Promise<void> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_BATCH_DELETE_TRACES_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support batch deleting traces',
    });
  }

  // ============================================================================
  // Logs
  // ============================================================================

  /**
   * Creates multiple log records in a single batch.
   */
  async batchCreateLogs(_args: BatchCreateLogsArgs): Promise<void> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_BATCH_CREATE_LOGS_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support batch creating logs',
    });
  }

  /**
   * Retrieves a list of logs with optional filtering.
   */
  async listLogs(_args: ListLogsArgs): Promise<ListLogsResponse> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_LIST_LOGS_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support listing logs',
    });
  }

  // ============================================================================
  // Metrics
  // ============================================================================

  /**
   * Creates multiple metric observations in a single batch.
   */
  async batchCreateMetrics(_args: BatchCreateMetricsArgs): Promise<void> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_BATCH_CREATE_METRICS_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support batch creating metrics',
    });
  }

  async listMetrics(_args: ListMetricsArgs): Promise<ListMetricsResponse> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_LIST_METRICS_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support listing metrics',
    });
  }

  async getMetricAggregate(_args: GetMetricAggregateArgs): Promise<GetMetricAggregateResponse> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_GET_METRIC_AGGREGATE_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support metric aggregation',
    });
  }

  async getMetricBreakdown(_args: GetMetricBreakdownArgs): Promise<GetMetricBreakdownResponse> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_GET_METRIC_BREAKDOWN_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support metric breakdown',
    });
  }

  async getMetricTimeSeries(_args: GetMetricTimeSeriesArgs): Promise<GetMetricTimeSeriesResponse> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_GET_METRIC_TIME_SERIES_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support metric time series',
    });
  }

  async getMetricPercentiles(_args: GetMetricPercentilesArgs): Promise<GetMetricPercentilesResponse> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_GET_METRIC_PERCENTILES_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support metric percentiles',
    });
  }

  // ============================================================================
  // Discovery / Metadata Methods
  // ============================================================================

  async getMetricNames(_args: GetMetricNamesArgs): Promise<GetMetricNamesResponse> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_GET_METRIC_NAMES_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support metric name discovery',
    });
  }

  async getMetricLabelKeys(_args: GetMetricLabelKeysArgs): Promise<GetMetricLabelKeysResponse> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_GET_METRIC_LABEL_KEYS_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support metric label key discovery',
    });
  }

  async getMetricLabelValues(_args: GetMetricLabelValuesArgs): Promise<GetMetricLabelValuesResponse> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_GET_LABEL_VALUES_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support label value discovery',
    });
  }

  async getEntityTypes(_args: GetEntityTypesArgs): Promise<GetEntityTypesResponse> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_GET_ENTITY_TYPES_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support entity type discovery',
    });
  }

  async getEntityNames(_args: GetEntityNamesArgs): Promise<GetEntityNamesResponse> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_GET_ENTITY_NAMES_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support entity name discovery',
    });
  }

  async getServiceNames(_args: GetServiceNamesArgs): Promise<GetServiceNamesResponse> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_GET_SERVICE_NAMES_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support service name discovery',
    });
  }

  async getEnvironments(_args: GetEnvironmentsArgs): Promise<GetEnvironmentsResponse> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_GET_ENVIRONMENTS_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support environment discovery',
    });
  }

  async getTags(_args: GetTagsArgs): Promise<GetTagsResponse> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_GET_TAGS_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support tag discovery',
    });
  }

  // ============================================================================
  // Scores
  // ============================================================================

  /**
   * Creates a single score record.
   */
  async createScore(_args: CreateScoreArgs): Promise<void> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_CREATE_SCORE_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support creating scores',
    });
  }

  /**
   * Creates multiple score observations in a single batch.
   */
  async batchCreateScores(_args: BatchCreateScoresArgs): Promise<void> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_BATCH_CREATE_SCORES_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support batch creating scores',
    });
  }

  /**
   * Retrieves a list of scores with optional filtering.
   */
  async listScores(_args: ListScoresArgs): Promise<ListScoresResponse> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_LIST_SCORES_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support listing scores',
    });
  }

  /**
   * Retrieves a single score by its score ID.
   */
  async getScoreById(_scoreId: string): Promise<ScoreRecord | null> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_GET_SCORE_BY_ID_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support getting scores by ID',
    });
  }

  async getScoreAggregate(_args: GetScoreAggregateArgs): Promise<GetScoreAggregateResponse> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_GET_SCORE_AGGREGATE_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support score aggregation',
    });
  }

  async getScoreBreakdown(_args: GetScoreBreakdownArgs): Promise<GetScoreBreakdownResponse> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_GET_SCORE_BREAKDOWN_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support score breakdown',
    });
  }

  async getScoreTimeSeries(_args: GetScoreTimeSeriesArgs): Promise<GetScoreTimeSeriesResponse> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_GET_SCORE_TIME_SERIES_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support score time series',
    });
  }

  async getScorePercentiles(_args: GetScorePercentilesArgs): Promise<GetScorePercentilesResponse> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_GET_SCORE_PERCENTILES_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support score percentiles',
    });
  }

  // ============================================================================
  // Feedback
  // ============================================================================

  /**
   * Creates a single feedback record.
   */
  async createFeedback(_args: CreateFeedbackArgs): Promise<void> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_CREATE_FEEDBACK_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support creating feedback',
    });
  }

  /**
   * Creates multiple feedback observations in a single batch.
   */
  async batchCreateFeedback(_args: BatchCreateFeedbackArgs): Promise<void> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_BATCH_CREATE_FEEDBACK_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support batch creating feedback',
    });
  }

  /**
   * Retrieves a list of feedback with optional filtering.
   */
  async listFeedback(_args: ListFeedbackArgs): Promise<ListFeedbackResponse> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_LIST_FEEDBACK_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support listing feedback',
    });
  }

  async getFeedbackAggregate(_args: GetFeedbackAggregateArgs): Promise<GetFeedbackAggregateResponse> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_GET_FEEDBACK_AGGREGATE_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support feedback aggregation',
    });
  }

  async getFeedbackBreakdown(_args: GetFeedbackBreakdownArgs): Promise<GetFeedbackBreakdownResponse> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_GET_FEEDBACK_BREAKDOWN_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support feedback breakdown',
    });
  }

  async getFeedbackTimeSeries(_args: GetFeedbackTimeSeriesArgs): Promise<GetFeedbackTimeSeriesResponse> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_GET_FEEDBACK_TIME_SERIES_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support feedback time series',
    });
  }

  async getFeedbackPercentiles(_args: GetFeedbackPercentilesArgs): Promise<GetFeedbackPercentilesResponse> {
    throw new MastraError({
      id: 'OBSERVABILITY_STORAGE_GET_FEEDBACK_PERCENTILES_NOT_IMPLEMENTED',
      domain: ErrorDomain.MASTRA_OBSERVABILITY,
      category: ErrorCategory.SYSTEM,
      text: 'This storage provider does not support feedback percentiles',
    });
  }
}
