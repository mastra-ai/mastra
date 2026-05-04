/**
 * ClickHouse v-next observability storage domain.
 *
 * Insert-only model: Uses ReplacingMergeTree for all signals
 * with dedupeKey for retry-idempotency.
 *
 * Domain layout follows DuckDB reference: thin class delegating to module functions.
 */

import type { ClickHouseClient } from '@clickhouse/client';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { createStorageErrorId, ObservabilityStorage } from '@mastra/core/storage';
import type {
  ObservabilityStorageStrategy,
  BatchCreateSpansArgs,
  BatchDeleteTracesArgs,
  CreateSpanArgs,
  GetRootSpanArgs,
  GetRootSpanResponse,
  GetSpanArgs,
  GetSpanResponse,
  GetSpansArgs,
  GetSpansResponse,
  GetTraceArgs,
  GetTraceResponse,
  GetTraceLightResponse,
  ListBranchesArgs,
  ListBranchesResponse,
  ListTracesArgs,
  ListTracesResponse,
  BatchCreateLogsArgs,
  ListLogsArgs,
  ListLogsResponse,
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
  GetMetricNamesArgs,
  GetMetricNamesResponse,
  GetMetricLabelKeysArgs,
  GetMetricLabelKeysResponse,
  GetMetricLabelValuesArgs,
  GetMetricLabelValuesResponse,
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
} from '@mastra/core/storage';

import { resolveClickhouseConfig } from '../../../db';
import type { ClickhouseDomainConfig } from '../../../db';

import {
  ALL_TABLE_DDL,
  ALL_MV_DDL,
  ALL_MIGRATIONS,
  DISCOVERY_MV_DDL,
  ALL_TABLE_NAMES,
  MV_DISCOVERY_VALUES,
  MV_DISCOVERY_PAIRS,
  buildRetentionDDL,
} from './ddl';
import type { RetentionConfig } from './ddl';
export type { RetentionConfig } from './ddl';

/** Extended config for v-next observability, adding per-signal retention. */
export type VNextObservabilityConfig = ClickhouseDomainConfig & {
  retention?: RetentionConfig;
};
import * as discoveryOps from './discovery';
import * as feedbackOps from './feedback';
import * as logsOps from './logs';
import * as metricsOps from './metrics';
import { checkSignalTablesMigrationStatus, migrateSignalTables } from './migration';
import * as scoresOps from './scores';
import * as traceRootsOps from './trace-roots';
import * as tracingOps from './tracing';

function buildSignalMigrationRequiredMessage(args: {
  store: 'ClickHouse';
  tables: Array<{ table: string; engine: string }>;
}): string {
  const tableList = args.tables.map(table => `  - ${table.table} (${table.engine})`).join('\n');

  return (
    `\n` +
    `===========================================================================\n` +
    `MIGRATION REQUIRED: ${args.store} observability signal tables need signal IDs\n` +
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
    `  1. Create replacement signal tables with signal-ID dedupe keys\n` +
    `  2. Backfill missing signal IDs for legacy rows\n` +
    `  3. Swap the migrated tables into place\n` +
    `\n` +
    `WARNING: This migration recreates the signal tables and may take significant\n` +
    `time for large databases. Please ensure you have a backup before proceeding.\n` +
    `===========================================================================\n`
  );
}

export class ObservabilityStorageClickhouseVNext extends ObservabilityStorage {
  readonly #client: ClickHouseClient;
  readonly #retention?: RetentionConfig;

  constructor(config: VNextObservabilityConfig) {
    super();
    const { client } = resolveClickhouseConfig(config);
    this.#client = client;
    this.#retention = config.retention;
  }

  // -------------------------------------------------------------------------
  // Initialization
  // -------------------------------------------------------------------------

  async init(): Promise<void> {
    const migrationStatus = await checkSignalTablesMigrationStatus(this.#client);
    if (migrationStatus.needsMigration) {
      throw new MastraError({
        id: createStorageErrorId('CLICKHOUSE', 'MIGRATION_REQUIRED', 'SIGNAL_TABLES'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        text: buildSignalMigrationRequiredMessage({
          store: 'ClickHouse',
          tables: migrationStatus.tables.map(({ table, engine }) => ({ table, engine })),
        }),
      });
    }

    try {
      // Core tables + incremental MVs (must succeed)
      for (const ddl of [...ALL_TABLE_DDL, ...ALL_MV_DDL]) {
        await this.#client.command({ query: ddl });
      }

      // Additive migrations for existing databases (add new columns)
      for (const migration of ALL_MIGRATIONS) {
        await this.#client.command({ query: migration });
      }

      // Apply retention TTL if configured (per design doc: per-signal, day increments).
      // Uses ALTER TABLE ... MODIFY TTL so re-running init is idempotent.
      if (this.#retention) {
        const ttlStatements = buildRetentionDDL(this.#retention);
        for (const stmt of ttlStatements) {
          await this.#client.command({ query: stmt });
        }
      }
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      const causeMessage = error instanceof Error ? error.message : String(error);
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'VNEXT_INIT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: `Failed to initialize ClickHouse v-next observability tables: ${causeMessage}`,
        },
        error,
      );
    }

    // Discovery refreshable MVs — bootstrap separately.
    // Per design: "bootstrap failure should not fail the base observability adapter;
    // discovery methods should continue returning empty results until a later refresh succeeds."
    try {
      for (const ddl of DISCOVERY_MV_DDL) {
        await this.#client.command({ query: ddl });
      }
      // Trigger an immediate refresh so discovery data is available right away
      // instead of waiting for the first scheduled refresh cycle.
      // SYSTEM REFRESH VIEW kicks off the refresh; SYSTEM WAIT VIEW blocks
      // until it finishes (or re-throws if the refresh failed).
      await this.#client.command({ query: `SYSTEM REFRESH VIEW ${MV_DISCOVERY_VALUES}` });
      await this.#client.command({ query: `SYSTEM WAIT VIEW ${MV_DISCOVERY_VALUES}` });
      await this.#client.command({ query: `SYSTEM REFRESH VIEW ${MV_DISCOVERY_PAIRS}` });
      await this.#client.command({ query: `SYSTEM WAIT VIEW ${MV_DISCOVERY_PAIRS}` });
    } catch {
      // Discovery MVs may fail on ClickHouse versions without refreshable MV support.
      // Discovery methods will return empty results until the MVs are created and refreshed.
    }
  }

  /**
   * Manually migrate legacy signal tables to the signal-ID ReplacingMergeTree schema.
   * The public method name is historical; the CLI still calls `migrateSpans()`
   * for observability migrations even though this now also migrates signal tables.
   */
  async migrateSpans(): Promise<{
    success: boolean;
    alreadyMigrated: boolean;
    duplicatesRemoved: number;
    message: string;
  }> {
    const migrationStatus = await checkSignalTablesMigrationStatus(this.#client);

    if (!migrationStatus.needsMigration) {
      return {
        success: true,
        alreadyMigrated: true,
        duplicatesRemoved: 0,
        message: 'Migration already complete. Signal tables already use signal-ID dedupe keys.',
      };
    }

    await migrateSignalTables(this.#client, this.logger);

    return {
      success: true,
      alreadyMigrated: false,
      duplicatesRemoved: 0,
      message: `Migration complete. Migrated signal tables: ${migrationStatus.tables.map(t => t.table).join(', ')}.`,
    };
  }

  // -------------------------------------------------------------------------
  // Strategy
  // -------------------------------------------------------------------------

  public override get observabilityStrategy(): {
    preferred: ObservabilityStorageStrategy;
    supported: ObservabilityStorageStrategy[];
  } {
    return {
      preferred: 'insert-only',
      supported: ['insert-only'],
    };
  }

  // -------------------------------------------------------------------------
  // Tracing — writes
  // -------------------------------------------------------------------------

  override async createSpan(args: CreateSpanArgs): Promise<void> {
    try {
      await tracingOps.createSpan(this.#client, args);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'CREATE_SPAN', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { traceId: args.span.traceId, spanId: args.span.spanId },
        },
        error,
      );
    }
  }

  override async batchCreateSpans(args: BatchCreateSpansArgs): Promise<void> {
    try {
      await tracingOps.batchCreateSpans(this.#client, args);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'BATCH_CREATE_SPANS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { count: args.records.length },
        },
        error,
      );
    }
  }

  // -------------------------------------------------------------------------
  // Tracing — reads
  // -------------------------------------------------------------------------

  override async getSpan(args: GetSpanArgs): Promise<GetSpanResponse | null> {
    try {
      return await tracingOps.getSpan(this.#client, args);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'GET_SPAN', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { traceId: args.traceId, spanId: args.spanId },
        },
        error,
      );
    }
  }

  override async getSpans(args: GetSpansArgs): Promise<GetSpansResponse> {
    try {
      return await tracingOps.getSpans(this.#client, args);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'GET_SPANS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { traceId: args.traceId, count: args.spanIds.length },
        },
        error,
      );
    }
  }

  override async getRootSpan(args: GetRootSpanArgs): Promise<GetRootSpanResponse | null> {
    try {
      return await traceRootsOps.getRootSpan(this.#client, args);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'GET_ROOT_SPAN', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { traceId: args.traceId },
        },
        error,
      );
    }
  }

  override async getTrace(args: GetTraceArgs): Promise<GetTraceResponse | null> {
    try {
      return await tracingOps.getTrace(this.#client, args);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'GET_TRACE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { traceId: args.traceId },
        },
        error,
      );
    }
  }

  override async getTraceLight(args: GetTraceArgs): Promise<GetTraceLightResponse | null> {
    try {
      return await tracingOps.getTraceLight(this.#client, args);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'GET_TRACE_LIGHT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { traceId: args.traceId },
        },
        error,
      );
    }
  }

  override async listTraces(args: ListTracesArgs): Promise<ListTracesResponse> {
    try {
      return await traceRootsOps.listTraces(this.#client, args);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'LIST_TRACES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  override async listBranches(args: ListBranchesArgs): Promise<ListBranchesResponse> {
    try {
      return await tracingOps.listBranches(this.#client, args);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'LIST_BRANCHES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  override async batchCreateLogs(args: BatchCreateLogsArgs): Promise<void> {
    try {
      await logsOps.batchCreateLogs(this.#client, args);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'BATCH_CREATE_LOGS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { count: args.logs.length },
        },
        error,
      );
    }
  }

  override async listLogs(args: ListLogsArgs): Promise<ListLogsResponse> {
    try {
      return await logsOps.listLogs(this.#client, args);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'LIST_LOGS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  override async batchCreateMetrics(args: BatchCreateMetricsArgs): Promise<void> {
    try {
      await metricsOps.batchCreateMetrics(this.#client, args);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'BATCH_CREATE_METRICS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { count: args.metrics.length },
        },
        error,
      );
    }
  }

  override async listMetrics(args: ListMetricsArgs): Promise<ListMetricsResponse> {
    try {
      return await metricsOps.listMetrics(this.#client, args);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'LIST_METRICS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  override async createScore(args: CreateScoreArgs): Promise<void> {
    try {
      await scoresOps.createScore(this.#client, args);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'CREATE_SCORE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  override async batchCreateScores(args: BatchCreateScoresArgs): Promise<void> {
    try {
      await scoresOps.batchCreateScores(this.#client, args);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'BATCH_CREATE_SCORES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { count: args.scores.length },
        },
        error,
      );
    }
  }

  override async listScores(args: ListScoresArgs): Promise<ListScoresResponse> {
    try {
      return await scoresOps.listScores(this.#client, args);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'LIST_SCORES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  override async createFeedback(args: CreateFeedbackArgs): Promise<void> {
    try {
      await feedbackOps.createFeedback(this.#client, args);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'CREATE_FEEDBACK', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  override async batchCreateFeedback(args: BatchCreateFeedbackArgs): Promise<void> {
    try {
      await feedbackOps.batchCreateFeedback(this.#client, args);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'BATCH_CREATE_FEEDBACK', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { count: args.feedbacks.length },
        },
        error,
      );
    }
  }

  override async listFeedback(args: ListFeedbackArgs): Promise<ListFeedbackResponse> {
    try {
      return await feedbackOps.listFeedback(this.#client, args);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'LIST_FEEDBACK', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  // -------------------------------------------------------------------------
  // Scores — OLAP
  // -------------------------------------------------------------------------

  override async getScoreAggregate(args: GetScoreAggregateArgs): Promise<GetScoreAggregateResponse> {
    try {
      return await scoresOps.getScoreAggregate(this.#client, args);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'GET_SCORE_AGGREGATE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  override async getScoreBreakdown(args: GetScoreBreakdownArgs): Promise<GetScoreBreakdownResponse> {
    try {
      return await scoresOps.getScoreBreakdown(this.#client, args);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'GET_SCORE_BREAKDOWN', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  override async getScoreTimeSeries(args: GetScoreTimeSeriesArgs): Promise<GetScoreTimeSeriesResponse> {
    try {
      return await scoresOps.getScoreTimeSeries(this.#client, args);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'GET_SCORE_TIME_SERIES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  override async getScorePercentiles(args: GetScorePercentilesArgs): Promise<GetScorePercentilesResponse> {
    try {
      return await scoresOps.getScorePercentiles(this.#client, args);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'GET_SCORE_PERCENTILES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  // -------------------------------------------------------------------------
  // Feedback — OLAP
  // -------------------------------------------------------------------------

  override async getFeedbackAggregate(args: GetFeedbackAggregateArgs): Promise<GetFeedbackAggregateResponse> {
    try {
      return await feedbackOps.getFeedbackAggregate(this.#client, args);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'GET_FEEDBACK_AGGREGATE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  override async getFeedbackBreakdown(args: GetFeedbackBreakdownArgs): Promise<GetFeedbackBreakdownResponse> {
    try {
      return await feedbackOps.getFeedbackBreakdown(this.#client, args);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'GET_FEEDBACK_BREAKDOWN', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  override async getFeedbackTimeSeries(args: GetFeedbackTimeSeriesArgs): Promise<GetFeedbackTimeSeriesResponse> {
    try {
      return await feedbackOps.getFeedbackTimeSeries(this.#client, args);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'GET_FEEDBACK_TIME_SERIES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  override async getFeedbackPercentiles(args: GetFeedbackPercentilesArgs): Promise<GetFeedbackPercentilesResponse> {
    try {
      return await feedbackOps.getFeedbackPercentiles(this.#client, args);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'GET_FEEDBACK_PERCENTILES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  // -------------------------------------------------------------------------
  // Metrics — OLAP
  // -------------------------------------------------------------------------

  override async getMetricAggregate(args: GetMetricAggregateArgs): Promise<GetMetricAggregateResponse> {
    try {
      return await metricsOps.getMetricAggregate(this.#client, args);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'GET_METRIC_AGGREGATE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  override async getMetricBreakdown(args: GetMetricBreakdownArgs): Promise<GetMetricBreakdownResponse> {
    try {
      return await metricsOps.getMetricBreakdown(this.#client, args);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'GET_METRIC_BREAKDOWN', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  override async getMetricTimeSeries(args: GetMetricTimeSeriesArgs): Promise<GetMetricTimeSeriesResponse> {
    try {
      return await metricsOps.getMetricTimeSeries(this.#client, args);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'GET_METRIC_TIME_SERIES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  override async getMetricPercentiles(args: GetMetricPercentilesArgs): Promise<GetMetricPercentilesResponse> {
    try {
      return await metricsOps.getMetricPercentiles(this.#client, args);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'GET_METRIC_PERCENTILES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  // -------------------------------------------------------------------------
  // Metrics — discovery
  // -------------------------------------------------------------------------

  override async getMetricNames(args: GetMetricNamesArgs): Promise<GetMetricNamesResponse> {
    try {
      return await metricsOps.getMetricNames(this.#client, args);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'GET_METRIC_NAMES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  override async getMetricLabelKeys(args: GetMetricLabelKeysArgs): Promise<GetMetricLabelKeysResponse> {
    try {
      return await metricsOps.getMetricLabelKeys(this.#client, args);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'GET_METRIC_LABEL_KEYS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  override async getMetricLabelValues(args: GetMetricLabelValuesArgs): Promise<GetMetricLabelValuesResponse> {
    try {
      return await metricsOps.getMetricLabelValues(this.#client, args);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'GET_METRIC_LABEL_VALUES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  // -------------------------------------------------------------------------
  // General discovery
  // -------------------------------------------------------------------------

  override async getEntityTypes(args: GetEntityTypesArgs): Promise<GetEntityTypesResponse> {
    try {
      return await discoveryOps.getEntityTypes(this.#client, args);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'GET_ENTITY_TYPES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  override async getEntityNames(args: GetEntityNamesArgs): Promise<GetEntityNamesResponse> {
    try {
      return await discoveryOps.getEntityNames(this.#client, args);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'GET_ENTITY_NAMES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  override async getServiceNames(args: GetServiceNamesArgs): Promise<GetServiceNamesResponse> {
    try {
      return await discoveryOps.getServiceNames(this.#client, args);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'GET_SERVICE_NAMES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  override async getEnvironments(args: GetEnvironmentsArgs): Promise<GetEnvironmentsResponse> {
    try {
      return await discoveryOps.getEnvironments(this.#client, args);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'GET_ENVIRONMENTS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  override async getTags(args: GetTagsArgs): Promise<GetTagsResponse> {
    try {
      return await discoveryOps.getTags(this.#client, args);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'GET_TAGS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  // -------------------------------------------------------------------------
  // Tracing — deletes
  // -------------------------------------------------------------------------

  override async batchDeleteTraces(args: BatchDeleteTracesArgs): Promise<void> {
    try {
      await tracingOps.batchDeleteTraces(this.#client, args);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'BATCH_DELETE_TRACES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { count: args.traceIds.length },
        },
        error,
      );
    }
  }

  // -------------------------------------------------------------------------
  // Dangerous clear all
  // -------------------------------------------------------------------------

  override async dangerouslyClearAll(): Promise<void> {
    try {
      // Truncate all signal tables
      await Promise.all(
        ALL_TABLE_NAMES.map(table => this.#client.command({ query: `TRUNCATE TABLE IF EXISTS ${table}` })),
      );
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'DANGEROUS_CLEAR_ALL', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }
}
