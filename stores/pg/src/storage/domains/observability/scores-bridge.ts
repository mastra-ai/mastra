import { randomUUID } from 'node:crypto';

import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { createStorageErrorId, EntityType, listScoresArgsSchema, TABLE_SCORERS } from '@mastra/core/storage';
import type {
  BatchCreateScoresArgs,
  CreateScoreArgs,
  ListScoresArgs,
  ListScoresResponse,
  ScoreRecord,
} from '@mastra/core/storage';

import { getSchemaName, getTableName } from '../../db';
import type { PgDB } from '../../db';

const STORE_NAME = 'PG';
// Legacy timestamps contain UTC wall time. Interpret them explicitly so reads
// and filtering agree even when the server or node process uses another zone.
const SCORE_TIMESTAMP = `COALESCE(s."createdAtZ", s."createdAt" AT TIME ZONE 'UTC', s."updatedAt" AT TIME ZONE 'UTC', s."updatedAtZ")`;

type ScoreRow = Record<string, unknown>;
type ParsedScoreFilters = ReturnType<typeof listScoresArgsSchema.parse>['filters'];

const ENTITY_TYPE_ALIASES: Record<string, EntityType> = {
  AGENT: EntityType.AGENT,
  WORKFLOW: EntityType.WORKFLOW_RUN,
  TRAJECTORY: EntityType.TRAJECTORY,
  STEP: EntityType.WORKFLOW_STEP,
  TOOL: EntityType.TOOL,
  agent: EntityType.AGENT,
  agent_run: EntityType.AGENT,
  scorer: EntityType.SCORER,
  scorer_run: EntityType.SCORER,
  scorer_step: EntityType.SCORER,
  rag_ingestion: EntityType.RAG_INGESTION,
  trajectory: EntityType.TRAJECTORY,
  input_processor: EntityType.INPUT_PROCESSOR,
  input_step_processor: EntityType.INPUT_STEP_PROCESSOR,
  output_processor: EntityType.OUTPUT_PROCESSOR,
  output_step_processor: EntityType.OUTPUT_STEP_PROCESSOR,
  tool_result_processor: EntityType.TOOL_RESULT_PROCESSOR,
  processor_run: EntityType.OUTPUT_PROCESSOR,
  tool: EntityType.TOOL,
  tool_call: EntityType.TOOL,
  client_tool_call: EntityType.TOOL,
  mcp_tool_call: EntityType.TOOL,
  provider_tool_call: EntityType.TOOL,
  workflow_run: EntityType.WORKFLOW_RUN,
  workflow_step: EntityType.WORKFLOW_STEP,
  memory: EntityType.MEMORY,
  memory_operation: EntityType.MEMORY,
};

const METADATA_TEXT_FILTER_FIELDS = [
  'entityVersionId',
  'parentEntityName',
  'parentEntityVersionId',
  'rootEntityName',
  'rootEntityVersionId',
  'userId',
  'sessionId',
  'requestId',
  'environment',
  'serviceName',
  'executionSource',
  'experimentId',
] as const;

export async function listScores(db: PgDB, schema: string, args: ListScoresArgs): Promise<ListScoresResponse> {
  const { mode, filters, pagination, orderBy } = listScoresArgsSchema.parse(args);
  if (mode === 'delta') {
    throw new MastraError({
      id: createStorageErrorId(STORE_NAME, 'LIST_SCORES', 'DELTA_NOT_SUPPORTED'),
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.USER,
      text: 'PostgreSQL observability scores backed by the legacy scorer table do not support delta polling',
    });
  }

  const conditions: string[] = [];
  const params: unknown[] = [];

  try {
    addScoreFilters(conditions, params, filters);
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const from = scoreFrom(schema);
    const countRow = await db.readClient.oneOrNone<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM ${from} ${whereClause}`,
      params,
    );
    const total = Number(countRow?.count ?? 0);
    const { page, perPage } = pagination;
    const offset = page * perPage;

    if (total === 0) {
      return { scores: [], pagination: { total, page, perPage, hasMore: false } };
    }

    const orderColumn = orderBy.field === 'score' ? 's."score"' : SCORE_TIMESTAMP;
    const orderDirection = orderBy.direction === 'ASC' ? 'ASC' : 'DESC';
    const limitParam = addParam(params, perPage);
    const offsetParam = addParam(params, offset);
    const rows = await db.readClient.manyOrNone<ScoreRow>(
      `SELECT s.*, ${SCORE_TIMESTAMP} AS "bridgeTimestamp" FROM ${from} ${whereClause}
       ORDER BY ${orderColumn} ${orderDirection}, s."id" ${orderDirection}
       LIMIT ${limitParam} OFFSET ${offsetParam}`,
      params,
    );

    return {
      scores: rows.map(transformScoreRow),
      pagination: {
        total,
        page,
        perPage,
        hasMore: offset + perPage < total,
      },
    };
  } catch (error) {
    if (error instanceof MastraError) throw error;
    throw storageError('LIST_SCORES', { page: pagination.page, perPage: pagination.perPage }, error);
  }
}

export async function createScore(db: PgDB, schema: string, args: CreateScoreArgs): Promise<void> {
  await batchCreateScores(db, schema, { scores: [args.score] });
}

export async function batchCreateScores(db: PgDB, _schema: string, args: BatchCreateScoresArgs): Promise<void> {
  if (args.scores.length === 0) return;

  try {
    await db.batchInsert({
      tableName: TABLE_SCORERS,
      records: args.scores.map(scoreRecordToTableRecord),
    });
  } catch (error) {
    throw storageError('BATCH_CREATE_SCORES', { count: args.scores.length }, error);
  }
}

export async function getScoreById(db: PgDB, schema: string, scoreId: string): Promise<ScoreRecord | null> {
  try {
    const row = await db.readClient.oneOrNone<ScoreRow>(
      `SELECT s.*, ${SCORE_TIMESTAMP} AS "bridgeTimestamp" FROM ${scoreTable(schema)} s WHERE s."id" = $1`,
      [scoreId],
    );
    return row ? transformScoreRow(row) : null;
  } catch (error) {
    throw storageError('GET_SCORE_BY_ID', { scoreId }, error);
  }
}

function scoreTable(schema: string): string {
  return getTableName({ indexName: TABLE_SCORERS, schemaName: getSchemaName(schema) });
}

function scoreFrom(schema: string): string {
  // ScoresPG has written both JSONB objects and serialized JSON strings inside
  // JSONB. Normalize both representations before applying JSON-backed filters.
  // Invalid serialized JSON must surface as a storage error, not a missing match.
  const columns = ['metadata', 'requestContext', 'entity', 'scorer'].map(
    column => `CASE WHEN jsonb_typeof(s."${column}") = 'string'
      THEN (s."${column}" #>> '{}')::jsonb ELSE s."${column}" END AS "${column}"`,
  );
  return `${scoreTable(schema)} s CROSS JOIN LATERAL (SELECT ${columns.join(', ')}) j`;
}

function transformScoreRow(row: ScoreRow): ScoreRecord {
  const metadata = parseObjectValue(row.metadata);
  const scorer = parseObjectValue(row.scorer);
  const entity = parseObjectValue(row.entity);
  const requestContext = parseObjectValue(row.requestContext);
  const source = optionalString(row.source);
  const timestampValue = row.bridgeTimestamp ?? row.createdAtZ ?? row.createdAt ?? row.updatedAt ?? row.updatedAtZ;

  return {
    scoreId: optionalString(row.id),
    timestamp: toDate(timestampValue, 'score timestamp'),
    traceId: firstString(row.traceId, metadata?.traceId, requestContext?.traceId),
    spanId: firstString(row.spanId, metadata?.spanId, requestContext?.spanId),
    scorerId: firstString(row.scorerId, scorer?.id, scorer?.scorerId) ?? 'unknown-scorer',
    scorerName: firstString(scorer?.name, scorer?.scorerName),
    scorerVersion: firstString(scorer?.version, scorer?.scorerVersion),
    scoreSource: source,
    source,
    score: toNumber(row.score, 'score'),
    reason: optionalString(row.reason),
    entityType: optionalEntityType(
      firstString(row.entityType, entity?.type, metadata?.entityType, requestContext?.entityType),
    ),
    entityId: firstString(row.entityId, entity?.id, metadata?.entityId, requestContext?.entityId),
    entityName: firstString(row.entityName, entity?.name, metadata?.entityName, requestContext?.entityName),
    parentEntityType: optionalEntityType(firstString(metadata?.parentEntityType, requestContext?.parentEntityType)),
    parentEntityId: firstString(metadata?.parentEntityId, requestContext?.parentEntityId),
    parentEntityName: firstString(metadata?.parentEntityName, requestContext?.parentEntityName),
    rootEntityType: optionalEntityType(firstString(metadata?.rootEntityType, requestContext?.rootEntityType)),
    rootEntityId: firstString(metadata?.rootEntityId, requestContext?.rootEntityId),
    rootEntityName: firstString(metadata?.rootEntityName, requestContext?.rootEntityName),
    userId: firstString(metadata?.userId, requestContext?.userId),
    organizationId: firstString(row.organizationId, metadata?.organizationId, requestContext?.organizationId),
    resourceId: firstString(row.resourceId, metadata?.resourceId, requestContext?.resourceId),
    runId: firstString(row.runId, metadata?.runId, requestContext?.runId),
    sessionId: firstString(metadata?.sessionId, requestContext?.sessionId),
    threadId: firstString(row.threadId, metadata?.threadId, requestContext?.threadId),
    requestId: firstString(metadata?.requestId, requestContext?.requestId),
    environment: firstString(metadata?.environment, requestContext?.environment),
    serviceName: firstString(metadata?.serviceName, requestContext?.serviceName),
    scope: firstObject(metadata?.scope, requestContext?.scope),
    entityVersionId: firstString(metadata?.entityVersionId, requestContext?.entityVersionId),
    parentEntityVersionId: firstString(metadata?.parentEntityVersionId, requestContext?.parentEntityVersionId),
    rootEntityVersionId: firstString(metadata?.rootEntityVersionId, requestContext?.rootEntityVersionId),
    experimentId: firstString(metadata?.experimentId, requestContext?.experimentId),
    executionSource: firstString(metadata?.executionSource, requestContext?.executionSource),
    tags: firstStringArray(metadata?.tags, requestContext?.tags),
    scoreTraceId: firstString(metadata?.scoreTraceId, requestContext?.scoreTraceId),
    metadata,
  };
}

function scoreRecordToTableRecord(score: ScoreRecord): Record<string, unknown> {
  const id = score.scoreId ?? randomUUID();
  const timestamp = toDate(score.timestamp, 'score timestamp');
  const source = score.scoreSource ?? score.source ?? 'observability';
  // A nullish top-level context value is absent, so preserve metadata-only values.
  const contextualMetadata = Object.fromEntries(
    Object.entries({
      entityName: score.entityName,
      entityVersionId: score.entityVersionId,
      parentEntityType: score.parentEntityType,
      parentEntityId: score.parentEntityId,
      parentEntityName: score.parentEntityName,
      parentEntityVersionId: score.parentEntityVersionId,
      rootEntityType: score.rootEntityType,
      rootEntityId: score.rootEntityId,
      rootEntityName: score.rootEntityName,
      rootEntityVersionId: score.rootEntityVersionId,
      userId: score.userId,
      organizationId: score.organizationId,
      sessionId: score.sessionId,
      requestId: score.requestId,
      environment: score.environment,
      serviceName: score.serviceName,
      executionSource: score.executionSource,
      experimentId: score.experimentId,
      tags: score.tags,
      scoreTraceId: score.scoreTraceId,
      scope: score.scope,
    }).filter(([, value]) => value != null),
  );
  const metadata = { ...(score.metadata ?? {}), ...contextualMetadata };

  return {
    id,
    scorerId: score.scorerId,
    traceId: score.traceId,
    spanId: score.spanId,
    runId: score.runId ?? firstString(metadata.runId) ?? score.traceId ?? id,
    scorer: removeUndefined({
      id: score.scorerId,
      name: score.scorerName,
      version: score.scorerVersion,
    }),
    preprocessStepResult: null,
    extractStepResult: null,
    analyzeStepResult: null,
    score: score.score,
    reason: score.reason,
    metadata: removeUndefined(metadata),
    preprocessPrompt: null,
    extractPrompt: null,
    generateScorePrompt: null,
    generateReasonPrompt: null,
    analyzePrompt: null,
    reasonPrompt: null,
    input: {},
    output: {},
    additionalContext: null,
    requestContext: removeUndefined({
      experimentId: score.experimentId,
      scoreTraceId: score.scoreTraceId,
    }),
    entityType: score.entityType,
    entity: removeUndefined({ id: score.entityId, name: score.entityName }),
    entityId: score.entityId,
    source,
    resourceId: score.resourceId,
    threadId: score.threadId,
    organizationId: score.organizationId,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function addScoreFilters(conditions: string[], params: unknown[], filters: ParsedScoreFilters): void {
  if (!filters) return;

  if (filters.timestamp?.start) {
    const operator = filters.timestamp.startExclusive ? '>' : '>=';
    conditions.push(`${SCORE_TIMESTAMP} ${operator} ${addParam(params, filters.timestamp.start)}`);
  }
  if (filters.timestamp?.end) {
    const operator = filters.timestamp.endExclusive ? '<' : '<=';
    conditions.push(`${SCORE_TIMESTAMP} ${operator} ${addParam(params, filters.timestamp.end)}`);
  }

  for (const field of ['traceId', 'spanId', 'resourceId', 'runId', 'threadId', 'organizationId'] as const) {
    addTextFilter(conditions, params, contextText(field, [`s."${field}"`]), filters[field]);
  }
  for (const field of ['entityType', 'parentEntityType', 'rootEntityType'] as const) {
    const value = filters[field];
    if (value === undefined) continue;
    const sources = field === 'entityType' ? ['s."entityType"', jsonText('entity', 'type')] : [];
    const aliases = Object.entries(ENTITY_TYPE_ALIASES)
      .filter(([, entityType]) => entityType === value)
      .map(([alias]) => alias);
    const binds = aliases.map(alias => addParam(params, alias));
    conditions.push(`${contextText(field, sources)} IN (${binds.join(', ')})`);
  }

  if (filters.scorerId !== undefined) {
    const scorerIds = Array.isArray(filters.scorerId) ? filters.scorerId : [filters.scorerId];
    const expression = firstSqlString(
      's."scorerId"',
      jsonText('scorer', 'id'),
      jsonText('scorer', 'scorerId'),
      "'unknown-scorer'",
    );
    conditions.push(
      scorerIds.length === 0 ? 'FALSE' : `${expression} IN (${scorerIds.map(id => addParam(params, id)).join(', ')})`,
    );
  }

  const scoreSource = filters.scoreSource ?? filters.source;
  addTextFilter(conditions, params, 's."source"', scoreSource);

  addTextFilter(conditions, params, contextText('entityName', [jsonText('entity', 'name')]), filters.entityName);

  for (const fieldName of METADATA_TEXT_FILTER_FIELDS) {
    addTextFilter(conditions, params, contextText(fieldName), filters[fieldName]);
  }

  if (filters.tags?.length) {
    const bind = addParam(params, JSON.stringify(filters.tags));
    conditions.push(`COALESCE(
      CASE WHEN jsonb_typeof(j."metadata"->'tags') = 'array' THEN j."metadata"->'tags' END,
      CASE WHEN jsonb_typeof(j."requestContext"->'tags') = 'array' THEN j."requestContext"->'tags' END,
      '[]'::jsonb) @> ${bind}::jsonb`);
  }

  if (filters.metadata && Object.keys(filters.metadata).length > 0) {
    for (const [key, value] of Object.entries(filters.metadata)) {
      const keyBind = addParam(params, key);
      const valueBind = addParam(params, JSON.stringify(value ?? null));
      conditions.push(`j."metadata"->(${keyBind}::text) = ${valueBind}::jsonb`);
    }
  }
}

function addTextFilter(conditions: string[], params: unknown[], expression: string, value: string | undefined): void {
  if (value === undefined) return;
  conditions.push(`${expression} = ${addParam(params, value)}`);
}

// All expressions and JSON field names below come from fixed internal lists;
// user-supplied values and metadata keys are always bound parameters.
function firstSqlString(...sources: string[]): string {
  return `COALESCE(${sources.map(source => `NULLIF(${source}, '')`).join(', ')})`;
}

function jsonText(column: 'metadata' | 'requestContext' | 'entity' | 'scorer', field: string): string {
  return `CASE WHEN jsonb_typeof(j."${column}"->'${field}') = 'string' THEN j."${column}"->>'${field}' END`;
}

function contextText(field: string, sources: string[] = []): string {
  return firstSqlString(...sources, jsonText('metadata', field), jsonText('requestContext', field));
}

function addParam(params: unknown[], value: unknown): string {
  params.push(value);
  return `$${params.length}`;
}

function parseObjectValue(value: unknown): Record<string, unknown> | undefined {
  const parsed = typeof value === 'string' ? (JSON.parse(value) as unknown) : value;
  if (parsed === null || parsed === undefined || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined;
  return parsed as Record<string, unknown>;
}

function firstObject(...values: unknown[]): Record<string, unknown> | undefined {
  for (const value of values) {
    const parsed = parseObjectValue(value);
    if (parsed !== undefined) return parsed;
  }
  return undefined;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    const parsed = optionalString(value);
    if (parsed !== undefined) return parsed;
  }
  return undefined;
}

function firstStringArray(...values: unknown[]): string[] | undefined {
  for (const value of values) {
    if (Array.isArray(value)) {
      return value.filter((item): item is string => typeof item === 'string');
    }
  }
  return undefined;
}

function removeUndefined(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function optionalEntityType(value: unknown): ScoreRecord['entityType'] {
  const stringValue = optionalString(value);
  return stringValue !== undefined && Object.hasOwn(ENTITY_TYPE_ALIASES, stringValue)
    ? ENTITY_TYPE_ALIASES[stringValue]
    : undefined;
}

function toDate(value: unknown, fieldName: string): Date {
  if (value === null || value === undefined) {
    throw new Error(`Missing ${fieldName}`);
  }
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid ${fieldName}`);
  }
  return date;
}

function toNumber(value: unknown, fieldName: string): number {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) {
    throw new Error(`Invalid ${fieldName}`);
  }
  return numberValue;
}

function storageError(
  operation: string,
  details: Record<string, string | number | boolean | null>,
  cause: unknown,
): MastraError {
  return new MastraError(
    {
      id: createStorageErrorId(STORE_NAME, operation, 'FAILED'),
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.THIRD_PARTY,
      details,
    },
    cause,
  );
}
