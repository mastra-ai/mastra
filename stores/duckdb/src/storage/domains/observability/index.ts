import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { createStorageErrorId, ObservabilityStorage } from '@mastra/core/storage';
import type {
  CreateSpanArgs,
  GetSpanArgs,
  GetSpanResponse,
  GetSpansArgs,
  GetSpansResponse,
  GetRootSpanArgs,
  GetRootSpanResponse,
  GetTraceArgs,
  GetTraceResponse,
  GetTraceLightResponse,
  ListBranchesArgs,
  ListBranchesResponse,
  ListTracesArgs,
  ListTracesResponse,
  BatchCreateSpansArgs,
  BatchDeleteTracesArgs,
  BatchCreateLogsArgs,
  ListLogsArgs,
  ListLogsResponse,
  BatchCreateMetricsArgs,
  ListMetricsArgs,
  ListMetricsResponse,
  CreateScoreArgs,
  BatchCreateScoresArgs,
  ListScoresArgs,
  ListScoresResponse,
  GetScoreAggregateArgs,
  GetScoreAggregateResponse,
  GetScoreBreakdownArgs,
  GetScoreBreakdownResponse,
  GetScoreTimeSeriesArgs,
  GetScoreTimeSeriesResponse,
  GetScorePercentilesArgs,
  GetScorePercentilesResponse,
  CreateFeedbackArgs,
  BatchCreateFeedbackArgs,
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
  GetMetricAggregateArgs,
  GetMetricAggregateResponse,
  GetMetricBreakdownArgs,
  GetMetricBreakdownResponse,
  GetMetricTimeSeriesArgs,
  GetMetricTimeSeriesResponse,
  GetMetricPercentilesArgs,
  GetMetricPercentilesResponse,
  GetMetricNamesArgs,
  GetMetricNamesResponse,
  GetMetricLabelKeysArgs,
  GetMetricLabelKeysResponse,
  GetMetricLabelValuesArgs,
  GetMetricLabelValuesResponse,
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
  ObservabilityStorageStrategy,
} from '@mastra/core/storage';
import type { DuckDBConnection } from '../../db/index';
import { ALL_DDL, ALL_MIGRATIONS } from './ddl';
import * as discoveryOps from './discovery';
import * as feedbackOps from './feedback';
import * as logOps from './logs';
import * as metricOps from './metrics';
import { checkSignalTablesMigrationStatus, migrateSignalTables } from './migration';
import * as scoreOps from './scores';
import * as tracingOps from './tracing';

function buildSignalMigrationRequiredMessage(args: { tables: Array<{ table: string }> }): string {
  const tableList = args.tables.map(table => `  - ${table.table}`).join('\n');

  return (
    `\n` +
    `===========================================================================\n` +
    `MIGRATION REQUIRED: DuckDB observability signal tables need signal IDs\n` +
    `===========================================================================\n` +
    `\n` +
    `The following signal tables still use the legacy schema and must be migrated\n` +
    `before observability storage can initialize:\n` +
    `\n` +
    `${tableList}\n` +
    `\n` +
    `To fix this, run the manual migration command:\n` +
    `\n` +
    `  npx mastra migrate\n` +
    `\n` +
    `This command will:\n` +
    `  1. Create replacement signal tables with signal-ID primary keys\n` +
    `  2. Backfill missing signal IDs for legacy rows\n` +
    `  3. Swap the migrated tables into place\n` +
    `\n` +
    `WARNING: This migration recreates the signal tables and may take significant\n` +
    `time for large databases. Please ensure you have a backup before proceeding.\n` +
    `===========================================================================\n`
  );
}

/** Configuration for the DuckDB observability storage domain. */
export interface ObservabilityDuckDBConfig {
  /** Shared DuckDB instance to use for all observability queries. */
  db: DuckDBConnection;
}

/**
 * DuckDB-backed observability storage for traces, metrics, logs, scores, and feedback.
 * Uses an append-only event-sourced model with SQL-based reconstruction for spans.
 */
export class ObservabilityStorageDuckDB extends ObservabilityStorage {
  private db: DuckDBConnection;

  constructor(config: ObservabilityDuckDBConfig) {
    super();
    this.db = config.db;
  }

  /** Create all observability tables if they don't exist. */
  async init(): Promise<void> {
    const migrationStatus = await checkSignalTablesMigrationStatus(this.db);
    if (migrationStatus.needsMigration) {
      throw new MastraError({
        id: createStorageErrorId('DUCKDB', 'MIGRATION_REQUIRED', 'SIGNAL_TABLES'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: buildSignalMigrationRequiredMessage({
          tables: migrationStatus.tables.map(({ table }) => ({ table })),
        }),
      });
    }

    for (const ddl of ALL_DDL) {
      await this.db.execute(ddl);
    }

    for (const migration of ALL_MIGRATIONS) {
      await this.db.execute(migration);
    }
  }

  /**
   * Manually migrate legacy signal tables to the signal-ID primary-key schema.
   * The public method name is historical; the CLI still calls `migrateSpans()`
   * for observability migrations even though this now also migrates signal tables.
   */
  async migrateSpans(): Promise<{
    success: boolean;
    alreadyMigrated: boolean;
    duplicatesRemoved: number;
    message: string;
  }> {
    const migrationStatus = await checkSignalTablesMigrationStatus(this.db);

    if (!migrationStatus.needsMigration) {
      return {
        success: true,
        alreadyMigrated: true,
        duplicatesRemoved: 0,
        message: 'Migration already complete. Signal tables already use signal-ID primary keys.',
      };
    }

    await migrateSignalTables(this.db, this.logger);

    return {
      success: true,
      alreadyMigrated: false,
      duplicatesRemoved: 0,
      message: `Migration complete. Migrated signal tables: ${migrationStatus.tables.map(t => t.table).join(', ')}.`,
    };
  }

  /** Delete all rows from every observability table. Use with caution. */
  async dangerouslyClearAll(): Promise<void> {
    for (const table of ['span_events', 'metric_events', 'log_events', 'score_events', 'feedback_events']) {
      await this.db.execute(`TRUNCATE TABLE ${table}`);
    }
  }

  public override get observabilityStrategy(): {
    preferred: ObservabilityStorageStrategy;
    supported: ObservabilityStorageStrategy[];
  } {
    return {
      preferred: 'event-sourced',
      supported: ['event-sourced'],
    };
  }

  // Tracing
  async createSpan(args: CreateSpanArgs): Promise<void> {
    return tracingOps.createSpan(this.db, args);
  }
  async batchCreateSpans(args: BatchCreateSpansArgs): Promise<void> {
    return tracingOps.batchCreateSpans(this.db, args);
  }
  async batchDeleteTraces(args: BatchDeleteTracesArgs): Promise<void> {
    return tracingOps.batchDeleteTraces(this.db, args);
  }
  async getSpan(args: GetSpanArgs): Promise<GetSpanResponse | null> {
    return tracingOps.getSpan(this.db, args);
  }
  async getSpans(args: GetSpansArgs): Promise<GetSpansResponse> {
    return tracingOps.getSpans(this.db, args);
  }
  async getRootSpan(args: GetRootSpanArgs): Promise<GetRootSpanResponse | null> {
    return tracingOps.getRootSpan(this.db, args);
  }
  async getTrace(args: GetTraceArgs): Promise<GetTraceResponse | null> {
    return tracingOps.getTrace(this.db, args);
  }
  async getTraceLight(args: GetTraceArgs): Promise<GetTraceLightResponse | null> {
    return tracingOps.getTraceLight(this.db, args);
  }
  async listTraces(args: ListTracesArgs): Promise<ListTracesResponse> {
    return tracingOps.listTraces(this.db, args);
  }
  async listBranches(args: ListBranchesArgs): Promise<ListBranchesResponse> {
    return tracingOps.listBranches(this.db, args);
  }

  // Logs
  async batchCreateLogs(args: BatchCreateLogsArgs): Promise<void> {
    return logOps.batchCreateLogs(this.db, args);
  }
  async listLogs(args: ListLogsArgs): Promise<ListLogsResponse> {
    return logOps.listLogs(this.db, args);
  }

  // Metrics
  async batchCreateMetrics(args: BatchCreateMetricsArgs): Promise<void> {
    return metricOps.batchCreateMetrics(this.db, args);
  }
  async listMetrics(args: ListMetricsArgs): Promise<ListMetricsResponse> {
    return metricOps.listMetrics(this.db, args);
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
  async getMetricPercentiles(args: GetMetricPercentilesArgs): Promise<GetMetricPercentilesResponse> {
    return metricOps.getMetricPercentiles(this.db, args);
  }
  // Metric Discovery
  async getMetricNames(args: GetMetricNamesArgs): Promise<GetMetricNamesResponse> {
    return metricOps.getMetricNames(this.db, args);
  }
  async getMetricLabelKeys(args: GetMetricLabelKeysArgs): Promise<GetMetricLabelKeysResponse> {
    return metricOps.getMetricLabelKeys(this.db, args);
  }
  async getMetricLabelValues(args: GetMetricLabelValuesArgs): Promise<GetMetricLabelValuesResponse> {
    return metricOps.getMetricLabelValues(this.db, args);
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
  async getTags(args: GetTagsArgs): Promise<GetTagsResponse> {
    return discoveryOps.getTags(this.db, args);
  }

  // Scores
  async createScore(args: CreateScoreArgs): Promise<void> {
    return scoreOps.createScore(this.db, args);
  }
  async batchCreateScores(args: BatchCreateScoresArgs): Promise<void> {
    return scoreOps.batchCreateScores(this.db, args);
  }
  async listScores(args: ListScoresArgs): Promise<ListScoresResponse> {
    return scoreOps.listScores(this.db, args);
  }
  async getScoreAggregate(args: GetScoreAggregateArgs): Promise<GetScoreAggregateResponse> {
    return scoreOps.getScoreAggregate(this.db, args);
  }
  async getScoreBreakdown(args: GetScoreBreakdownArgs): Promise<GetScoreBreakdownResponse> {
    return scoreOps.getScoreBreakdown(this.db, args);
  }
  async getScoreTimeSeries(args: GetScoreTimeSeriesArgs): Promise<GetScoreTimeSeriesResponse> {
    return scoreOps.getScoreTimeSeries(this.db, args);
  }
  async getScorePercentiles(args: GetScorePercentilesArgs): Promise<GetScorePercentilesResponse> {
    return scoreOps.getScorePercentiles(this.db, args);
  }

  // Feedback
  async createFeedback(args: CreateFeedbackArgs): Promise<void> {
    return feedbackOps.createFeedback(this.db, args);
  }
  async batchCreateFeedback(args: BatchCreateFeedbackArgs): Promise<void> {
    return feedbackOps.batchCreateFeedback(this.db, args);
  }
  async listFeedback(args: ListFeedbackArgs): Promise<ListFeedbackResponse> {
    return feedbackOps.listFeedback(this.db, args);
  }
  async getFeedbackAggregate(args: GetFeedbackAggregateArgs): Promise<GetFeedbackAggregateResponse> {
    return feedbackOps.getFeedbackAggregate(this.db, args);
  }
  async getFeedbackBreakdown(args: GetFeedbackBreakdownArgs): Promise<GetFeedbackBreakdownResponse> {
    return feedbackOps.getFeedbackBreakdown(this.db, args);
  }
  async getFeedbackTimeSeries(args: GetFeedbackTimeSeriesArgs): Promise<GetFeedbackTimeSeriesResponse> {
    return feedbackOps.getFeedbackTimeSeries(this.db, args);
  }
  async getFeedbackPercentiles(args: GetFeedbackPercentilesArgs): Promise<GetFeedbackPercentilesResponse> {
    return feedbackOps.getFeedbackPercentiles(this.db, args);
  }
}
