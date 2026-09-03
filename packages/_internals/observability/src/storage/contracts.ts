import type {
  GetEntityNamesArgs,
  GetEntityNamesResponse,
  GetEntityTypesArgs,
  GetEntityTypesResponse,
  GetEnvironmentsArgs,
  GetEnvironmentsResponse,
  GetMetricLabelKeysArgs,
  GetMetricLabelKeysResponse,
  GetMetricLabelValuesArgs,
  GetMetricLabelValuesResponse,
  GetMetricNamesArgs,
  GetMetricNamesResponse,
  GetServiceNamesArgs,
  GetServiceNamesResponse,
  GetTagsArgs,
  GetTagsResponse,
} from './discovery';
import type {
  BatchCreateFeedbackArgs,
  CreateFeedbackArgs,
  FeedbackRecord,
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
  UpdateFeedbackReviewStatusArgs,
} from './feedback';
import type {
  BatchCreateLogsArgs,
  ListLogsArgs,
  ListLogsResponse,
} from './logs';
import type {
  BatchCreateMetricsArgs,
  GetMetricAggregateArgs,
  GetMetricAggregateResponse,
  GetMetricBreakdownArgs,
  GetMetricBreakdownResponse,
  GetMetricPercentilesArgs,
  GetMetricPercentilesResponse,
  GetMetricTimeSeriesArgs,
  GetMetricTimeSeriesResponse,
  ListMetricsArgs,
  ListMetricsResponse,
} from './metrics';
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
  GetTraceLightResponse,
  GetTraceResponse,
  ListBranchesArgs,
  ListBranchesResponse,
  ListTracesArgs,
  ListTracesLightResponse,
  ListTracesResponse,
  UpdateSpanArgs,
} from './tracing';
import type { ObservabilityStorageStrategy, TracingStorageStrategy } from './types';

export type ObservabilityStorageFeature = 'delta-polling' | 'metrics' | 'logs';

/** Structural contract shared by observability exporters and storage adapters. */
export interface ObservabilityStorageContract {
  readonly observabilityStrategy: {
    preferred: ObservabilityStorageStrategy;
    supported: ObservabilityStorageStrategy[];
  };
  readonly tracingStrategy: {
    preferred: TracingStorageStrategy;
    supported: TracingStorageStrategy[];
  };
  readonly runtimeTracingStrategy: TracingStorageStrategy | undefined;
  dangerouslyClearAll(): Promise<void>;
  getFeatures(): readonly ObservabilityStorageFeature[] | undefined;
  createSpan(args: CreateSpanArgs): Promise<void>;
  updateSpan(args: UpdateSpanArgs): Promise<void>;
  getSpan(args: GetSpanArgs): Promise<GetSpanResponse | null>;
  getRootSpan(args: GetRootSpanArgs): Promise<GetRootSpanResponse | null>;
  getTrace(args: GetTraceArgs): Promise<GetTraceResponse | null>;
  getStructure(args: GetTraceArgs): Promise<GetStructureResponse | null>;
  getTraceLight(args: GetTraceArgs): Promise<GetTraceLightResponse | null>;
  getBranch(args: GetBranchArgs): Promise<GetBranchResponse | null>;
  getSpans(args: GetSpansArgs): Promise<GetSpansResponse>;
  listTraces(args: ListTracesArgs): Promise<ListTracesResponse>;
  listTracesLight(args: ListTracesArgs): Promise<ListTracesLightResponse>;
  listBranches(args: ListBranchesArgs): Promise<ListBranchesResponse>;
  batchCreateSpans(args: BatchCreateSpansArgs): Promise<void>;
  batchUpdateSpans(args: BatchUpdateSpansArgs): Promise<void>;
  batchDeleteTraces(args: BatchDeleteTracesArgs): Promise<void>;
  batchCreateLogs(args: BatchCreateLogsArgs): Promise<void>;
  listLogs(args: ListLogsArgs): Promise<ListLogsResponse>;
  batchCreateMetrics(args: BatchCreateMetricsArgs): Promise<void>;
  listMetrics(args: ListMetricsArgs): Promise<ListMetricsResponse>;
  getMetricAggregate(args: GetMetricAggregateArgs): Promise<GetMetricAggregateResponse>;
  getMetricBreakdown(args: GetMetricBreakdownArgs): Promise<GetMetricBreakdownResponse>;
  getMetricTimeSeries(args: GetMetricTimeSeriesArgs): Promise<GetMetricTimeSeriesResponse>;
  getMetricPercentiles(args: GetMetricPercentilesArgs): Promise<GetMetricPercentilesResponse>;
  getMetricNames(args: GetMetricNamesArgs): Promise<GetMetricNamesResponse>;
  getMetricLabelKeys(args: GetMetricLabelKeysArgs): Promise<GetMetricLabelKeysResponse>;
  getMetricLabelValues(args: GetMetricLabelValuesArgs): Promise<GetMetricLabelValuesResponse>;
  getEntityTypes(args: GetEntityTypesArgs): Promise<GetEntityTypesResponse>;
  getEntityNames(args: GetEntityNamesArgs): Promise<GetEntityNamesResponse>;
  getServiceNames(args: GetServiceNamesArgs): Promise<GetServiceNamesResponse>;
  getEnvironments(args: GetEnvironmentsArgs): Promise<GetEnvironmentsResponse>;
  getTags(args: GetTagsArgs): Promise<GetTagsResponse>;
  createScore(args: CreateScoreArgs): Promise<void>;
  batchCreateScores(args: BatchCreateScoresArgs): Promise<void>;
  listScores(args: ListScoresArgs): Promise<ListScoresResponse>;
  getScoreById(scoreId: string): Promise<ScoreRecord | null>;
  getScoreAggregate(args: GetScoreAggregateArgs): Promise<GetScoreAggregateResponse>;
  getScoreBreakdown(args: GetScoreBreakdownArgs): Promise<GetScoreBreakdownResponse>;
  getScoreTimeSeries(args: GetScoreTimeSeriesArgs): Promise<GetScoreTimeSeriesResponse>;
  getScorePercentiles(args: GetScorePercentilesArgs): Promise<GetScorePercentilesResponse>;
  createFeedback(args: CreateFeedbackArgs): Promise<void>;
  batchCreateFeedback(args: BatchCreateFeedbackArgs): Promise<void>;
  listFeedback(args: ListFeedbackArgs): Promise<ListFeedbackResponse>;
  updateFeedbackReviewStatus(args: UpdateFeedbackReviewStatusArgs): Promise<FeedbackRecord>;
  getFeedbackAggregate(args: GetFeedbackAggregateArgs): Promise<GetFeedbackAggregateResponse>;
  getFeedbackBreakdown(args: GetFeedbackBreakdownArgs): Promise<GetFeedbackBreakdownResponse>;
  getFeedbackTimeSeries(args: GetFeedbackTimeSeriesArgs): Promise<GetFeedbackTimeSeriesResponse>;
  getFeedbackPercentiles(args: GetFeedbackPercentilesArgs): Promise<GetFeedbackPercentilesResponse>;
}
