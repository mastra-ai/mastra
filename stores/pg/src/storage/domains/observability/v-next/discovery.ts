/**
 * Discovery operations for the v-next Postgres observability domain.
 *
 * Backed by a single cache table (`mastra_observability_discovery`) keyed by a
 * cacheKey string. Reads use stale-while-revalidate semantics:
 *
 *   - if no cache row exists, compute synchronously and serve.
 *   - if cache row exists and is fresher than `discoveryTtlSeconds`, serve as-is.
 *   - if cache row is stale, kick off an async refresh and serve the cached
 *     value. The refresh upserts on a single row keyed by cacheKey, so
 *     concurrent readers race harmlessly with last-write-wins semantics.
 *
 * No in-memory caching: the table-backed cache works across multiple
 * frontends pointing at the same database and survives serverless restarts.
 */

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

import type { DbClient } from '../../../client';
import {
  qualifiedTable,
  TABLE_DISCOVERY,
  TABLE_LOG_EVENTS,
  TABLE_METRIC_EVENTS,
  TABLE_SCORE_EVENTS,
  TABLE_FEEDBACK_EVENTS,
  TABLE_SPAN_EVENTS,
} from './ddl';

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
}

/**
 * In-process dedupe for concurrent background refreshes against the same
 * cache key. Without this, N concurrent stale reads on the same key fire N
 * `refresh()` queries and each writes to the cache table — a classic
 * stampede. The map keys are `"schema:cacheKey"` so multiple schemas using
 * the same key don't share an entry.
 */
const inFlightRefreshes = new Map<string, Promise<void>>();

/**
 * Read the cache row for `cacheKey` and decide whether to refresh.
 * Always returns the values stored in the cache (which may be stale or empty
 * on first call). The refresh runs in the background.
 */
async function readWithRefresh(
  client: DbClient,
  schema: string,
  cacheKey: string,
  refresh: () => Promise<string[]>,
  ttlSeconds: number,
): Promise<string[]> {
  const table = qualifiedTable(schema, TABLE_DISCOVERY);
  // pg returns `timestamptz` as a JS Date — type the field accordingly.
  const row = await client.oneOrNone<{ values: string[]; refreshedAt: Date }>(
    `SELECT "values", "refreshedAt" FROM ${table} WHERE "cacheKey" = $1`,
    [cacheKey],
  );

  const refreshedAtMs = row ? new Date(row.refreshedAt).getTime() : 0;
  const stale = !row || Date.now() - refreshedAtMs > ttlSeconds * 1000;

  if (stale) {
    if (!row) {
      // Nothing cached: compute synchronously so the first caller gets a result.
      const values = await refresh();
      await upsertCache(client, schema, cacheKey, values);
      return values;
    }
    // Cached but stale: kick off a background refresh, but dedupe so
    // concurrent readers don't all hit the database.
    const dedupeKey = `${schema}:${cacheKey}`;
    if (!inFlightRefreshes.has(dedupeKey)) {
      const promise = refresh()
        .then(values => upsertCache(client, schema, cacheKey, values))
        .catch((error: unknown) => {
          // Surface refresh failures — silently swallowing them would mask
          // real DB/connectivity issues behind permanently stale data. Use
          // console.warn since the discovery helpers don't currently take a
          // logger; the next reader will retry.
          console.warn(
            `[observability/v-next] background refresh failed for discovery cache key "${cacheKey}":`,
            error,
          );
        })
        .finally(() => {
          inFlightRefreshes.delete(dedupeKey);
        });
      inFlightRefreshes.set(dedupeKey, promise);
    }
  }

  return row?.values ?? [];
}

async function upsertCache(client: DbClient, schema: string, cacheKey: string, values: string[]): Promise<void> {
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
  // Each subquery references the same $N placeholders; pg parameters are
  // positional, so we pass `filterParams` exactly once.
  const unions = tables
    .map(
      t =>
        `SELECT DISTINCT "${column}" AS v FROM ${qualifiedTable(schema, t)} WHERE "${column}" IS NOT NULL AND "${column}" <> '' ${filterSql}`,
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

  const refresh = async (): Promise<string[]> => {
    const filter = args.entityType ? `AND "entityType" = $1` : '';
    const params = args.entityType ? [args.entityType] : [];
    const unions = ENTITY_DISCOVERY_TABLES.map(
      t =>
        `SELECT DISTINCT UNNEST("tags") AS v FROM ${qualifiedTable(schema, t)} WHERE array_length("tags", 1) > 0 ${filter}`,
    ).join(' UNION ');
    const rows = await client.manyOrNone<{ v: string }>(
      `SELECT v FROM (${unions}) sub WHERE v IS NOT NULL AND v <> '' ORDER BY v`,
      params,
    );
    return rows.map(r => r.v);
  };

  const values = await readWithRefresh(client, schema, cacheKey, refresh, ttl);
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
