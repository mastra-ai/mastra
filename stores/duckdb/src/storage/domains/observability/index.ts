import { ObservabilityStorage } from '@mastra/core/storage';
import type {
  CreateSpanArgs,
  UpdateSpanArgs,
  GetSpanArgs,
  GetSpanResponse,
  GetRootSpanArgs,
  GetRootSpanResponse,
  GetTraceArgs,
  GetTraceResponse,
  ListTracesArgs,
  ListTracesResponse,
  BatchCreateSpansArgs,
  BatchUpdateSpansArgs,
  BatchDeleteTracesArgs,
  BatchCreateLogsArgs,
  ListLogsArgs,
  ListLogsResponse,
  BatchRecordMetricsArgs,
  CreateScoreArgs,
  ListScoresArgs,
  ListScoresResponse,
  CreateFeedbackArgs,
  ListFeedbackArgs,
  ListFeedbackResponse,
  GetMetricAggregateArgs,
  GetMetricAggregateResponse,
  GetMetricBreakdownArgs,
  GetMetricBreakdownResponse,
  GetMetricTimeSeriesArgs,
  GetMetricTimeSeriesResponse,
  GetMetricHistogramArgs,
  GetMetricHistogramResponse,
  GetMetricPercentilesArgs,
  GetMetricPercentilesResponse,
  GetUsageReportArgs,
  GetUsageReportResponse,
  GetMetricNamesArgs,
  GetMetricNamesResponse,
  GetMetricLabelKeysArgs,
  GetMetricLabelKeysResponse,
  GetLabelValuesArgs,
  GetLabelValuesResponse,
  GetEntityTypesArgs,
  GetEntityTypesResponse,
  GetEntityNamesArgs,
  GetEntityNamesResponse,
  GetServiceNamesArgs,
  GetServiceNamesResponse,
  GetEnvironmentsArgs,
  GetEnvironmentsResponse,
  GetTraceTagsArgs,
  GetTraceTagsResponse,
  TracingStorageStrategy,
} from '@mastra/core/storage';
import type { DuckDBConnection } from '../../db/index.js';
import { ALL_DDL } from './ddl.js';
import * as discoveryOps from './discovery.js';
import * as feedbackOps from './feedback.js';
import * as logOps from './logs.js';
import * as metricOps from './metrics.js';
import * as scoreOps from './scores.js';
import * as tracingOps from './tracing.js';

export interface ObservabilityDuckDBConfig {
  db: DuckDBConnection;
}

export class ObservabilityStorageDuckDB extends ObservabilityStorage {
  private db: DuckDBConnection;

  constructor(config: ObservabilityDuckDBConfig) {
    super();
    this.db = config.db;
  }

  async init(): Promise<void> {
    for (const ddl of ALL_DDL) {
      await this.db.execute(ddl);
    }
  }

  async dangerouslyClearAll(): Promise<void> {
    for (const table of ['span_events', 'metric_events', 'log_events', 'score_events', 'feedback_events']) {
      await this.db.execute(`DELETE FROM ${table}`);
    }
  }

  public override get tracingStrategy(): {
    preferred: TracingStorageStrategy;
    supported: TracingStorageStrategy[];
  } {
    return {
      preferred: 'span-events' as const,
      supported: ['span-events' as const],
    };
  }

  // Tracing
  async createSpan(args: CreateSpanArgs): Promise<void> {
    return tracingOps.createSpan(this.db, args);
  }
  async updateSpan(args: UpdateSpanArgs): Promise<void> {
    return tracingOps.updateSpan(this.db, args);
  }
  async batchCreateSpans(args: BatchCreateSpansArgs): Promise<void> {
    return tracingOps.batchCreateSpans(this.db, args);
  }
  async batchUpdateSpans(args: BatchUpdateSpansArgs): Promise<void> {
    return tracingOps.batchUpdateSpans(this.db, args);
  }
  async batchDeleteTraces(args: BatchDeleteTracesArgs): Promise<void> {
    return tracingOps.batchDeleteTraces(this.db, args);
  }
  async getSpan(args: GetSpanArgs): Promise<GetSpanResponse | null> {
    return tracingOps.getSpan(this.db, args);
  }
  async getRootSpan(args: GetRootSpanArgs): Promise<GetRootSpanResponse | null> {
    return tracingOps.getRootSpan(this.db, args);
  }
  async getTrace(args: GetTraceArgs): Promise<GetTraceResponse | null> {
    return tracingOps.getTrace(this.db, args);
  }
  async listTraces(args: ListTracesArgs): Promise<ListTracesResponse> {
    return tracingOps.listTraces(this.db, args);
  }

  // Logs
  async batchCreateLogs(args: BatchCreateLogsArgs): Promise<void> {
    return logOps.batchCreateLogs(this.db, args);
  }
  async listLogs(args: ListLogsArgs): Promise<ListLogsResponse> {
    return logOps.listLogs(this.db, args);
  }

  // Metrics
  async batchRecordMetrics(args: BatchRecordMetricsArgs): Promise<void> {
    return metricOps.batchRecordMetrics(this.db, args);
  }
  async getMetricAggregate(args: GetMetricAggregateArgs): Promise<GetMetricAggregateResponse> {
    return metricOps.getMetricAggregate(this.db, args);
  }
  async getMetricBreakdown(args: GetMetricBreakdownArgs): Promise<GetMetricBreakdownResponse> {
    return metricOps.getMetricBreakdown(this.db, args);
  }
  async getMetricTimeSeries(args: GetMetricTimeSeriesArgs): Promise<GetMetricTimeSeriesResponse> {
    return metricOps.getMetricTimeSeries(this.db, args);
  }
  async getMetricHistogram(args: GetMetricHistogramArgs): Promise<GetMetricHistogramResponse> {
    return metricOps.getMetricHistogram(this.db, args);
  }
  async getMetricPercentiles(args: GetMetricPercentilesArgs): Promise<GetMetricPercentilesResponse> {
    return metricOps.getMetricPercentiles(this.db, args);
  }
  async getUsageReport(args: GetUsageReportArgs): Promise<GetUsageReportResponse> {
    return metricOps.getUsageReport(this.db, args);
  }

  // Metric Discovery
  async getMetricNames(args: GetMetricNamesArgs): Promise<GetMetricNamesResponse> {
    return metricOps.getMetricNames(this.db, args);
  }
  async getMetricLabelKeys(args: GetMetricLabelKeysArgs): Promise<GetMetricLabelKeysResponse> {
    return metricOps.getMetricLabelKeys(this.db, args);
  }
  async getLabelValues(args: GetLabelValuesArgs): Promise<GetLabelValuesResponse> {
    return metricOps.getLabelValues(this.db, args);
  }

  // Span Discovery
  async getEntityTypes(args: GetEntityTypesArgs): Promise<GetEntityTypesResponse> {
    return discoveryOps.getEntityTypes(this.db, args);
  }
  async getEntityNames(args: GetEntityNamesArgs): Promise<GetEntityNamesResponse> {
    return discoveryOps.getEntityNames(this.db, args);
  }
  async getServiceNames(args: GetServiceNamesArgs): Promise<GetServiceNamesResponse> {
    return discoveryOps.getServiceNames(this.db, args);
  }
  async getEnvironments(args: GetEnvironmentsArgs): Promise<GetEnvironmentsResponse> {
    return discoveryOps.getEnvironments(this.db, args);
  }
  async getTraceTags(args: GetTraceTagsArgs): Promise<GetTraceTagsResponse> {
    return discoveryOps.getTraceTags(this.db, args);
  }

  // Scores
  async createScore(args: CreateScoreArgs): Promise<void> {
    return scoreOps.createScore(this.db, args);
  }
  async listScores(args: ListScoresArgs): Promise<ListScoresResponse> {
    return scoreOps.listScores(this.db, args);
  }

  // Feedback
  async createFeedback(args: CreateFeedbackArgs): Promise<void> {
    return feedbackOps.createFeedback(this.db, args);
  }
  async listFeedback(args: ListFeedbackArgs): Promise<ListFeedbackResponse> {
    return feedbackOps.listFeedback(this.db, args);
  }
}
