import { EntityType } from '@mastra/core/observability';
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
import type { DuckDBConnection } from '../../db/index';

function unionDistinctQueries(selects: string[], orderBy: string): string {
  return `${selects.join('\nUNION\n')}\nORDER BY ${orderBy}`;
}

/** Return distinct entity types across observability signals that carry them. */
export async function getEntityTypes(db: DuckDBConnection, _args: GetEntityTypesArgs): Promise<GetEntityTypesResponse> {
  const rows = await db.query<{ entityType: string }>(
    unionDistinctQueries(
      [
        `SELECT entityType FROM span_events WHERE entityType IS NOT NULL`,
        `SELECT entityType FROM metric_events WHERE entityType IS NOT NULL`,
        `SELECT entityType FROM log_events WHERE entityType IS NOT NULL`,
      ],
      'entityType',
    ),
  );

  const validTypes = new Set(Object.values(EntityType));
  const typeSet = new Set<EntityType>();
  for (const row of rows) {
    if (row.entityType && validTypes.has(row.entityType as EntityType)) {
      typeSet.add(row.entityType as EntityType);
    }
  }
  return { entityTypes: Array.from(typeSet).sort() };
}

/** Return distinct entity names across observability signals, optionally filtered by entity type. */
export async function getEntityNames(db: DuckDBConnection, args: GetEntityNamesArgs): Promise<GetEntityNamesResponse> {
  const buildSelect = (table: 'span_events' | 'metric_events' | 'log_events') => {
    const conditions = [`entityName IS NOT NULL`];
    if (args.entityType) {
      conditions.push(`entityType = ?`);
    }
    return `SELECT entityName FROM ${table} WHERE ${conditions.join(' AND ')}`;
  };

  const params = args.entityType ? [args.entityType, args.entityType, args.entityType] : [];
  const rows = await db.query<{ entityName: string }>(
    unionDistinctQueries(
      [buildSelect('span_events'), buildSelect('metric_events'), buildSelect('log_events')],
      'entityName',
    ),
    params,
  );
  return { names: rows.map(r => r.entityName) };
}

/** Return distinct service names across observability signals. */
export async function getServiceNames(
  db: DuckDBConnection,
  _args: GetServiceNamesArgs,
): Promise<GetServiceNamesResponse> {
  const rows = await db.query<{ serviceName: string }>(
    unionDistinctQueries(
      [
        `SELECT serviceName FROM span_events WHERE serviceName IS NOT NULL`,
        `SELECT serviceName FROM metric_events WHERE serviceName IS NOT NULL`,
        `SELECT serviceName FROM log_events WHERE serviceName IS NOT NULL`,
      ],
      'serviceName',
    ),
  );
  return { serviceNames: rows.map(r => r.serviceName) };
}

/** Return distinct environment values across observability signals. */
export async function getEnvironments(
  db: DuckDBConnection,
  _args: GetEnvironmentsArgs,
): Promise<GetEnvironmentsResponse> {
  const rows = await db.query<{ environment: string }>(
    unionDistinctQueries(
      [
        `SELECT environment FROM span_events WHERE environment IS NOT NULL`,
        `SELECT environment FROM metric_events WHERE environment IS NOT NULL`,
        `SELECT environment FROM log_events WHERE environment IS NOT NULL`,
      ],
      'environment',
    ),
  );
  return { environments: rows.map(r => r.environment) };
}

/** Return distinct tags across observability signals, optionally filtered by entity type. */
export async function getTags(db: DuckDBConnection, args: GetTagsArgs): Promise<GetTagsResponse> {
  const buildSelect = (table: 'span_events' | 'metric_events' | 'log_events') => {
    const conditions = [`tags IS NOT NULL`];
    if (args.entityType) {
      conditions.push(`entityType = ?`);
    }
    return `SELECT unnest(CAST(tags AS VARCHAR[])) AS tag FROM ${table} WHERE ${conditions.join(' AND ')}`;
  };

  const params = args.entityType ? [args.entityType, args.entityType, args.entityType] : [];
  const rows = await db.query<{ tag: string }>(
    unionDistinctQueries([buildSelect('span_events'), buildSelect('metric_events'), buildSelect('log_events')], 'tag'),
    params,
  );
  return { tags: rows.map(r => r.tag) };
}
