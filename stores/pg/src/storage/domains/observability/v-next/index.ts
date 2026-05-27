/**
 * Postgres v-next observability storage domain.
 *
 * Insert-only model. Mirrors the ClickHouse v-next layout but adapted for
 * Postgres semantics:
 *   - per-signal partitioned tables (or Timescale hypertables when the
 *     extension is detected)
 *   - retry idempotency via `ON CONFLICT DO NOTHING` on the partition-aware
 *     primary key (the ClickHouse design uses ReplacingMergeTree dedupeKey)
 *   - root-span projection populated by an AFTER INSERT trigger (Postgres
 *     materialized views are not incremental)
 *   - discovery values cached in a Postgres table with stale-while-revalidate
 *     semantics, so cache state survives serverless restarts and works
 *     across multiple frontends pointing at the same DB
 *
 * IMPORTANT: this domain is intended for **low-volume production** workloads
 * only. Customers running more than ~100 calls/sec sustained should use the
 * ClickHouse adapter. See `observability/postgres-design/recommendation.md`
 * for the volume math behind this guidance.
 *
 * The adapter should NOT share a database with the customer's primary
 * application database — observability writes will degrade app performance.
 * Use it through `MastraCompositeStore` with a dedicated Postgres connection.
 */

import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { createStorageErrorId, ObservabilityStorage } from '@mastra/core/storage';
import type {
  BatchCreateFeedbackArgs,
  BatchCreateLogsArgs,
  BatchCreateMetricsArgs,
  BatchCreateScoresArgs,
  BatchCreateSpansArgs,
  BatchDeleteTracesArgs,
  CreateFeedbackArgs,
  CreateScoreArgs,
  CreateSpanArgs,
  GetEntityNamesArgs,
  GetEntityNamesResponse,
  GetEntityTypesArgs,
  GetEntityTypesResponse,
  GetEnvironmentsArgs,
  GetEnvironmentsResponse,
  GetFeedbackAggregateArgs,
  GetFeedbackAggregateResponse,
  GetFeedbackBreakdownArgs,
  GetFeedbackBreakdownResponse,
  GetFeedbackPercentilesArgs,
  GetFeedbackPercentilesResponse,
  GetFeedbackTimeSeriesArgs,
  GetFeedbackTimeSeriesResponse,
  GetMetricAggregateArgs,
  GetMetricAggregateResponse,
  GetMetricBreakdownArgs,
  GetMetricBreakdownResponse,
  GetMetricLabelKeysArgs,
  GetMetricLabelKeysResponse,
  GetMetricLabelValuesArgs,
  GetMetricLabelValuesResponse,
  GetMetricNamesArgs,
  GetMetricNamesResponse,
  GetMetricPercentilesArgs,
  GetMetricPercentilesResponse,
  GetMetricTimeSeriesArgs,
  GetMetricTimeSeriesResponse,
  GetRootSpanArgs,
  GetRootSpanResponse,
  GetSpansArgs,
  GetSpansResponse,
  GetScoreAggregateArgs,
  GetScoreAggregateResponse,
  GetScoreBreakdownArgs,
  GetScoreBreakdownResponse,
  GetScorePercentilesArgs,
  GetScorePercentilesResponse,
  GetScoreTimeSeriesArgs,
  GetScoreTimeSeriesResponse,
  GetServiceNamesArgs,
  GetServiceNamesResponse,
  GetSpanArgs,
  GetSpanResponse,
  GetTagsArgs,
  GetTagsResponse,
  GetTraceArgs,
  GetTraceLightResponse,
  GetTraceResponse,
  ListBranchesArgs,
  ListBranchesResponse,
  ListFeedbackArgs,
  ListFeedbackResponse,
  ListLogsArgs,
  ListLogsResponse,
  ListMetricsArgs,
  ListMetricsResponse,
  ListScoresArgs,
  ListScoresResponse,
  ListTracesArgs,
  ListTracesResponse,
  ObservabilityStorageStrategy,
} from '@mastra/core/storage';

import type { DbClient } from '../../../client';
import { resolvePgConfig } from '../../../db';
import type { PgDomainConfig } from '../../../db';
import { ALL_SIGNAL_TABLES, allIndexDDL, allTableDDL, qualifiedTable, TABLE_DISCOVERY, TABLE_SPAN_EVENTS } from './ddl';
import * as discoveryOps from './discovery';
import type { DiscoveryConfig } from './discovery';
import * as feedbackOps from './feedback';
import * as logsOps from './logs';
import * as metricsOps from './metrics';
import { detectPartman, detectTimescale, setupPartitioning } from './partitioning';
import type { PartitioningOptions, PartitionMode } from './partitioning';
import { deltaPollingFeatureEnabled } from './polling';
import * as scoresOps from './scores';
import * as tracesOps from './traces';
import * as tracingOps from './tracing';

export type { PartitionMode, PartitioningOptions } from './partitioning';
export type { DiscoveryConfig } from './discovery';

/** Configuration for the v-next Postgres observability domain. */
export type VNextPostgresObservabilityConfig = PgDomainConfig & {
  /** Daily-partition / Timescale hypertable behavior. Default 'auto'. */
  partitioning?: PartitioningOptions;
  /** Discovery cache configuration. */
  discovery?: DiscoveryConfig;
};

function wrapError(op: string, error: unknown, details?: Record<string, unknown>): never {
  if (error instanceof MastraError) throw error;
  throw new MastraError(
    {
      id: createStorageErrorId('PG', op, 'FAILED'),
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.THIRD_PARTY,
      details: details as Record<string, any>,
    },
    error,
  );
}

function isDuplicateRelationError(error: unknown): boolean {
  const code = (error as { code?: string } | undefined)?.code;
  const constraint = (error as { constraint?: string } | undefined)?.constraint;
  const message = (error as { message?: string } | undefined)?.message ?? '';
  return (
    code === '42P07' ||
    (code === '23505' && (constraint === 'pg_type_typname_nsp_index' || constraint === 'pg_class_relname_nsp_index')) ||
    /already exists/i.test(message)
  );
}

export class ObservabilityStoragePostgresVNext extends ObservabilityStorage {
  readonly #client: DbClient;
  readonly #schema: string;
  readonly #partitioning: PartitioningOptions;
  readonly #discovery: DiscoveryConfig;
  #partitionMode?: PartitionMode;

  constructor(config: VNextPostgresObservabilityConfig) {
    super();
    const { client, schemaName } = resolvePgConfig(config);
    this.#client = client;
    this.#schema = schemaName ?? 'public';
    this.#partitioning = config.partitioning ?? {};
    this.#discovery = config.discovery ?? {};
  }

  // -------------------------------------------------------------------------
  // Initialization
  // -------------------------------------------------------------------------

  /**
   * Create the signal tables, indexes, and (if Timescale / pg_partman is
   * present) hypertable / partman registrations.
   *
   * Not transactional: each `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF
   * NOT EXISTS`, and `create_hypertable()` / `create_parent()` runs in its
   * own implicit transaction. Re-running `init()` after a failure is safe
   * (every statement is idempotent), but a failure partway through against
   * Timescale can leave some signal tables as hypertables and others as
   * plain tables. If that happens, fix the underlying error and call
   * `init()` again — the partially-converted state is recoverable.
   */
  async init(): Promise<void> {
    try {
      const explicit = this.#partitioning.mode;
      let mode: PartitionMode;
      if (explicit && explicit !== 'auto') {
        mode = explicit;
      } else if (await detectTimescale(this.#client)) {
        mode = 'timescale';
      } else if (await detectPartman(this.#client)) {
        mode = 'partman';
      } else {
        mode = 'native';
      }

      const ddlMode = mode === 'timescale' ? 'timescale' : 'partitioned';

      for (const ddl of allTableDDL(this.#schema, ddlMode)) {
        try {
          await this.#client.none(ddl);
        } catch (error) {
          if (!isDuplicateRelationError(error)) throw error;
        }
      }
      for (const ddl of allIndexDDL(this.#schema)) {
        try {
          await this.#client.none(ddl);
        } catch (error) {
          if (!isDuplicateRelationError(error)) throw error;
        }
      }

      this.#partitionMode = await setupPartitioning(this.#client, this.#schema, {
        ...this.#partitioning,
        mode,
      });
    } catch (error) {
      wrapError('VNEXT_INIT', error);
    }
  }

  /** Resolved partition mode after init(). Useful for tests and diagnostics. */
  get partitionMode(): PartitionMode | undefined {
    return this.#partitionMode;
  }

  public override get observabilityStrategy(): {
    preferred: ObservabilityStorageStrategy;
    supported: ObservabilityStorageStrategy[];
  } {
    return { preferred: 'insert-only', supported: ['insert-only'] };
  }

  override getFeatures() {
    if (!deltaPollingFeatureEnabled()) return undefined;
    return ['delta-polling'] as const;
  }

  // -------------------------------------------------------------------------
  // Tracing — writes
  // -------------------------------------------------------------------------

  override async createSpan(args: CreateSpanArgs): Promise<void> {
    try {
      await tracingOps.createSpan(this.#client, this.#schema, args);
    } catch (error) {
      wrapError('CREATE_SPAN', error, { traceId: args.span.traceId, spanId: args.span.spanId });
    }
  }

  override async batchCreateSpans(args: BatchCreateSpansArgs): Promise<void> {
    try {
      await tracingOps.batchCreateSpans(this.#client, this.#schema, args);
    } catch (error) {
      wrapError('BATCH_CREATE_SPANS', error, { count: args.records.length });
    }
  }

  // -------------------------------------------------------------------------
  // Tracing — reads
  // -------------------------------------------------------------------------

  override async getSpan(args: GetSpanArgs): Promise<GetSpanResponse | null> {
    try {
      return await tracingOps.getSpan(this.#client, this.#schema, args);
    } catch (error) {
      wrapError('GET_SPAN', error, { traceId: args.traceId, spanId: args.spanId });
    }
  }

  override async getSpans(args: GetSpansArgs): Promise<GetSpansResponse> {
    try {
      return await tracingOps.getSpans(this.#client, this.#schema, args);
    } catch (error) {
      wrapError('GET_SPANS', error, { traceId: args.traceId, count: args.spanIds.length });
    }
  }

  override async getRootSpan(args: GetRootSpanArgs): Promise<GetRootSpanResponse | null> {
    try {
      return await tracesOps.getRootSpan(this.#client, this.#schema, args);
    } catch (error) {
      wrapError('GET_ROOT_SPAN', error, { traceId: args.traceId });
    }
  }

  override async getTrace(args: GetTraceArgs): Promise<GetTraceResponse | null> {
    try {
      return await tracingOps.getTrace(this.#client, this.#schema, args);
    } catch (error) {
      wrapError('GET_TRACE', error, { traceId: args.traceId });
    }
  }

  override async getTraceLight(args: GetTraceArgs): Promise<GetTraceLightResponse | null> {
    try {
      return await tracingOps.getTraceLight(this.#client, this.#schema, args);
    } catch (error) {
      wrapError('GET_TRACE_LIGHT', error, { traceId: args.traceId });
    }
  }

  override async listTraces(args: ListTracesArgs): Promise<ListTracesResponse> {
    try {
      return await tracesOps.listTraces(this.#client, this.#schema, args);
    } catch (error) {
      wrapError('LIST_TRACES', error);
    }
  }

  override async listBranches(args: ListBranchesArgs): Promise<ListBranchesResponse> {
    try {
      return await tracesOps.listBranches(this.#client, this.#schema, args);
    } catch (error) {
      wrapError('LIST_BRANCHES', error);
    }
  }

  // -------------------------------------------------------------------------
  // Logs / metrics / scores / feedback — writes
  // -------------------------------------------------------------------------

  override async batchCreateLogs(args: BatchCreateLogsArgs): Promise<void> {
    try {
      await logsOps.batchCreateLogs(this.#client, this.#schema, args);
    } catch (error) {
      wrapError('BATCH_CREATE_LOGS', error, { count: args.logs.length });
    }
  }

  override async batchCreateMetrics(args: BatchCreateMetricsArgs): Promise<void> {
    try {
      await metricsOps.batchCreateMetrics(this.#client, this.#schema, args);
    } catch (error) {
      wrapError('BATCH_CREATE_METRICS', error, { count: args.metrics.length });
    }
  }

  override async createScore(args: CreateScoreArgs): Promise<void> {
    try {
      await scoresOps.createScore(this.#client, this.#schema, args);
    } catch (error) {
      wrapError('CREATE_SCORE', error);
    }
  }

  override async batchCreateScores(args: BatchCreateScoresArgs): Promise<void> {
    try {
      await scoresOps.batchCreateScores(this.#client, this.#schema, args);
    } catch (error) {
      wrapError('BATCH_CREATE_SCORES', error, { count: args.scores.length });
    }
  }

  override async createFeedback(args: CreateFeedbackArgs): Promise<void> {
    try {
      await feedbackOps.createFeedback(this.#client, this.#schema, args);
    } catch (error) {
      wrapError('CREATE_FEEDBACK', error);
    }
  }

  override async batchCreateFeedback(args: BatchCreateFeedbackArgs): Promise<void> {
    try {
      await feedbackOps.batchCreateFeedback(this.#client, this.#schema, args);
    } catch (error) {
      wrapError('BATCH_CREATE_FEEDBACK', error, { count: args.feedbacks.length });
    }
  }

  // -------------------------------------------------------------------------
  // Logs / metrics / scores / feedback — list reads
  // -------------------------------------------------------------------------

  override async listLogs(args: ListLogsArgs): Promise<ListLogsResponse> {
    try {
      return await logsOps.listLogs(this.#client, this.#schema, args);
    } catch (error) {
      wrapError('LIST_LOGS', error);
    }
  }

  override async listMetrics(args: ListMetricsArgs): Promise<ListMetricsResponse> {
    try {
      return await metricsOps.listMetrics(this.#client, this.#schema, args);
    } catch (error) {
      wrapError('LIST_METRICS', error);
    }
  }

  override async listScores(args: ListScoresArgs): Promise<ListScoresResponse> {
    try {
      return await scoresOps.listScores(this.#client, this.#schema, args);
    } catch (error) {
      wrapError('LIST_SCORES', error);
    }
  }

  override async getScoreById(scoreId: string) {
    try {
      return await scoresOps.getScoreById(this.#client, this.#schema, scoreId);
    } catch (error) {
      wrapError('GET_SCORE_BY_ID', error, { scoreId });
    }
  }

  override async listFeedback(args: ListFeedbackArgs): Promise<ListFeedbackResponse> {
    try {
      return await feedbackOps.listFeedback(this.#client, this.#schema, args);
    } catch (error) {
      wrapError('LIST_FEEDBACK', error);
    }
  }

  // -------------------------------------------------------------------------
  // OLAP — metrics
  // -------------------------------------------------------------------------

  override async getMetricAggregate(args: GetMetricAggregateArgs): Promise<GetMetricAggregateResponse> {
    try {
      return await metricsOps.getMetricAggregate(this.#client, this.#schema, args);
    } catch (error) {
      wrapError('GET_METRIC_AGGREGATE', error);
    }
  }

  override async getMetricBreakdown(args: GetMetricBreakdownArgs): Promise<GetMetricBreakdownResponse> {
    try {
      return await metricsOps.getMetricBreakdown(this.#client, this.#schema, args);
    } catch (error) {
      wrapError('GET_METRIC_BREAKDOWN', error);
    }
  }

  override async getMetricTimeSeries(args: GetMetricTimeSeriesArgs): Promise<GetMetricTimeSeriesResponse> {
    try {
      return await metricsOps.getMetricTimeSeries(this.#client, this.#schema, args);
    } catch (error) {
      wrapError('GET_METRIC_TIME_SERIES', error);
    }
  }

  override async getMetricPercentiles(args: GetMetricPercentilesArgs): Promise<GetMetricPercentilesResponse> {
    try {
      return await metricsOps.getMetricPercentiles(this.#client, this.#schema, args);
    } catch (error) {
      wrapError('GET_METRIC_PERCENTILES', error);
    }
  }

  // -------------------------------------------------------------------------
  // OLAP — scores
  // -------------------------------------------------------------------------

  override async getScoreAggregate(args: GetScoreAggregateArgs): Promise<GetScoreAggregateResponse> {
    try {
      return await scoresOps.getScoreAggregate(this.#client, this.#schema, args);
    } catch (error) {
      wrapError('GET_SCORE_AGGREGATE', error);
    }
  }

  override async getScoreBreakdown(args: GetScoreBreakdownArgs): Promise<GetScoreBreakdownResponse> {
    try {
      return await scoresOps.getScoreBreakdown(this.#client, this.#schema, args);
    } catch (error) {
      wrapError('GET_SCORE_BREAKDOWN', error);
    }
  }

  override async getScoreTimeSeries(args: GetScoreTimeSeriesArgs): Promise<GetScoreTimeSeriesResponse> {
    try {
      return await scoresOps.getScoreTimeSeries(this.#client, this.#schema, args);
    } catch (error) {
      wrapError('GET_SCORE_TIME_SERIES', error);
    }
  }

  override async getScorePercentiles(args: GetScorePercentilesArgs): Promise<GetScorePercentilesResponse> {
    try {
      return await scoresOps.getScorePercentiles(this.#client, this.#schema, args);
    } catch (error) {
      wrapError('GET_SCORE_PERCENTILES', error);
    }
  }

  // -------------------------------------------------------------------------
  // OLAP — feedback
  // -------------------------------------------------------------------------

  override async getFeedbackAggregate(args: GetFeedbackAggregateArgs): Promise<GetFeedbackAggregateResponse> {
    try {
      return await feedbackOps.getFeedbackAggregate(this.#client, this.#schema, args);
    } catch (error) {
      wrapError('GET_FEEDBACK_AGGREGATE', error);
    }
  }

  override async getFeedbackBreakdown(args: GetFeedbackBreakdownArgs): Promise<GetFeedbackBreakdownResponse> {
    try {
      return await feedbackOps.getFeedbackBreakdown(this.#client, this.#schema, args);
    } catch (error) {
      wrapError('GET_FEEDBACK_BREAKDOWN', error);
    }
  }

  override async getFeedbackTimeSeries(args: GetFeedbackTimeSeriesArgs): Promise<GetFeedbackTimeSeriesResponse> {
    try {
      return await feedbackOps.getFeedbackTimeSeries(this.#client, this.#schema, args);
    } catch (error) {
      wrapError('GET_FEEDBACK_TIME_SERIES', error);
    }
  }

  override async getFeedbackPercentiles(args: GetFeedbackPercentilesArgs): Promise<GetFeedbackPercentilesResponse> {
    try {
      return await feedbackOps.getFeedbackPercentiles(this.#client, this.#schema, args);
    } catch (error) {
      wrapError('GET_FEEDBACK_PERCENTILES', error);
    }
  }

  // -------------------------------------------------------------------------
  // Discovery
  // -------------------------------------------------------------------------

  override async getEntityTypes(args: GetEntityTypesArgs): Promise<GetEntityTypesResponse> {
    try {
      return await discoveryOps.getEntityTypes(this.#client, this.#schema, args, this.#discovery);
    } catch (error) {
      wrapError('GET_ENTITY_TYPES', error);
    }
  }

  override async getEntityNames(args: GetEntityNamesArgs): Promise<GetEntityNamesResponse> {
    try {
      return await discoveryOps.getEntityNames(this.#client, this.#schema, args, this.#discovery);
    } catch (error) {
      wrapError('GET_ENTITY_NAMES', error);
    }
  }

  override async getServiceNames(args: GetServiceNamesArgs): Promise<GetServiceNamesResponse> {
    try {
      return await discoveryOps.getServiceNames(this.#client, this.#schema, args, this.#discovery);
    } catch (error) {
      wrapError('GET_SERVICE_NAMES', error);
    }
  }

  override async getEnvironments(args: GetEnvironmentsArgs): Promise<GetEnvironmentsResponse> {
    try {
      return await discoveryOps.getEnvironments(this.#client, this.#schema, args, this.#discovery);
    } catch (error) {
      wrapError('GET_ENVIRONMENTS', error);
    }
  }

  override async getTags(args: GetTagsArgs): Promise<GetTagsResponse> {
    try {
      return await discoveryOps.getTags(this.#client, this.#schema, args, this.#discovery);
    } catch (error) {
      wrapError('GET_TAGS', error);
    }
  }

  override async getMetricNames(args: GetMetricNamesArgs): Promise<GetMetricNamesResponse> {
    try {
      return await discoveryOps.getMetricNames(this.#client, this.#schema, args, this.#discovery);
    } catch (error) {
      wrapError('GET_METRIC_NAMES', error);
    }
  }

  override async getMetricLabelKeys(args: GetMetricLabelKeysArgs): Promise<GetMetricLabelKeysResponse> {
    try {
      return await discoveryOps.getMetricLabelKeys(this.#client, this.#schema, args, this.#discovery);
    } catch (error) {
      wrapError('GET_METRIC_LABEL_KEYS', error);
    }
  }

  override async getMetricLabelValues(args: GetMetricLabelValuesArgs): Promise<GetMetricLabelValuesResponse> {
    try {
      return await discoveryOps.getMetricLabelValues(this.#client, this.#schema, args, this.#discovery);
    } catch (error) {
      wrapError('GET_METRIC_LABEL_VALUES', error);
    }
  }

  // -------------------------------------------------------------------------
  // Tracing — deletes / clear
  // -------------------------------------------------------------------------

  override async batchDeleteTraces(args: BatchDeleteTracesArgs): Promise<void> {
    try {
      await tracingOps.batchDeleteTraces(this.#client, this.#schema, args);
    } catch (error) {
      wrapError('BATCH_DELETE_TRACES', error, { count: args.traceIds.length });
    }
  }

  override async dangerouslyClearAll(): Promise<void> {
    try {
      // Iterate ALL_SIGNAL_TABLES so a future signal added to the constant
      // is truncated automatically. Tracing has its own helper that runs the
      // span TRUNCATE; we skip it here to avoid running it twice.
      //
      // `RESTART IDENTITY` resets every owned sequence (notably `cursorId`
      // bigserials) so tests that clear between cases and then exercise
      // delta polling don't see surprising high-water-mark cursors. Without
      // it, sequences continue from where they left off across clears.
      await tracingOps.dangerouslyClearTracing(this.#client, this.#schema);
      for (const t of ALL_SIGNAL_TABLES) {
        if (t === TABLE_SPAN_EVENTS) continue;
        await this.#client.none(`TRUNCATE TABLE ${qualifiedTable(this.#schema, t)} RESTART IDENTITY`);
      }
      await this.#client.none(`TRUNCATE TABLE ${qualifiedTable(this.#schema, TABLE_DISCOVERY)} RESTART IDENTITY`);
    } catch (error) {
      wrapError('DANGEROUSLY_CLEAR_ALL', error);
    }
  }
}
