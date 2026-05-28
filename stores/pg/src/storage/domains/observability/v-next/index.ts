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
  ScoreRecord,
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

  async #run<T>(op: string, fn: () => Promise<T>, details?: Record<string, unknown>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      wrapError(op, error, details);
    }
  }

  // -------------------------------------------------------------------------
  // Tracing — writes
  // -------------------------------------------------------------------------

  override async createSpan(args: CreateSpanArgs): Promise<void> {
    await this.#run('CREATE_SPAN', () => tracingOps.createSpan(this.#client, this.#schema, args), {
      traceId: args.span.traceId,
      spanId: args.span.spanId,
    });
  }

  override async batchCreateSpans(args: BatchCreateSpansArgs): Promise<void> {
    await this.#run('BATCH_CREATE_SPANS', () => tracingOps.batchCreateSpans(this.#client, this.#schema, args), {
      count: args.records.length,
    });
  }

  // -------------------------------------------------------------------------
  // Tracing — reads
  // -------------------------------------------------------------------------

  override async getSpan(args: GetSpanArgs): Promise<GetSpanResponse | null> {
    return this.#run('GET_SPAN', () => tracingOps.getSpan(this.#client, this.#schema, args), {
      traceId: args.traceId,
      spanId: args.spanId,
    });
  }

  override async getSpans(args: GetSpansArgs): Promise<GetSpansResponse> {
    return this.#run('GET_SPANS', () => tracingOps.getSpans(this.#client, this.#schema, args), {
      traceId: args.traceId,
      count: args.spanIds.length,
    });
  }

  override async getRootSpan(args: GetRootSpanArgs): Promise<GetRootSpanResponse | null> {
    return this.#run('GET_ROOT_SPAN', () => tracesOps.getRootSpan(this.#client, this.#schema, args), {
      traceId: args.traceId,
    });
  }

  override async getTrace(args: GetTraceArgs): Promise<GetTraceResponse | null> {
    return this.#run('GET_TRACE', () => tracingOps.getTrace(this.#client, this.#schema, args), {
      traceId: args.traceId,
    });
  }

  override async getTraceLight(args: GetTraceArgs): Promise<GetTraceLightResponse | null> {
    return this.#run('GET_TRACE_LIGHT', () => tracingOps.getTraceLight(this.#client, this.#schema, args), {
      traceId: args.traceId,
    });
  }

  override async listTraces(args: ListTracesArgs): Promise<ListTracesResponse> {
    return this.#run('LIST_TRACES', () => tracesOps.listTraces(this.#client, this.#schema, args));
  }

  override async listBranches(args: ListBranchesArgs): Promise<ListBranchesResponse> {
    return this.#run('LIST_BRANCHES', () => tracesOps.listBranches(this.#client, this.#schema, args));
  }

  // -------------------------------------------------------------------------
  // Logs / metrics / scores / feedback — writes
  // -------------------------------------------------------------------------

  override async batchCreateLogs(args: BatchCreateLogsArgs): Promise<void> {
    await this.#run('BATCH_CREATE_LOGS', () => logsOps.batchCreateLogs(this.#client, this.#schema, args), {
      count: args.logs.length,
    });
  }

  override async batchCreateMetrics(args: BatchCreateMetricsArgs): Promise<void> {
    await this.#run('BATCH_CREATE_METRICS', () => metricsOps.batchCreateMetrics(this.#client, this.#schema, args), {
      count: args.metrics.length,
    });
  }

  override async createScore(args: CreateScoreArgs): Promise<void> {
    await this.#run('CREATE_SCORE', () => scoresOps.createScore(this.#client, this.#schema, args));
  }

  override async batchCreateScores(args: BatchCreateScoresArgs): Promise<void> {
    await this.#run('BATCH_CREATE_SCORES', () => scoresOps.batchCreateScores(this.#client, this.#schema, args), {
      count: args.scores.length,
    });
  }

  override async createFeedback(args: CreateFeedbackArgs): Promise<void> {
    await this.#run('CREATE_FEEDBACK', () => feedbackOps.createFeedback(this.#client, this.#schema, args));
  }

  override async batchCreateFeedback(args: BatchCreateFeedbackArgs): Promise<void> {
    await this.#run('BATCH_CREATE_FEEDBACK', () => feedbackOps.batchCreateFeedback(this.#client, this.#schema, args), {
      count: args.feedbacks.length,
    });
  }

  // -------------------------------------------------------------------------
  // Logs / metrics / scores / feedback — list reads
  // -------------------------------------------------------------------------

  override async listLogs(args: ListLogsArgs): Promise<ListLogsResponse> {
    return this.#run('LIST_LOGS', () => logsOps.listLogs(this.#client, this.#schema, args));
  }

  override async listMetrics(args: ListMetricsArgs): Promise<ListMetricsResponse> {
    return this.#run('LIST_METRICS', () => metricsOps.listMetrics(this.#client, this.#schema, args));
  }

  override async listScores(args: ListScoresArgs): Promise<ListScoresResponse> {
    return this.#run('LIST_SCORES', () => scoresOps.listScores(this.#client, this.#schema, args));
  }

  override async getScoreById(scoreId: string): Promise<ScoreRecord | null> {
    return this.#run('GET_SCORE_BY_ID', () => scoresOps.getScoreById(this.#client, this.#schema, scoreId), {
      scoreId,
    });
  }

  override async listFeedback(args: ListFeedbackArgs): Promise<ListFeedbackResponse> {
    return this.#run('LIST_FEEDBACK', () => feedbackOps.listFeedback(this.#client, this.#schema, args));
  }

  // -------------------------------------------------------------------------
  // OLAP — metrics
  // -------------------------------------------------------------------------

  override async getMetricAggregate(args: GetMetricAggregateArgs): Promise<GetMetricAggregateResponse> {
    return this.#run('GET_METRIC_AGGREGATE', () => metricsOps.getMetricAggregate(this.#client, this.#schema, args));
  }

  override async getMetricBreakdown(args: GetMetricBreakdownArgs): Promise<GetMetricBreakdownResponse> {
    return this.#run('GET_METRIC_BREAKDOWN', () => metricsOps.getMetricBreakdown(this.#client, this.#schema, args));
  }

  override async getMetricTimeSeries(args: GetMetricTimeSeriesArgs): Promise<GetMetricTimeSeriesResponse> {
    return this.#run('GET_METRIC_TIME_SERIES', () => metricsOps.getMetricTimeSeries(this.#client, this.#schema, args));
  }

  override async getMetricPercentiles(args: GetMetricPercentilesArgs): Promise<GetMetricPercentilesResponse> {
    return this.#run('GET_METRIC_PERCENTILES', () => metricsOps.getMetricPercentiles(this.#client, this.#schema, args));
  }

  // -------------------------------------------------------------------------
  // OLAP — scores
  // -------------------------------------------------------------------------

  override async getScoreAggregate(args: GetScoreAggregateArgs): Promise<GetScoreAggregateResponse> {
    return this.#run('GET_SCORE_AGGREGATE', () => scoresOps.getScoreAggregate(this.#client, this.#schema, args));
  }

  override async getScoreBreakdown(args: GetScoreBreakdownArgs): Promise<GetScoreBreakdownResponse> {
    return this.#run('GET_SCORE_BREAKDOWN', () => scoresOps.getScoreBreakdown(this.#client, this.#schema, args));
  }

  override async getScoreTimeSeries(args: GetScoreTimeSeriesArgs): Promise<GetScoreTimeSeriesResponse> {
    return this.#run('GET_SCORE_TIME_SERIES', () => scoresOps.getScoreTimeSeries(this.#client, this.#schema, args));
  }

  override async getScorePercentiles(args: GetScorePercentilesArgs): Promise<GetScorePercentilesResponse> {
    return this.#run('GET_SCORE_PERCENTILES', () => scoresOps.getScorePercentiles(this.#client, this.#schema, args));
  }

  // -------------------------------------------------------------------------
  // OLAP — feedback
  // -------------------------------------------------------------------------

  override async getFeedbackAggregate(args: GetFeedbackAggregateArgs): Promise<GetFeedbackAggregateResponse> {
    return this.#run('GET_FEEDBACK_AGGREGATE', () =>
      feedbackOps.getFeedbackAggregate(this.#client, this.#schema, args),
    );
  }

  override async getFeedbackBreakdown(args: GetFeedbackBreakdownArgs): Promise<GetFeedbackBreakdownResponse> {
    return this.#run('GET_FEEDBACK_BREAKDOWN', () =>
      feedbackOps.getFeedbackBreakdown(this.#client, this.#schema, args),
    );
  }

  override async getFeedbackTimeSeries(args: GetFeedbackTimeSeriesArgs): Promise<GetFeedbackTimeSeriesResponse> {
    return this.#run('GET_FEEDBACK_TIME_SERIES', () =>
      feedbackOps.getFeedbackTimeSeries(this.#client, this.#schema, args),
    );
  }

  override async getFeedbackPercentiles(args: GetFeedbackPercentilesArgs): Promise<GetFeedbackPercentilesResponse> {
    return this.#run('GET_FEEDBACK_PERCENTILES', () =>
      feedbackOps.getFeedbackPercentiles(this.#client, this.#schema, args),
    );
  }

  // -------------------------------------------------------------------------
  // Discovery
  // -------------------------------------------------------------------------

  override async getEntityTypes(args: GetEntityTypesArgs): Promise<GetEntityTypesResponse> {
    return this.#run('GET_ENTITY_TYPES', () =>
      discoveryOps.getEntityTypes(this.#client, this.#schema, args, this.#discovery),
    );
  }

  override async getEntityNames(args: GetEntityNamesArgs): Promise<GetEntityNamesResponse> {
    return this.#run('GET_ENTITY_NAMES', () =>
      discoveryOps.getEntityNames(this.#client, this.#schema, args, this.#discovery),
    );
  }

  override async getServiceNames(args: GetServiceNamesArgs): Promise<GetServiceNamesResponse> {
    return this.#run('GET_SERVICE_NAMES', () =>
      discoveryOps.getServiceNames(this.#client, this.#schema, args, this.#discovery),
    );
  }

  override async getEnvironments(args: GetEnvironmentsArgs): Promise<GetEnvironmentsResponse> {
    return this.#run('GET_ENVIRONMENTS', () =>
      discoveryOps.getEnvironments(this.#client, this.#schema, args, this.#discovery),
    );
  }

  override async getTags(args: GetTagsArgs): Promise<GetTagsResponse> {
    return this.#run('GET_TAGS', () => discoveryOps.getTags(this.#client, this.#schema, args, this.#discovery));
  }

  override async getMetricNames(args: GetMetricNamesArgs): Promise<GetMetricNamesResponse> {
    return this.#run('GET_METRIC_NAMES', () =>
      discoveryOps.getMetricNames(this.#client, this.#schema, args, this.#discovery),
    );
  }

  override async getMetricLabelKeys(args: GetMetricLabelKeysArgs): Promise<GetMetricLabelKeysResponse> {
    return this.#run('GET_METRIC_LABEL_KEYS', () =>
      discoveryOps.getMetricLabelKeys(this.#client, this.#schema, args, this.#discovery),
    );
  }

  override async getMetricLabelValues(args: GetMetricLabelValuesArgs): Promise<GetMetricLabelValuesResponse> {
    return this.#run('GET_METRIC_LABEL_VALUES', () =>
      discoveryOps.getMetricLabelValues(this.#client, this.#schema, args, this.#discovery),
    );
  }

  // -------------------------------------------------------------------------
  // Tracing — deletes / clear
  // -------------------------------------------------------------------------

  override async batchDeleteTraces(args: BatchDeleteTracesArgs): Promise<void> {
    await this.#run('BATCH_DELETE_TRACES', () => tracingOps.batchDeleteTraces(this.#client, this.#schema, args), {
      count: args.traceIds.length,
    });
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
