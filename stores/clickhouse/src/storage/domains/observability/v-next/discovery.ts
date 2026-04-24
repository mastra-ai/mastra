/**
 * General discovery methods for ClickHouse v-next observability.
 *
 * Reads from discovery_values and discovery_pairs helper tables,
 * which are populated by refreshable materialized views.
 *
 * Per design: discovery methods return empty results until the
 * helper tables have been initialized and refreshed successfully.
 * They do NOT fall back to base-table scans.
 */

import type { ClickHouseClient } from '@clickhouse/client';
import { EntityType } from '@mastra/core/storage';
import type {
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

import { TABLE_DISCOVERY_VALUES, TABLE_DISCOVERY_PAIRS } from './ddl';
import { CH_SETTINGS } from './helpers';

async function queryJson<T>(
  client: ClickHouseClient,
  query: string,
  params: Record<string, unknown> = {},
): Promise<T[]> {
  return (await (
    await client.query({
      query,
      query_params: params,
      format: 'JSONEachRow',
      clickhouse_settings: CH_SETTINGS,
    })
  ).json()) as T[];
}

// -- Entity discovery ---------------------------------------------------------

export async function getEntityTypes(
  client: ClickHouseClient,
  _args: GetEntityTypesArgs,
): Promise<GetEntityTypesResponse> {
  const rows = await queryJson<{ value: string }>(
    client,
    `SELECT value FROM ${TABLE_DISCOVERY_VALUES} WHERE kind = 'entityType' ORDER BY value`,
  );

  const validTypes = new Set(Object.values(EntityType));
  const entityTypes: EntityType[] = [];
  for (const row of rows) {
    if (validTypes.has(row.value as EntityType)) {
      entityTypes.push(row.value as EntityType);
    }
  }
  return { entityTypes };
}

export async function getEntityNames(
  client: ClickHouseClient,
  args: GetEntityNamesArgs,
): Promise<GetEntityNamesResponse> {
  const conditions = [`kind = 'entityTypeName'`];
  const params: Record<string, unknown> = {};

  if (args.entityType) {
    conditions.push('key1 = {entityType:String}');
    params.entityType = args.entityType;
  }

  const rows = await queryJson<{ value: string }>(
    client,
    `SELECT value FROM ${TABLE_DISCOVERY_PAIRS} WHERE ${conditions.join(' AND ')} ORDER BY value`,
    params,
  );
  return { names: rows.map(r => r.value) };
}

// -- Service & environment discovery ------------------------------------------

export async function getServiceNames(
  client: ClickHouseClient,
  _args: GetServiceNamesArgs,
): Promise<GetServiceNamesResponse> {
  const rows = await queryJson<{ value: string }>(
    client,
    `SELECT value FROM ${TABLE_DISCOVERY_VALUES} WHERE kind = 'serviceName' ORDER BY value`,
  );
  return { serviceNames: rows.map(r => r.value) };
}

export async function getEnvironments(
  client: ClickHouseClient,
  _args: GetEnvironmentsArgs,
): Promise<GetEnvironmentsResponse> {
  const rows = await queryJson<{ value: string }>(
    client,
    `SELECT value FROM ${TABLE_DISCOVERY_VALUES} WHERE kind = 'environment' ORDER BY value`,
  );
  return { environments: rows.map(r => r.value) };
}

// -- Tag discovery ------------------------------------------------------------

export async function getTags(client: ClickHouseClient, args: GetTagsArgs): Promise<GetTagsResponse> {
  const conditions = [`kind = 'tag'`];
  const params: Record<string, unknown> = {};

  if (args.entityType) {
    conditions.push('key1 = {entityType:String}');
    params.entityType = args.entityType;
  }

  const rows = await queryJson<{ value: string }>(
    client,
    `SELECT value FROM ${TABLE_DISCOVERY_VALUES} WHERE ${conditions.join(' AND ')} ORDER BY value`,
    params,
  );
  return { tags: rows.map(r => r.value) };
}
