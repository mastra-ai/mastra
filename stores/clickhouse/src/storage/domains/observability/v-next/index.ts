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
import type { IMastraLogger } from '@mastra/core/logger';
import * as coreStorage from '@mastra/core/storage';
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
  ListTracesLightResponse,
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
  ScoreRecord,
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
  FeedbackRecord,
  UpdateFeedbackReviewStatusArgs,
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
  TraceQueryResponse,
  TrustedTraceQueryPlan,
} from '@mastra/core/storage';

import { resolveClickhouseConfig } from '../../../db';
import type { ClickhouseDomainConfig } from '../../../db';
import {
  addOnClusterToDDL,
  applyReplicationToDDL,
  isReplicationConfigured,
  isReplicatedOrSharedEngine,
} from '../../../db/replication';
import type { ClickhouseReplicationConfig } from '../../../db/replication';

import {
  BASE_MV_DDL,
  BASE_TABLE_DDL,
  buildAllTableDDL,
  buildAllMvDDL,
  ALL_MIGRATIONS,
  DISCOVERY_MV_DDL,
  ALL_TABLE_NAMES,
  DELTA_CURSOR_COUNTER_NAMES,
  DELTA_MV_NAMES,
  MV_DISCOVERY_VALUES,
  MV_DISCOVERY_PAIRS,
  TABLE_DISCOVERY_VALUES,
  TABLE_DISCOVERY_PAIRS,
  TABLE_SPAN_EVENTS,
  TABLE_TRACE_ROOTS,
  TABLE_TRACE_ROOTS_BACKFILL,
  buildRetentionEntries,
  parseTtlExpression,
} from './ddl';
import type { MigrationEntry, RetentionEntry, RetentionConfig } from './ddl';
export type { RetentionConfig } from './ddl';

export async function backfillTraceRoots(client: ClickHouseClient): Promise<void> {
  const markerResult = await client.query({
    query: `SELECT count() AS count FROM ${TABLE_TRACE_ROOTS_BACKFILL} WHERE id = 1`,
    format: 'JSONEachRow',
  });
  const [marker] = await markerResult.json<{ count: number }>();
  if (Number(marker?.count) > 0) return;

  await client.command({
    query: `INSERT INTO ${TABLE_TRACE_ROOTS}
SELECT s.*
FROM ${TABLE_SPAN_EVENTS} s
LEFT ANTI JOIN ${TABLE_TRACE_ROOTS} existing
  ON existing.dedupeKey = s.dedupeKey
  AND existing.ingestionVersion = s.ingestionVersion
WHERE s.parentSpanId IS NULL`,
  });
  await client.command({ query: `INSERT INTO ${TABLE_TRACE_ROOTS_BACKFILL} VALUES (1, now64(3))` });
}

/** Extended config for v-next observability, adding per-signal retention. */
export type VNextObservabilityConfig = ClickhouseDomainConfig & {
  retention?: RetentionConfig;
  /** Maximum execution time for one advanced trace query. Default 15 seconds. */
  traceQueryTimeoutMs?: number;
  /** @internal Test-only override for the ClickHouse delta cursor strategy. */
  deltaCursorStrategy?: ClickHouseDeltaCursorStrategy;
};
import * as discoveryOps from './discovery';
import * as feedbackOps from './feedback';
import * as logsOps from './logs';
import * as metricsOps from './metrics';
import {
  checkLegacySpanMigrationStatus,
  checkSignalTablesMigrationStatus,
  isReplacingMergeTreeEngine,
  migrateLegacySpans,
  migrateSignalTables,
} from './migration';
import type { ClickHouseDeltaCursorStrategy } from './polling';
import { deltaPollingSupported } from './polling';
import * as scoresOps from './scores';
import * as traceQueryOps from './trace-query';
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
    `MIGRATION REQUIRED: ${args.store} observability tables need the current replacement schema\n` +
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
    `  1. Create replacement tables with current signal IDs and ingestion versions\n` +
    `  2. Backfill missing identifiers and deterministic legacy versions\n` +
    `  3. Swap the migrated tables into place\n` +
    `\n` +
    `WARNING: This migration recreates the signal tables and may take significant\n` +
    `time for large databases. Please ensure you have a backup before proceeding.\n` +
    `===========================================================================\n`
  );
}

/**
 * Returns migrations whose target column/index does not yet exist. Falls back
 * to running every migration if introspection fails — preserves correctness on
 * older ClickHouse versions or restricted-permission users.
 */
async function filterAppliedMigrations(
  client: ClickHouseClient,
  migrations: readonly MigrationEntry[],
): Promise<readonly MigrationEntry[]> {
  if (migrations.length === 0) return migrations;

  const tables = [...new Set(migrations.map(m => m.table))];

  let existingColumns: Map<string, Set<string>>;
  let existingIndices: Map<string, Set<string>>;
  try {
    [existingColumns, existingIndices] = await Promise.all([
      queryNamesByTable(
        client,
        `SELECT table, name FROM system.columns WHERE database = currentDatabase() AND table IN ({tables:Array(String)})`,
        tables,
      ),
      queryNamesByTable(
        client,
        `SELECT table, name FROM system.data_skipping_indices WHERE database = currentDatabase() AND table IN ({tables:Array(String)})`,
        tables,
      ),
    ]);
  } catch {
    return migrations;
  }

  return migrations.filter(m => {
    const present = m.kind === 'column' ? existingColumns.get(m.table) : existingIndices.get(m.table);
    // If we don't have introspection data for this table, run the migration
    // (table may not exist yet — preceding CREATE TABLE IF NOT EXISTS handles it).
    if (!present) return true;
    return !present.has(m.name);
  });
}

/**
 * Returns retention entries whose `MODIFY TTL` would actually change the
 * table's TTL. Falls back to running every entry if introspection fails.
 */
async function filterAppliedRetention(
  client: ClickHouseClient,
  entries: readonly RetentionEntry[],
): Promise<readonly RetentionEntry[]> {
  if (entries.length === 0) return entries;

  const tables = [...new Set(entries.map(e => e.table))];

  let createQueries: Map<string, string>;
  try {
    const result = await client.query({
      query: `SELECT name, create_table_query FROM system.tables WHERE database = currentDatabase() AND name IN ({tables:Array(String)})`,
      query_params: { tables },
      format: 'JSONEachRow',
    });
    const rows = (await result.json()) as Array<{ name: string; create_table_query: string }>;
    createQueries = new Map(rows.map(r => [r.name, r.create_table_query ?? '']));
  } catch {
    return entries;
  }

  return entries.filter(e => {
    const createQuery = createQueries.get(e.table);
    if (!createQuery) return true;
    const current = parseTtlExpression(createQuery);
    if (!current) return true;
    return current.column !== e.column || current.days !== e.days;
  });
}

/**
 * Reconciles the discovery helper tables with the engine declared in the
 * current DDL. Skips tables that are already on the expected engine or that
 * don't exist yet; in those cases the regular `CREATE TABLE IF NOT EXISTS`
 * in init() handles them.
 *
 * When an engine mismatch is found, the refreshable MV is dropped first so
 * it can't write into the table mid-drop, then the table itself is dropped.
 * Init's subsequent `CREATE TABLE IF NOT EXISTS` and discovery MV bootstrap
 * recreate both with the current definitions.
 *
 * Separately, a refreshable MV whose stored definition lacks the `APPEND`
 * modifier (created by older releases) is dropped — keeping its target
 * table — so the MV bootstrap recreates it with the current APPEND
 * definition. Non-APPEND refreshes swap the target table atomically, which
 * fails when the target is Replicated inside a non-Replicated database.
 *
 * Silently returns if `system.tables` can't be queried — the rest of init
 * will still run and leave any existing tables untouched.
 */
async function assertExistingTablesCompatibleWithReplication(
  client: ClickHouseClient,
  replication: ClickhouseReplicationConfig | undefined,
  logger: IMastraLogger,
): Promise<void> {
  if (!isReplicationConfigured(replication)) return;

  const result = await client.query({
    query: `SELECT name, engine FROM system.tables WHERE database = currentDatabase() AND name IN ({tables:Array(String)})`,
    query_params: { tables: [...ALL_TABLE_NAMES] },
    format: 'JSONEachRow',
  });
  const rows = (await result.json()) as Array<{ name: string; engine: string }>;
  const localTable = rows.find(row => !isReplicatedOrSharedEngine(row.engine));

  if (localTable) {
    logger.warn(
      `ClickHouse replication is enabled, but pre-existing observability table '${localTable.name}' uses local engine '${localTable.engine}'. ` +
        `CREATE TABLE IF NOT EXISTS will leave existing tables untouched.`,
    );
  }
}

async function reconcileDiscoveryTables(
  client: ClickHouseClient,
  replication?: ClickhouseReplicationConfig,
): Promise<void> {
  let engines: Map<string, string>;
  let mvCreateQueries: Map<string, string>;
  try {
    const result = await client.query({
      query: `SELECT name, engine, create_table_query FROM system.tables WHERE database = currentDatabase() AND name IN ({tables:Array(String)})`,
      query_params: {
        tables: [TABLE_DISCOVERY_VALUES, TABLE_DISCOVERY_PAIRS, MV_DISCOVERY_VALUES, MV_DISCOVERY_PAIRS],
      },
      format: 'JSONEachRow',
    });
    const rows = (await result.json()) as Array<{ name: string; engine: string; create_table_query: string }>;
    engines = new Map(rows.map(r => [r.name, r.engine]));
    mvCreateQueries = new Map(rows.map(r => [r.name, r.create_table_query]));
  } catch {
    return;
  }

  const targets: Array<{ table: string; mv: string }> = [
    { table: TABLE_DISCOVERY_VALUES, mv: MV_DISCOVERY_VALUES },
    { table: TABLE_DISCOVERY_PAIRS, mv: MV_DISCOVERY_PAIRS },
  ];

  // ClickHouse Cloud rewrites `ReplacingMergeTree` to `SharedReplacingMergeTree`
  // and self-managed replicated clusters rewrite it to `ReplicatedReplacingMergeTree`.
  // `isReplacingMergeTreeEngine` accepts all three so we don't churn the helper
  // tables on every init for those deployments.
  for (const { table, mv } of targets) {
    const engine = engines.get(table);
    if (engine && !isReplacingMergeTreeEngine(engine)) {
      await client.command({ query: addOnClusterToDDL(`DROP VIEW IF EXISTS ${mv}`, replication) });
      await client.command({ query: addOnClusterToDDL(`DROP TABLE IF EXISTS ${table}`, replication) });
      continue;
    }

    // Older deployments created the refreshable MVs without APPEND, which
    // makes refreshes perform an atomic table swap — that fails (error 36)
    // when the target table is Replicated inside a non-Replicated database.
    // Drop only the stale view (keeping its target table and data); init()'s
    // subsequent `CREATE MATERIALIZED VIEW IF NOT EXISTS` recreates it with
    // the current APPEND definition.
    const createQuery = mvCreateQueries.get(mv);
    if (createQuery && /REFRESH EVERY/i.test(createQuery) && !/\bAPPEND\b/i.test(createQuery)) {
      await client.command({ query: addOnClusterToDDL(`DROP VIEW IF EXISTS ${mv}`, replication) });
    }
  }
}

async function queryNamesByTable(
  client: ClickHouseClient,
  query: string,
  tables: string[],
): Promise<Map<string, Set<string>>> {
  const result = await client.query({
    query,
    query_params: { tables },
    format: 'JSONEachRow',
  });
  const rows = (await result.json()) as Array<{ table: string; name: string }>;
  const out = new Map<string, Set<string>>();
  for (const row of rows) {
    let set = out.get(row.table);
    if (!set) {
      set = new Set<string>();
      out.set(row.table, set);
    }
    set.add(row.name);
  }
  return out;
}

async function detectDeltaCursorStrategy(
  client: ClickHouseClient,
  override?: ClickHouseDeltaCursorStrategy,
  existingStrategy?: ClickHouseDeltaCursorStrategy | 'mixed' | null,
): Promise<ClickHouseDeltaCursorStrategy> {
  if (override) {
    return override;
  }

  if (existingStrategy && existingStrategy !== 'mixed') {
    return existingStrategy;
  }

  try {
    await client.query({
      query: `SELECT generateSerialID({counterName:String}) AS cursorId`,
      query_params: { counterName: 'mastra_observability_delta_cursor_probe' },
      format: 'JSONEachRow',
    });
    return 'serial';
  } catch {
    return 'fallback';
  }
}

async function detectExistingDeltaCursorStrategy(
  client: ClickHouseClient,
): Promise<ClickHouseDeltaCursorStrategy | 'mixed' | null> {
  try {
    const mvResult = await client.query({
      query: `
        SELECT name, create_table_query
        FROM system.tables
        WHERE database = currentDatabase()
          AND name IN ({tables:Array(String)})
      `,
      query_params: { tables: [...DELTA_MV_NAMES] },
      format: 'JSONEachRow',
    });

    const mvRows = (await mvResult.json()) as Array<{ name: string; create_table_query?: string | null }>;
    if (mvRows.length === 0) {
      return null;
    }

    let sawSerialMv = false;
    let sawFallbackMv = false;

    for (const row of mvRows) {
      const ddl = row.create_table_query ?? '';
      if (ddl.includes('generateSerialID(')) {
        sawSerialMv = true;
      } else if (ddl.includes('farmFingerprint64(')) {
        sawFallbackMv = true;
      }
    }

    if (sawSerialMv && sawFallbackMv) {
      return 'mixed';
    }

    if (sawSerialMv) {
      return 'serial';
    }

    if (sawFallbackMv) {
      return 'fallback';
    }

    return null;
  } catch {
    return null;
  }
}

export class ObservabilityStorageClickhouseVNext extends ObservabilityStorage {
  readonly #client: ClickHouseClient;
  readonly #retention?: RetentionConfig;
  readonly #replication?: ClickhouseReplicationConfig;
  readonly #deltaCursorStrategyOverride?: ClickHouseDeltaCursorStrategy;
  readonly #traceQueryTimeoutMs: number;
  #deltaCursorStrategy: ClickHouseDeltaCursorStrategy | null = 'fallback';

  constructor(config: VNextObservabilityConfig) {
    super();
    const { client, replication } = resolveClickhouseConfig(config);
    this.#client = client;
    this.#replication = replication;
    this.#retention = config.retention;
    this.#deltaCursorStrategyOverride = config.deltaCursorStrategy;
    this.#traceQueryTimeoutMs = coreStorage.resolveTraceQueryTimeoutMs(config.traceQueryTimeoutMs);
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

    // Non-blocking: detect legacy span table and suggest migration
    try {
      const legacyStatus = await checkLegacySpanMigrationStatus(this.#client);
      if (legacyStatus.needsMigration) {
        this.logger?.warn?.(
          `Legacy span table 'mastra_ai_spans' detected. ` +
            `Run 'npx mastra migrate' to migrate historical spans to the v-next schema.`,
        );
      }
    } catch {
      // Ignore — non-critical detection
    }

    try {
      await assertExistingTablesCompatibleWithReplication(this.#client, this.#replication, this.logger);
      const existingStrategy = await detectExistingDeltaCursorStrategy(this.#client);
      if (existingStrategy === 'mixed') {
        this.#deltaCursorStrategy = null;
        this.logger.error(
          'ClickHouse observability delta tables use mixed cursor schemas; delta polling has been disabled for this store instance.',
        );
      } else if (this.#deltaCursorStrategyOverride) {
        this.#deltaCursorStrategy = this.#deltaCursorStrategyOverride;
      } else if (existingStrategy) {
        this.#deltaCursorStrategy = existingStrategy;
      } else {
        this.#deltaCursorStrategy = await detectDeltaCursorStrategy(this.#client, undefined, existingStrategy);
      }

      // Align the discovery helper tables with the current DDL. The discovery
      // tables are fully derived from the base signal tables and get
      // repopulated by the refreshable MV at the end of init(), so it is safe
      // to recreate them in place when the engine doesn't match.
      await reconcileDiscoveryTables(this.#client, this.#replication);

      // Core tables + incremental MVs (must succeed)
      const coreDdl =
        this.#deltaCursorStrategy === null
          ? [...BASE_TABLE_DDL, ...BASE_MV_DDL]
          : [...buildAllTableDDL(), ...buildAllMvDDL(this.#deltaCursorStrategy)];
      for (const ddl of coreDdl) {
        await this.#client.command({ query: applyReplicationToDDL(ddl, this.#replication) });
      }

      // Additive migrations for existing databases (add new columns/indexes).
      // Filter out ALTERs whose target already exists: on Replicated/Shared
      // MergeTree, every issued ALTER bumps the table's metadata version
      // even when `IF NOT EXISTS` is a no-op, causing replica-lag retry
      // errors on every boot when multiple replicas/pods race.
      const pendingMigrations = await filterAppliedMigrations(this.#client, ALL_MIGRATIONS);
      for (const migration of pendingMigrations) {
        await this.#client.command({ query: addOnClusterToDDL(migration.sql, this.#replication) });
      }

      // Materialized views only process new inserts. Reconcile roots that predate
      // the trace_roots table or its view before trace queries use it.
      await backfillTraceRoots(this.#client);

      // Apply retention TTL if configured (per design doc: per-signal, day increments).
      // Skip statements whose current TTL already matches: `MODIFY TTL` bumps the
      // metadata version unconditionally, so re-issuing it on every boot is the
      // primary source of replica-catch-up races in deployments with retention.
      if (this.#retention) {
        const pendingRetention = await filterAppliedRetention(this.#client, buildRetentionEntries(this.#retention));
        for (const entry of pendingRetention) {
          await this.#client.command({ query: addOnClusterToDDL(entry.sql, this.#replication) });
        }
      }

      // Burn `cursorId = 0` for every delta stream on the `serial` strategy.
      // `generateSerialID` is server-lifetime keyed and returns 0 on first
      // call; `max(cursorId)` on an empty delta table also returns 0. Without
      // this step the very first row inserted after a server cold-start lands
      // at `cursorId = 0` and is skipped by callers that read with
      // `WHERE cursorId > 0` after capturing a head cursor on the empty
      // stream. Advancing each counter once at init guarantees real rows
      // start at `cursorId >= 1`. Safe to repeat: the cost is one extra
      // counter tick per signal per init, and the only observable effect is
      // that the stream skips the value 0 (which carries no row).
      if (this.#deltaCursorStrategy === 'serial') {
        for (const counterName of DELTA_CURSOR_COUNTER_NAMES) {
          await this.#client.query({
            query: `SELECT generateSerialID({counterName:String}) AS cursorId`,
            query_params: { counterName },
            format: 'JSONEachRow',
          });
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
        await this.#client.command({ query: addOnClusterToDDL(ddl, this.#replication) });
      }
      // Trigger an immediate refresh so discovery data is available right away
      // instead of waiting for the first scheduled refresh cycle.
      // SYSTEM REFRESH VIEW kicks off the refresh; SYSTEM WAIT VIEW blocks
      // until it finishes (or re-throws if the refresh failed). Under
      // replication these run ON CLUSTER so every replica's refreshable MV
      // schedule is kicked, not just the coordinator's.
      await this.#client.command({
        query: addOnClusterToDDL(`SYSTEM REFRESH VIEW ${MV_DISCOVERY_VALUES}`, this.#replication),
      });
      await this.#client.command({
        query: addOnClusterToDDL(`SYSTEM WAIT VIEW ${MV_DISCOVERY_VALUES}`, this.#replication),
      });
      await this.#client.command({
        query: addOnClusterToDDL(`SYSTEM REFRESH VIEW ${MV_DISCOVERY_PAIRS}`, this.#replication),
      });
      await this.#client.command({
        query: addOnClusterToDDL(`SYSTEM WAIT VIEW ${MV_DISCOVERY_PAIRS}`, this.#replication),
      });
    } catch {
      // Discovery MVs may fail on ClickHouse versions without refreshable MV support.
      // Discovery methods will return empty results until the MVs are created and refreshed.
    }
  }

  /**
   * Manually migrate legacy tables to the v-next schema.
   * Handles both signal table migrations (MergeTree → ReplacingMergeTree)
   * and legacy span migration (mastra_ai_spans → mastra_span_events).
   */
  async migrateSpans(): Promise<{
    success: boolean;
    alreadyMigrated: boolean;
    duplicatesRemoved: number;
    message: string;
  }> {
    const messages: string[] = [];

    // Signal table migration
    const signalStatus = await checkSignalTablesMigrationStatus(this.#client);
    if (signalStatus.needsMigration) {
      if (isReplicationConfigured(this.#replication)) {
        throw new MastraError({
          id: createStorageErrorId('CLICKHOUSE', 'REPLICATION', 'SIGNAL_TABLES_MIGRATION_UNSUPPORTED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text:
            'ClickHouse replication is enabled, so Mastra will not run copy-and-swap signal table migrations automatically. ' +
            'Migrate existing local signal tables manually before enabling replication.',
        });
      }
      await migrateSignalTables(this.#client, this.logger);
      messages.push(`Migrated signal tables: ${signalStatus.tables.map(t => t.table).join(', ')}.`);
    }

    // Legacy span migration
    const legacyStatus = await checkLegacySpanMigrationStatus(this.#client);
    if (legacyStatus.needsMigration) {
      if (isReplicationConfigured(this.#replication)) {
        throw new MastraError({
          id: createStorageErrorId('CLICKHOUSE', 'REPLICATION', 'LEGACY_SPAN_MIGRATION_UNSUPPORTED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: 'ClickHouse replication is enabled. Migrate legacy mastra_ai_spans manually before enabling replication.',
        });
      }
      const result = await migrateLegacySpans(this.#client, this.logger);
      messages.push(`Migrated ${result.migratedRows} legacy spans in ${result.batches} batches.`);
    }

    const alreadyMigrated = !signalStatus.needsMigration && !legacyStatus.needsMigration;

    return {
      success: true,
      alreadyMigrated,
      duplicatesRemoved: 0,
      message: alreadyMigrated ? 'Migration already complete.' : `Migration complete. ${messages.join(' ')}`,
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

  override getFeatures() {
    if (!deltaPollingSupported(this.#deltaCursorStrategy)) {
      return ['metrics', 'logs', 'trace-query'] as const;
    }

    return ['metrics', 'logs', 'delta-polling', 'trace-query'] as const;
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
      return await traceRootsOps.listTraces(this.#client, args, this.#deltaCursorStrategy);
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

  override async queryTraces(plan: TrustedTraceQueryPlan): Promise<TraceQueryResponse> {
    try {
      return await traceQueryOps.queryTraces(this.#client, plan, this.#traceQueryTimeoutMs);
    } catch (error) {
      if (error instanceof MastraError || error instanceof coreStorage.TraceQueryExecutionError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'QUERY_TRACES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  override async listTracesLight(args: ListTracesArgs): Promise<ListTracesLightResponse> {
    try {
      return await traceRootsOps.listTracesLight(this.#client, args, this.#deltaCursorStrategy);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'LIST_TRACES_LIGHT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  override async listBranches(args: ListBranchesArgs): Promise<ListBranchesResponse> {
    try {
      return await tracingOps.listBranches(this.#client, args, this.#deltaCursorStrategy);
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
      return await logsOps.listLogs(this.#client, args, this.#deltaCursorStrategy);
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
      return await metricsOps.listMetrics(this.#client, args, this.#deltaCursorStrategy);
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
      return await scoresOps.listScores(this.#client, args, this.#deltaCursorStrategy);
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

  override async getScoreById(scoreId: string): Promise<ScoreRecord | null> {
    try {
      return await scoresOps.getScoreById(this.#client, scoreId);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'GET_SCORE_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { scoreId },
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

  override async updateFeedbackReviewStatus(args: UpdateFeedbackReviewStatusArgs): Promise<FeedbackRecord> {
    try {
      return await feedbackOps.updateFeedbackReviewStatus(this.#client, args);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('CLICKHOUSE', 'UPDATE_FEEDBACK_REVIEW_STATUS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { feedbackId: args.feedbackId },
        },
        error,
      );
    }
  }

  override async listFeedback(args: ListFeedbackArgs): Promise<ListFeedbackResponse> {
    try {
      return await feedbackOps.listFeedback(this.#client, args, this.#deltaCursorStrategy);
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
      // Truncate all signal tables. Under replication we fan out via ON CLUSTER
      // so every replica is cleared rather than only the receiving node.
      await Promise.all(
        ALL_TABLE_NAMES.map(table =>
          this.#client.command({
            query: addOnClusterToDDL(`TRUNCATE TABLE IF EXISTS ${table}`, this.#replication),
          }),
        ),
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
