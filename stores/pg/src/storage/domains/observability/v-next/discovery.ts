/**
 * Discovery operations for the v-next Postgres observability domain.
 *
 * Backed by a single cache table (`mastra_observability_discovery`) keyed by a
 * cacheKey string. Reads use stale-while-revalidate semantics:
 *
 *   - if no cache row exists, compute synchronously and serve.
 *   - if cache row exists and is fresher than `discoveryTtlSeconds`, serve as-is.
 *   - if cache row is stale, kick off an async refresh and serve the cached
 *     value. Generic discovery values use last-write-wins upserts; tag
 *     discovery additionally serializes its value/cursor refresh across
 *     processes with a PostgreSQL advisory lock.
 *
 * No in-memory caching: the table-backed cache works across multiple
 * frontends pointing at the same database and survives serverless restarts.
 */

import type { IMastraLogger } from '@mastra/core/logger';
import type {
  EntityType,
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
} from '@mastra/core/storage';

import { parseSqlIdentifier } from '@mastra/core/utils';

import type { DbClient, TxClient } from '../../../client';
import {
  qualifiedTable,
  TABLE_DISCOVERY,
  TABLE_LOG_EVENTS,
  TABLE_METRIC_EVENTS,
  TABLE_SCORE_EVENTS,
  TABLE_FEEDBACK_EVENTS,
  TABLE_SPAN_EVENTS,
} from './ddl';
import { decodeDeltaCursor, encodeDeltaCursor, readSafeXactHorizon } from './polling';
import type { DeletedTraceTagRow } from './tracing';

const DEFAULT_TTL_SECONDS = 5 * 60; // 5 minutes

/** All signal tables that contain a column. Used by cross-signal discovery. */
const SIGNAL_TABLES_WITH_CONTEXT = [
  TABLE_SPAN_EVENTS,
  TABLE_METRIC_EVENTS,
  TABLE_LOG_EVENTS,
  TABLE_SCORE_EVENTS,
  TABLE_FEEDBACK_EVENTS,
] as const;

/** Tables for entity-type / entity-name / tag discovery (excludes scores/feedback). */
const ENTITY_DISCOVERY_TABLES = [TABLE_SPAN_EVENTS, TABLE_METRIC_EVENTS, TABLE_LOG_EVENTS] as const;

export interface DiscoveryConfig {
  /** TTL for cached values in seconds. Default 300 (5 minutes). */
  ttlSeconds?: number;
  /**
   * Logger used to report background refresh failures. Injected by the
   * domain class (`ObservabilityStoragePostgresVNext`) so discovery
   * warnings land in the framework logger alongside the rest of the store.
   * Falls back to `console.warn` when absent so direct callers (tests,
   * scripts) still see refresh failures.
   * @internal
   */
  logger?: IMastraLogger;
}

/**
 * In-process dedupe for concurrent refreshes against the same cache key.
 *
 * Covers two stampede shapes:
 *  - cold start: N concurrent first-callers all want the values, but only
 *    one of them needs to actually run the refresh-and-store operation. The
 *    others await the same promise.
 *  - stale refresh: N concurrent stale-readers serve the cached values
 *    immediately and share one background refresh.
 *
 * The map keys are `"schema:cacheKey"` so multiple schemas using the same
 * key don't share an entry. Entries clear themselves via `.finally` after
 * the refresh settles.
 */
const inFlightRefreshes = new Map<string, Promise<string[]>>();

function startOrJoinRefresh(
  dedupeKey: string,
  cacheKey: string,
  refreshAndStore: () => Promise<string[]>,
  logger: IMastraLogger | undefined,
): Promise<string[]> {
  const existing = inFlightRefreshes.get(dedupeKey);
  if (existing) return existing;

  const promise = (async () => {
    try {
      return await refreshAndStore();
    } catch (error) {
      // Surface refresh failures — silently swallowing them would mask real
      // DB/connectivity issues behind permanently stale data. Prefer the
      // framework logger so warnings land in the same stream as the rest
      // of the store; fall back to console.warn for direct callers (tests,
      // scripts) that don't inject one.
      const message = `[observability/v-next] background refresh failed for discovery cache key "${cacheKey}"`;
      if (logger) {
        logger.warn(message, { error });
      } else {
        console.warn(message + ':', error);
      }
      throw error;
    } finally {
      inFlightRefreshes.delete(dedupeKey);
    }
  })();

  inFlightRefreshes.set(dedupeKey, promise);
  return promise;
}

/**
 * Read the cache row for `cacheKey` and decide whether to refresh.
 *
 * Stale-while-revalidate semantics:
 *  - Fresh cache hit: return the stored values immediately.
 *  - Stale cache hit: return the cached values immediately AND kick off a
 *    background refresh (deduped) so the next reader sees fresh data.
 *    Concurrent stale readers don't await the shared refresh — that's the
 *    "while-revalidate" half of SWR.
 *  - Cold miss (no row at all): block on the refresh and return its values.
 *    Concurrent cold callers share one refresh promise via the dedupe map.
 */
async function readWithRefresh(
  client: DbClient,
  schema: string,
  cacheKey: string,
  refresh: () => Promise<string[]>,
  ttlSeconds: number,
  logger: IMastraLogger | undefined,
  options?: { refreshStoresValues?: boolean },
): Promise<string[]> {
  const table = qualifiedTable(schema, TABLE_DISCOVERY);
  // pg returns `timestamptz` as a JS Date — type the field accordingly.
  const row = await client.oneOrNone<{ values: string[]; refreshedAt: Date }>(
    `SELECT "values", "refreshedAt" FROM ${table} WHERE "cacheKey" = $1`,
    [cacheKey],
  );

  const refreshedAtMs = row ? new Date(row.refreshedAt).getTime() : 0;
  const stale = !row || Date.now() - refreshedAtMs > ttlSeconds * 1000;

  if (!stale) return row!.values;

  const dedupeKey = `${schema}:${cacheKey}`;
  const refreshAndStore =
    options?.refreshStoresValues === true
      ? refresh
      : async () => {
          const values = await refresh();
          await upsertCache(client, schema, cacheKey, values);
          return values;
        };
  const refreshing = startOrJoinRefresh(dedupeKey, cacheKey, refreshAndStore, logger);

  // Force-refresh path: `ttlSeconds <= 0` is the contract used by
  // `refreshAllDiscoveryCaches()` (and the future `mastra observability
  // discovery refresh` CLI) to mean "block until the cache is rewritten".
  // Without this branch a stale-but-existing row would serve immediately and
  // resolve before the background refresh writes the new values, defeating
  // the whole point of a manual refresh.
  if (ttlSeconds <= 0) {
    try {
      return await refreshing;
    } catch {
      // Already logged inside startOrJoinRefresh. Fall back to whatever we
      // had cached so the caller still gets a defined value.
      return row?.values ?? [];
    }
  }

  if (!row) {
    // Cold path: no cached values to serve. Block on (or join) the refresh.
    try {
      return await refreshing;
    } catch {
      // Already logged inside startOrJoinRefresh; return empty so the caller
      // gets a defined value instead of throwing.
      return [];
    }
  }

  // Stale path: serve the cached values immediately. Suppress the
  // unhandled-rejection warning since the helper already logs.
  refreshing.catch(() => {});
  return row.values;
}

async function upsertCache(
  client: Pick<DbClient, 'query'>,
  schema: string,
  cacheKey: string,
  values: string[],
): Promise<void> {
  const table = qualifiedTable(schema, TABLE_DISCOVERY);
  await client.query(
    `INSERT INTO ${table} ("cacheKey", "refreshedAt", "values")
     VALUES ($1, NOW(), $2::jsonb)
     ON CONFLICT ("cacheKey") DO UPDATE SET
       "refreshedAt" = EXCLUDED."refreshedAt",
       "values" = EXCLUDED."values"`,
    [cacheKey, JSON.stringify(values)],
  );
}

const ZERO_CURSOR = '0:0';

function tagCursorCacheKey(cacheKey: string, table: string): string {
  return `${cacheKey}:cursor:${table}`;
}

function readCachedCursor(values: unknown): string | null {
  if (!Array.isArray(values) || typeof values[0] !== 'string') return null;
  try {
    const cursor = decodeDeltaCursor(values[0]);
    return encodeDeltaCursor(cursor.xactId, cursor.cursorId);
  } catch {
    // Discovery state is disposable. A malformed cursor should cause a safe
    // full rebuild rather than make tag discovery permanently fail.
    return null;
  }
}

interface IncrementalTagsResult {
  values: string[];
  xactId: string | null;
  cursorId: string | null;
}

async function readIncrementalTags(
  client: Pick<TxClient, 'one'>,
  schema: string,
  table: string,
  cursor: string,
  safeXactHorizon: string,
  entityType?: EntityType,
): Promise<IncrementalTagsResult> {
  const { xactId, cursorId } = decodeDeltaCursor(cursor);
  const entityFilter = entityType ? `AND "entityType" = $4` : '';
  const params: unknown[] = [xactId, cursorId, safeXactHorizon];
  if (entityType) params.push(entityType);

  return client.one<IncrementalTagsResult>(
    `WITH new_rows AS MATERIALIZED (
       SELECT "xactId", "cursorId", "entityType", "tags"
       FROM ${qualifiedTable(schema, table)}
       WHERE ("xactId", "cursorId") > ($1::xid8, $2::bigint)
         AND "xactId" < $3::xid8
     ),
     new_tags AS (
       SELECT DISTINCT tag AS v
       FROM new_rows
       CROSS JOIN LATERAL UNNEST("tags") AS expanded(tag)
       WHERE tag IS NOT NULL AND tag <> '' ${entityFilter}
     ),
     last_cursor AS (
       SELECT "xactId", "cursorId"
       FROM new_rows
       ORDER BY "xactId" DESC, "cursorId" DESC
       LIMIT 1
     )
     SELECT
       COALESCE((SELECT ARRAY_AGG(v ORDER BY v) FROM new_tags), '{}'::text[]) AS "values",
       (SELECT "xactId"::text FROM last_cursor) AS "xactId",
       (SELECT "cursorId"::text FROM last_cursor) AS "cursorId"`,
    params,
  );
}

async function refreshTagsIncrementally(
  client: DbClient,
  schema: string,
  cacheKey: string,
  args: GetTagsArgs,
  ttlSeconds: number,
): Promise<string[]> {
  const discoveryTable = qualifiedTable(schema, TABLE_DISCOVERY);
  const cursorKeys = ENTITY_DISCOVERY_TABLES.map(table => tagCursorCacheKey(cacheKey, table));

  return client.tx(async tx => {
    // The in-memory map only dedupes callers in this process. A transaction
    // advisory lock serializes refreshes across server instances that share
    // the same schema and cache key.
    await tx.query(`SET LOCAL lock_timeout = '5s'`);
    await tx.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`${schema}:${cacheKey}`]);

    const current = await tx.oneOrNone<{ values: string[]; refreshedAt: Date }>(
      `SELECT "values", "refreshedAt" FROM ${discoveryTable} WHERE "cacheKey" = $1`,
      [cacheKey],
    );

    // Another process may have refreshed while this caller waited for the
    // lock. Recheck freshness before touching the signal tables.
    if (ttlSeconds > 0 && current) {
      const ageMs = Date.now() - new Date(current.refreshedAt).getTime();
      if (ageMs <= ttlSeconds * 1000) return current.values;
    }

    const cursorRows = current
      ? await tx.manyOrNone<{ cacheKey: string; values: unknown }>(
          `SELECT "cacheKey", "values"
           FROM ${discoveryTable}
           WHERE "cacheKey" = ANY($1::text[])`,
          [cursorKeys],
        )
      : [];
    const cursorByKey = new Map(cursorRows.map(row => [row.cacheKey, readCachedCursor(row.values)]));
    const canRefreshIncrementally =
      current !== null && cursorKeys.every(key => typeof cursorByKey.get(key) === 'string');
    const safeXactHorizon = await readSafeXactHorizon(tx);
    const discovered = new Set(canRefreshIncrementally ? (current?.values ?? []) : []);
    const nextCursors = new Map<string, string>();

    for (const table of ENTITY_DISCOVERY_TABLES) {
      const cursorKey = tagCursorCacheKey(cacheKey, table);
      const cursor = canRefreshIncrementally ? (cursorByKey.get(cursorKey) ?? ZERO_CURSOR) : ZERO_CURSOR;
      const result = await readIncrementalTags(tx, schema, table, cursor, safeXactHorizon, args.entityType);
      for (const value of result.values) discovered.add(value);
      nextCursors.set(
        cursorKey,
        result.xactId !== null && result.cursorId !== null ? encodeDeltaCursor(result.xactId, result.cursorId) : cursor,
      );
    }

    const values = [...discovered].sort();
    await upsertCache(tx, schema, cacheKey, values);
    for (const [cursorKey, cursor] of nextCursors) {
      await upsertCache(tx, schema, cursorKey, [cursor]);
    }
    return values;
  });
}

/** Return candidate tags that are still referenced by any discovery signal. */
async function readSurvivingTags(
  client: Pick<TxClient, 'manyOrNone'>,
  schema: string,
  candidates: string[],
  entityType?: EntityType,
): Promise<Set<string>> {
  const entityFilter = entityType ? `AND "entityType" = $2` : '';
  const params: unknown[] = [candidates];
  if (entityType) params.push(entityType);
  const references = ENTITY_DISCOVERY_TABLES.map(
    table =>
      `SELECT 1
       FROM ${qualifiedTable(schema, table)}
       WHERE "tags" @> ARRAY[candidate.tag]::text[] ${entityFilter}`,
  ).join(' UNION ALL ');
  const rows = await client.manyOrNone<{ value: string }>(
    `SELECT candidate.tag AS value
     FROM UNNEST($1::text[]) AS candidate(tag)
     WHERE EXISTS (${references})
     ORDER BY candidate.tag`,
    params,
  );
  return new Set(rows.map(row => row.value));
}

/**
 * Remove tags made obsolete by trace deletion without discarding incremental
 * cursors. Candidate lookups use the existing GIN tag indexes, so deletion
 * cost scales with tags on the deleted spans instead of retained history.
 */
export async function reconcileTagDiscoveryCacheAfterTraceDelete(
  client: TxClient,
  schema: string,
  deletedRows: DeletedTraceTagRow[],
): Promise<void> {
  const candidatesByCacheKey = new Map<string, Set<string>>();
  const addCandidates = (cacheKey: string, tags: string[]) => {
    const candidates = candidatesByCacheKey.get(cacheKey) ?? new Set<string>();
    for (const tag of tags) {
      if (tag) candidates.add(tag);
    }
    if (candidates.size > 0) candidatesByCacheKey.set(cacheKey, candidates);
  };

  for (const row of deletedRows) {
    addCandidates('tags', row.tags);
    if (row.entityType) addCandidates(`tags:${row.entityType}`, row.tags);
  }

  const cacheKeys = [...candidatesByCacheKey.keys()].sort();
  if (cacheKeys.length === 0) return;

  // Coordinate with incremental refreshes for every affected cache key. The
  // sorted order also makes concurrent multi-key repairs deadlock-safe.
  for (const cacheKey of cacheKeys) {
    await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [`${schema}:${cacheKey}`]);
  }

  const discoveryTable = qualifiedTable(schema, TABLE_DISCOVERY);
  const cacheRows = await client.manyOrNone<{ cacheKey: string; values: string[] }>(
    `SELECT "cacheKey", "values"
     FROM ${discoveryTable}
     WHERE "cacheKey" = ANY($1::text[])`,
    [cacheKeys],
  );
  const valuesByCacheKey = new Map(cacheRows.map(row => [row.cacheKey, row.values]));

  for (const cacheKey of cacheKeys) {
    const currentValues = valuesByCacheKey.get(cacheKey);
    if (!currentValues) continue;
    const candidateSet = candidatesByCacheKey.get(cacheKey) ?? new Set<string>();
    const candidates = [...candidateSet].sort();
    const entityType = cacheKey === 'tags' ? undefined : (cacheKey.slice('tags:'.length) as EntityType);
    const surviving = await readSurvivingTags(client, schema, candidates, entityType);
    const nextValues = currentValues.filter(value => !candidateSet.has(value) || surviving.has(value));
    if (nextValues.length === currentValues.length) continue;

    // Keep refreshedAt and all cursor rows unchanged. The repair only removes
    // values proven absent; subsequent refreshes continue from their cursors.
    await client.query(`UPDATE ${discoveryTable} SET "values" = $2::jsonb WHERE "cacheKey" = $1`, [
      cacheKey,
      JSON.stringify(nextValues),
    ]);
  }
}

/** Remove tag values and cursor state after signal rows are deleted. */
export async function invalidateTagDiscoveryCache(client: DbClient, schema: string): Promise<void> {
  await client.none(
    `DELETE FROM ${qualifiedTable(schema, TABLE_DISCOVERY)}
     WHERE "cacheKey" = 'tags' OR "cacheKey" LIKE 'tags:%'`,
  );
}

// ---------------------------------------------------------------------------
// Per-discovery refresh queries
// ---------------------------------------------------------------------------

async function distinctAcrossTables(
  client: DbClient,
  schema: string,
  column: string,
  tables: readonly string[],
  filterSql: string = '',
  filterParams: unknown[] = [],
): Promise<string[]> {
  // Defense-in-depth: every current caller passes a hardcoded column name,
  // but validating the identifier here makes the helper injection-safe by
  // construction in case a future caller takes it from user input.
  const safeColumn = parseSqlIdentifier(column, 'column name');
  // Each subquery references the same $N placeholders; pg parameters are
  // positional, so we pass `filterParams` exactly once.
  const unions = tables
    .map(
      t =>
        `SELECT DISTINCT "${safeColumn}" AS v FROM ${qualifiedTable(schema, t)} WHERE "${safeColumn}" IS NOT NULL AND "${safeColumn}" <> '' ${filterSql}`,
    )
    .join(' UNION ');
  const rows = await client.manyOrNone<{ v: string }>(`SELECT v FROM (${unions}) sub ORDER BY v`, filterParams);
  return rows.map(r => r.v);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getEntityTypes(
  client: DbClient,
  schema: string,
  _args: GetEntityTypesArgs,
  config: DiscoveryConfig,
): Promise<GetEntityTypesResponse> {
  const ttl = config.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  const values = await readWithRefresh(
    client,
    schema,
    'entity_types',
    () => distinctAcrossTables(client, schema, 'entityType', ENTITY_DISCOVERY_TABLES),
    ttl,
    config.logger,
  );
  return { entityTypes: values as EntityType[] };
}

export async function getEntityNames(
  client: DbClient,
  schema: string,
  args: GetEntityNamesArgs,
  config: DiscoveryConfig,
): Promise<GetEntityNamesResponse> {
  const ttl = config.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  const cacheKey = args.entityType ? `entity_names:${args.entityType}` : 'entity_names';
  const filterSql = args.entityType ? `AND "entityType" = $1` : '';
  const filterParams = args.entityType ? [args.entityType] : [];
  const values = await readWithRefresh(
    client,
    schema,
    cacheKey,
    () => distinctAcrossTables(client, schema, 'entityName', ENTITY_DISCOVERY_TABLES, filterSql, filterParams),
    ttl,
    config.logger,
  );
  return { names: values };
}

export async function getServiceNames(
  client: DbClient,
  schema: string,
  _args: GetServiceNamesArgs,
  config: DiscoveryConfig,
): Promise<GetServiceNamesResponse> {
  const ttl = config.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  const values = await readWithRefresh(
    client,
    schema,
    'service_names',
    () => distinctAcrossTables(client, schema, 'serviceName', SIGNAL_TABLES_WITH_CONTEXT),
    ttl,
    config.logger,
  );
  return { serviceNames: values };
}

export async function getEnvironments(
  client: DbClient,
  schema: string,
  _args: GetEnvironmentsArgs,
  config: DiscoveryConfig,
): Promise<GetEnvironmentsResponse> {
  const ttl = config.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  const values = await readWithRefresh(
    client,
    schema,
    'environments',
    () => distinctAcrossTables(client, schema, 'environment', SIGNAL_TABLES_WITH_CONTEXT),
    ttl,
    config.logger,
  );
  return { environments: values };
}

export async function getTags(
  client: DbClient,
  schema: string,
  args: GetTagsArgs,
  config: DiscoveryConfig,
): Promise<GetTagsResponse> {
  const ttl = config.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  const cacheKey = args.entityType ? `tags:${args.entityType}` : 'tags';
  const refreshAndStore = () => refreshTagsIncrementally(client, schema, cacheKey, args, ttl);
  const values = await readWithRefresh(client, schema, cacheKey, refreshAndStore, ttl, config.logger, {
    refreshStoresValues: true,
  });
  return { tags: values };
}

export async function getMetricNames(
  client: DbClient,
  schema: string,
  args: GetMetricNamesArgs,
  config: DiscoveryConfig,
): Promise<GetMetricNamesResponse> {
  const ttl = config.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  const values = await readWithRefresh(
    client,
    schema,
    'metric_names',
    async () => {
      const rows = await client.manyOrNone<{ v: string }>(
        `SELECT DISTINCT "name" AS v FROM ${qualifiedTable(schema, TABLE_METRIC_EVENTS)}
         WHERE "name" IS NOT NULL AND "name" <> '' ORDER BY "name"`,
      );
      return rows.map(r => r.v);
    },
    ttl,
    config.logger,
  );
  let filtered = values;
  if (args.prefix) filtered = filtered.filter(v => v.startsWith(args.prefix!));
  if (args.limit) filtered = filtered.slice(0, args.limit);
  return { names: filtered };
}

export async function getMetricLabelKeys(
  client: DbClient,
  schema: string,
  args: GetMetricLabelKeysArgs,
  config: DiscoveryConfig,
): Promise<GetMetricLabelKeysResponse> {
  const ttl = config.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  const cacheKey = `metric_label_keys:${args.metricName}`;
  const values = await readWithRefresh(
    client,
    schema,
    cacheKey,
    async () => {
      const rows = await client.manyOrNone<{ v: string }>(
        `SELECT DISTINCT k AS v
         FROM ${qualifiedTable(schema, TABLE_METRIC_EVENTS)}, jsonb_object_keys("labels") k
         WHERE "name" = $1 ORDER BY k`,
        [args.metricName],
      );
      return rows.map(r => r.v);
    },
    ttl,
    config.logger,
  );
  return { keys: values };
}

export async function getMetricLabelValues(
  client: DbClient,
  schema: string,
  args: GetMetricLabelValuesArgs,
  config: DiscoveryConfig,
): Promise<GetMetricLabelValuesResponse> {
  const ttl = config.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  const cacheKey = `metric_label_values:${args.metricName}:${args.labelKey}`;
  const values = await readWithRefresh(
    client,
    schema,
    cacheKey,
    async () => {
      const rows = await client.manyOrNone<{ v: string }>(
        `SELECT DISTINCT "labels" ->> $2 AS v
         FROM ${qualifiedTable(schema, TABLE_METRIC_EVENTS)}
         WHERE "name" = $1 AND "labels" ? $2
         ORDER BY v`,
        [args.metricName, args.labelKey],
      );
      return rows.map(r => r.v).filter(v => v != null && v !== '');
    },
    ttl,
    config.logger,
  );
  let filtered = values;
  if (args.prefix) filtered = filtered.filter(v => v.startsWith(args.prefix!));
  if (args.limit) filtered = filtered.slice(0, args.limit);
  return { values: filtered };
}

/**
 * Force-refresh the six unscoped discovery cache keys: `entity_types`,
 * `entity_names`, `service_names`, `environments`, `tags`, and
 * `metric_names`. Scoped keys (`entity_names:<entityType>`,
 * `tags:<entityType>`, `metric_label_keys:<metric>`,
 * `metric_label_values:<metric>:<key>`) are not touched here — they refresh
 * lazily on read against their own keys.
 *
 * Intended for the future `mastra observability discovery refresh` CLI
 * command.
 */
export async function refreshAllDiscoveryCaches(
  client: DbClient,
  schema: string,
  config: DiscoveryConfig,
): Promise<void> {
  await Promise.all([
    getEntityTypes(client, schema, {}, { ...config, ttlSeconds: 0 }),
    getEntityNames(client, schema, {}, { ...config, ttlSeconds: 0 }),
    getServiceNames(client, schema, {}, { ...config, ttlSeconds: 0 }),
    getEnvironments(client, schema, {}, { ...config, ttlSeconds: 0 }),
    getTags(client, schema, {}, { ...config, ttlSeconds: 0 }),
    getMetricNames(client, schema, {}, { ...config, ttlSeconds: 0 }),
  ]);
}
