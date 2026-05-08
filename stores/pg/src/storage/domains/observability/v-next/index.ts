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
  GetMetricLabelKeysArgs,
  GetMetricLabelKeysResponse,
  GetMetricLabelValuesArgs,
  GetMetricLabelValuesResponse,
  GetMetricNamesArgs,
  GetMetricNamesResponse,
  GetRootSpanArgs,
  GetRootSpanResponse,
  GetServiceNamesArgs,
  GetServiceNamesResponse,
  GetSpanArgs,
  GetSpanResponse,
  GetTagsArgs,
  GetTagsResponse,
  GetTraceArgs,
  GetTraceLightResponse,
  GetTraceResponse,
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
import { allIndexDDL, allTableDDL, qualifiedTable, TABLE_DISCOVERY, triggerDDL } from './ddl';
import * as discoveryOps from './discovery';
import type { DiscoveryConfig } from './discovery';
import * as feedbackOps from './feedback';
import * as logsOps from './logs';
import * as metricsOps from './metrics';
import { detectPartman, detectTimescale, setupPartitioning } from './partitioning';
import type { PartitioningOptions, PartitionMode } from './partitioning';
import * as scoresOps from './scores';
import * as traceRootsOps from './trace-roots';
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
        await this.#client.none(ddl);
      }
      for (const ddl of triggerDDL(this.#schema)) {
        await this.#client.none(ddl);
      }
      for (const ddl of allIndexDDL(this.#schema)) {
        await this.#client.none(ddl);
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

  override async getRootSpan(args: GetRootSpanArgs): Promise<GetRootSpanResponse | null> {
    try {
      return await traceRootsOps.getRootSpan(this.#client, this.#schema, args);
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
      return await traceRootsOps.listTraces(this.#client, this.#schema, args);
    } catch (error) {
      wrapError('LIST_TRACES', error);
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

  override async listFeedback(args: ListFeedbackArgs): Promise<ListFeedbackResponse> {
    try {
      return await feedbackOps.listFeedback(this.#client, this.#schema, args);
    } catch (error) {
      wrapError('LIST_FEEDBACK', error);
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
      await tracingOps.dangerouslyClearTracing(this.#client, this.#schema);
      const cache = qualifiedTable(this.#schema, TABLE_DISCOVERY);
      for (const t of ['mastra_metric_events', 'mastra_log_events', 'mastra_score_events', 'mastra_feedback_events']) {
        await this.#client.none(`TRUNCATE TABLE ${qualifiedTable(this.#schema, t)}`);
      }
      await this.#client.none(`TRUNCATE TABLE ${cache}`);
    } catch (error) {
      wrapError('DANGEROUSLY_CLEAR_ALL', error);
    }
  }
}
