import { randomUUID } from 'node:crypto';

import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { createStorageErrorId, listScoresArgsSchema, TABLE_SCORERS } from '@mastra/core/storage';
import type {
  BatchCreateScoresArgs,
  CreateScoreArgs,
  ListScoresArgs,
  ListScoresResponse,
  ScoreRecord,
} from '@mastra/core/storage';

import { safeJsonValue } from '../../../shared/connection';
import { qualifyName } from '../../../vector/identifiers';
import type { OracleDB } from '../../db';
import { parseJsonValue, toDate } from '../../domain-utils';
import type { ScoreRow } from './schema';
import {
  addBind,
  SCORE_METADATA_FILTER_FIELDS,
  SCORE_SCHEMA,
  SCORE_TEXT_FILTER_COLUMNS,
  scoreQcol,
  STORE_NAME,
  storageError,
} from './schema';

export async function listScores(
  db: OracleDB,
  schemaName: string | undefined,
  args: ListScoresArgs,
): Promise<ListScoresResponse> {
  const { mode, filters, pagination, orderBy } = listScoresArgsSchema.parse(args);
  if (mode === 'delta') {
    throw new MastraError({
      id: createStorageErrorId(STORE_NAME, 'LIST_SCORES', 'DELTA_NOT_SUPPORTED'),
      domain: ErrorDomain.STORAGE,
      category: ErrorCategory.USER,
      text: 'Oracle observability scores do not support delta polling yet',
    });
  }

  const page = pagination.page;
  const perPage = pagination.perPage;
  const binds: Record<string, unknown> = {};
  const conditions: string[] = [];

  try {
    addScoreFilters(conditions, binds, filters);

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRow = await db.oneOrNone<{ count: number | string }>(
      `SELECT COUNT(*) AS "count" FROM ${qualifyName(TABLE_SCORERS, schemaName)} s ${whereClause}`,
      binds,
    );
    const total = Number(countRow?.count ?? 0);

    if (total === 0) {
      return { scores: [], pagination: { total: 0, page, perPage, hasMore: false } };
    }

    const offset = page * perPage;
    const scoreOrderColumn = orderBy.field === 'score' ? scoreQcol('s', 'score') : scoreQcol('s', 'createdAt');
    const rows = await db.manyOrNone<ScoreRow>(
      `${scoreSelect('s')} FROM ${qualifyName(TABLE_SCORERS, schemaName)} s ${whereClause} ORDER BY ${scoreOrderColumn} ${
        orderBy.direction
      }, ${scoreQcol('s', 'id')} ${orderBy.direction} OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
      { ...binds, offset, limit: perPage },
    );

    return {
      scores: rows.map(row => transformObservabilityScoreRow(row)),
      pagination: {
        total,
        page,
        perPage,
        hasMore: offset + perPage < total,
      },
    };
  } catch (error) {
    if (error instanceof MastraError) throw error;
    throw storageError('LIST_SCORES', 'FAILED', {}, error, ErrorCategory.USER);
  }
}

export async function createScore(db: OracleDB, schemaName: string | undefined, args: CreateScoreArgs): Promise<void> {
  await batchCreateScores(db, schemaName, { scores: [args.score] });
}

export async function batchCreateScores(
  db: OracleDB,
  _schemaName: string | undefined,
  args: BatchCreateScoresArgs,
): Promise<void> {
  if (args.scores.length === 0) return;

  try {
    // batchInsert wraps every insert in one transaction so a failure partway
    // through the batch leaves zero rows persisted instead of a partial write.
    await db.batchInsert({
      tableName: TABLE_SCORERS,
      schema: SCORE_SCHEMA,
      records: args.scores.map(scoreRecordToTableRecord),
    });
  } catch (error) {
    throw storageError('BATCH_CREATE_SCORES', 'FAILED', { count: args.scores.length }, error, ErrorCategory.USER);
  }
}

export async function getScoreById(
  db: OracleDB,
  schemaName: string | undefined,
  scoreId: string,
): Promise<ScoreRecord | null> {
  try {
    const row = await db.oneOrNone<ScoreRow>(
      `${scoreSelect('s')} FROM ${qualifyName(TABLE_SCORERS, schemaName)} s WHERE ${scoreQcol('s', 'id')} = :scoreId`,
      { scoreId },
    );
    return row ? transformObservabilityScoreRow(row) : null;
  } catch (error) {
    throw storageError('GET_SCORE_BY_ID', 'FAILED', { scoreId }, error, ErrorCategory.USER);
  }
}

function scoreSelect(tableAlias?: string): string {
  return `SELECT ${Object.keys(SCORE_SCHEMA)
    .map(columnName => `${scoreQcol(tableAlias, columnName)} AS "${columnName}"`)
    .join(', ')}`;
}

function transformObservabilityScoreRow(row: ScoreRow): ScoreRecord {
  const metadata = parseObjectValue(row.metadata);
  const scorer = parseObjectValue(row.scorer);
  const entity = parseObjectValue(row.entity);
  const requestContext = parseObjectValue(row.requestContext);
  const source = optionalString(row.source);

  // Legacy evaluator scores and new observability scores share one table in Mastra.
  // This adapter maps the evaluator row shape into the Studio-facing ScoreRecord
  // shape so /observability/scores can browse the same persisted data.
  return {
    scoreId: optionalString(row.id),
    timestamp: toDate(row.createdAt ?? row.updatedAt ?? new Date()),
    traceId: optionalString(row.traceId),
    spanId: optionalString(row.spanId),
    scorerId: optionalString(row.scorerId) ?? optionalString(scorer?.id) ?? 'unknown-scorer',
    scorerName: optionalString(scorer?.name) ?? optionalString(scorer?.scorerName),
    scorerVersion: optionalString(scorer?.version) ?? optionalString(scorer?.scorerVersion),
    scoreSource: source,
    source,
    score: Number(row.score ?? 0),
    reason: optionalString(row.reason),
    entityType: optionalEntityType(row.entityType),
    entityId: optionalString(row.entityId),
    entityName: optionalString(entity?.name) ?? optionalString(metadata?.entityName),
    parentEntityType: optionalEntityType(metadata?.parentEntityType),
    parentEntityId: optionalString(metadata?.parentEntityId),
    parentEntityName: optionalString(metadata?.parentEntityName),
    rootEntityType: optionalEntityType(metadata?.rootEntityType),
    rootEntityId: optionalString(metadata?.rootEntityId),
    rootEntityName: optionalString(metadata?.rootEntityName),
    userId: optionalString(metadata?.userId),
    organizationId: optionalString(metadata?.organizationId),
    resourceId: optionalString(row.resourceId),
    runId: optionalString(row.runId),
    sessionId: optionalString(metadata?.sessionId),
    threadId: optionalString(row.threadId),
    requestId: optionalString(metadata?.requestId),
    environment: optionalString(metadata?.environment),
    serviceName: optionalString(metadata?.serviceName),
    scope: parseObjectValue(metadata?.scope),
    entityVersionId: optionalString(metadata?.entityVersionId),
    parentEntityVersionId: optionalString(metadata?.parentEntityVersionId),
    rootEntityVersionId: optionalString(metadata?.rootEntityVersionId),
    experimentId: optionalString(metadata?.experimentId) ?? optionalString(requestContext?.experimentId),
    executionSource: optionalString(metadata?.executionSource),
    tags: parseStringArray(metadata?.tags),
    scoreTraceId: optionalString(metadata?.scoreTraceId) ?? optionalString(requestContext?.scoreTraceId),
    metadata,
  };
}

function scoreRecordToTableRecord(score: ScoreRecord): Record<string, unknown> {
  const id = score.scoreId ?? randomUUID();
  const timestamp = score.timestamp instanceof Date ? score.timestamp : new Date(score.timestamp ?? Date.now());
  const source = score.scoreSource ?? score.source ?? 'observability';
  // Filter out undefined contextual fields BEFORE merging over score.metadata.
  // Otherwise an undefined top-level field (e.g. score.entityName) would clobber
  // a value already present under the same key in the original metadata.
  const contextualMetadata = removeUndefined({
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
  });
  const metadata = { ...(score.metadata ?? {}), ...contextualMetadata };

  // Observability scores and evaluator scores share Mastra's scorer table.
  // Fields that do not exist as first-class scorer columns are folded into
  // metadata so the Studio score browser can still filter by context.
  return {
    id,
    scorerId: score.scorerId,
    traceId: score.traceId,
    spanId: score.spanId,
    runId: score.runId ?? score.traceId ?? id,
    scorer: safeJsonValue({
      id: score.scorerId,
      name: score.scorerName,
      version: score.scorerVersion,
    }),
    preprocessStepResult: null,
    extractStepResult: null,
    analyzeStepResult: null,
    score: score.score,
    reason: score.reason,
    metadata: safeJsonValue(removeUndefined(metadata)),
    preprocessPrompt: null,
    extractPrompt: null,
    generateScorePrompt: null,
    generateReasonPrompt: null,
    analyzePrompt: null,
    reasonPrompt: null,
    input: safeJsonValue({}),
    output: safeJsonValue({}),
    additionalContext: null,
    requestContext: safeJsonValue(
      removeUndefined({
        experimentId: score.experimentId,
        scoreTraceId: score.scoreTraceId,
      }),
    ),
    entityType: score.entityType,
    entity: safeJsonValue(removeUndefined({ id: score.entityId, name: score.entityName })),
    entityId: score.entityId,
    source,
    resourceId: score.resourceId,
    threadId: score.threadId,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function parseObjectValue(value: unknown): Record<string, unknown> | undefined {
  const parsed = parseJsonValue(value);
  return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : undefined;
}

function parseStringArray(value: unknown): string[] | undefined {
  const parsed = parseJsonValue(value);
  if (!Array.isArray(parsed)) return undefined;
  return parsed.filter((item): item is string => typeof item === 'string');
}

function removeUndefined<T extends Record<string, unknown>>(record: T): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function optionalEntityType(value: unknown): ScoreRecord['entityType'] {
  return optionalString(value) as ScoreRecord['entityType'];
}

function addScoreFilters(
  conditions: string[],
  binds: Record<string, unknown>,
  filters?: ListScoresArgs['filters'],
): void {
  if (!filters) return;

  addScoreDateRangeFilter(conditions, binds, 's', filters.timestamp);

  for (const columnName of SCORE_TEXT_FILTER_COLUMNS) {
    const value = filters[columnName as keyof typeof filters];
    if (value !== undefined) {
      conditions.push(`${scoreQcol('s', columnName)} = ${addBind(binds, value)}`);
    }
  }

  if (filters.scorerId !== undefined) {
    const scorerIds = Array.isArray(filters.scorerId) ? filters.scorerId : [filters.scorerId];
    if (scorerIds.length > 0) {
      conditions.push(`${scoreQcol('s', 'scorerId')} IN (${scorerIds.map(id => addBind(binds, id)).join(', ')})`);
    }
  }

  const scoreSource = filters.scoreSource ?? filters.source;
  if (scoreSource !== undefined) {
    conditions.push(`${scoreQcol('s', 'source')} = ${addBind(binds, scoreSource)}`);
  }

  if (filters.experimentId !== undefined) {
    const experimentIdBind = addBind(binds, filters.experimentId);
    conditions.push(
      `(JSON_VALUE(${scoreQcol(
        's',
        'metadata',
      )}, '$.experimentId' RETURNING VARCHAR2(4000) NULL ON ERROR) = ${experimentIdBind} OR JSON_VALUE(${scoreQcol(
        's',
        'requestContext',
      )}, '$.experimentId' RETURNING VARCHAR2(4000) NULL ON ERROR) = ${experimentIdBind})`,
    );
  }

  for (const fieldName of SCORE_METADATA_FILTER_FIELDS) {
    const value = filters[fieldName as keyof typeof filters];
    if (value !== undefined) {
      conditions.push(
        `JSON_VALUE(${scoreQcol(
          's',
          'metadata',
        )}, '$.${fieldName}' RETURNING VARCHAR2(4000) NULL ON ERROR) = ${addBind(binds, value)}`,
      );
    }
  }

  addScoreMetadataTagsFilter(conditions, binds, 's', filters.tags);
}

function addScoreDateRangeFilter(
  conditions: string[],
  binds: Record<string, unknown>,
  tableAlias: string,
  range?: { start?: unknown; end?: unknown; startExclusive?: boolean; endExclusive?: boolean },
): void {
  if (range?.start) {
    conditions.push(
      `${scoreQcol(tableAlias, 'createdAt')} ${range.startExclusive ? '>' : '>='} ${addBind(
        binds,
        toDate(range.start),
      )}`,
    );
  }
  if (range?.end) {
    conditions.push(
      `${scoreQcol(tableAlias, 'createdAt')} ${range.endExclusive ? '<' : '<='} ${addBind(binds, toDate(range.end))}`,
    );
  }
}

function addScoreMetadataTagsFilter(
  conditions: string[],
  binds: Record<string, unknown>,
  tableAlias: string,
  tags?: string[] | null,
): void {
  if (!tags?.length) return;

  for (const tag of tags) {
    conditions.push(
      `EXISTS (SELECT 1 FROM JSON_TABLE(${scoreQcol(
        tableAlias,
        'metadata',
      )}, '$.tags[*]' COLUMNS (tag VARCHAR2(4000) PATH '$')) tag_filter WHERE tag_filter.tag = ${addBind(
        binds,
        tag,
      )})`,
    );
  }
}
