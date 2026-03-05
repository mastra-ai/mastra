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
import type { DuckDB } from '../../db/index';

/** Return distinct entity types from span_events. */
export async function getEntityTypes(db: DuckDB, _args: GetEntityTypesArgs): Promise<GetEntityTypesResponse> {
  const rows = await db.query<{ entityType: string }>(
    `SELECT DISTINCT entityType FROM span_events WHERE entityType IS NOT NULL ORDER BY entityType`,
  );
  return { entityTypes: rows.map(r => r.entityType) };
}

/** Return distinct entity names, optionally filtered by entity type. */
export async function getEntityNames(db: DuckDB, args: GetEntityNamesArgs): Promise<GetEntityNamesResponse> {
  const conditions = [`entityName IS NOT NULL`];
  const params: unknown[] = [];

  if (args.entityType) {
    conditions.push(`entityType = ?`);
    params.push(args.entityType);
  }

  const rows = await db.query<{ entityName: string }>(
    `SELECT DISTINCT entityName FROM span_events WHERE ${conditions.join(' AND ')} ORDER BY entityName`,
    params,
  );
  return { names: rows.map(r => r.entityName) };
}

/** Return distinct service names from span_events. */
export async function getServiceNames(db: DuckDB, _args: GetServiceNamesArgs): Promise<GetServiceNamesResponse> {
  const rows = await db.query<{ serviceName: string }>(
    `SELECT DISTINCT serviceName FROM span_events WHERE serviceName IS NOT NULL ORDER BY serviceName`,
  );
  return { serviceNames: rows.map(r => r.serviceName) };
}

/** Return distinct environment values from span_events. */
export async function getEnvironments(db: DuckDB, _args: GetEnvironmentsArgs): Promise<GetEnvironmentsResponse> {
  const rows = await db.query<{ environment: string }>(
    `SELECT DISTINCT environment FROM span_events WHERE environment IS NOT NULL ORDER BY environment`,
  );
  return { environments: rows.map(r => r.environment) };
}

/** Return distinct tags (unnested from JSON arrays), optionally filtered by entity type. */
export async function getTags(db: DuckDB, args: GetTagsArgs): Promise<GetTagsResponse> {
  const conditions = [`tags IS NOT NULL`];
  const params: unknown[] = [];

  if (args.entityType) {
    conditions.push(`entityType = ?`);
    params.push(args.entityType);
  }

  const rows = await db.query<{ tag: string }>(
    `SELECT DISTINCT unnest(CAST(tags AS VARCHAR[])) as tag FROM span_events WHERE ${conditions.join(' AND ')} ORDER BY tag`,
    params,
  );
  return { tags: rows.map(r => r.tag) };
}
