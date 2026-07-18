import { randomUUID } from 'node:crypto';

import { ErrorCategory, MastraError } from '@mastra/core/error';
import type { ListScoresResponse, SaveScorePayload, ScoreRowData, ScoringSource } from '@mastra/core/evals';
import { saveScorePayloadSchema } from '@mastra/core/evals';
import {
  calculatePagination,
  normalizePerPage,
  ScoresStorage,
  TABLE_SCHEMAS,
  TABLE_SCORERS,
  transformScoreRow as coreTransformScoreRow,
} from '@mastra/core/storage';
import type { ScoreTenancyFilters, StorageColumn, StoragePagination } from '@mastra/core/storage';

import { indexNameForTable, qualifyName } from '../../../vector/identifiers';
import { OracleDB, createOracleIndex, filterIndexesForTables } from '../../db';
import type { OracleCreateIndexOptions } from '../../db';
import { createOracleStorageError } from '../../domain-utils';
import type { OracleDomainConfig } from '../../types';

// Scores are append-style evaluation outputs, indexed for scorer, trace/span,
// entity, thread/resource, and run-level review queries.
const STORE_NAME = 'ORACLEDB';

const SCORE_CREATED_AT = '"createdAt"';
const SCORE_UPDATED_AT = '"updatedAt"';
const SCORE_SCORER_ID = '"scorerId"';
const SCORE_TRACE_ID = '"traceId"';
const SCORE_SPAN_ID = '"spanId"';
const SCORE_RUN_ID = '"runId"';
const SCORE_PREPROCESS_STEP_RESULT = '"preprocessStepResult"';
const SCORE_EXTRACT_STEP_RESULT = '"extractStepResult"';
const SCORE_ANALYZE_STEP_RESULT = '"analyzeStepResult"';
const SCORE_PREPROCESS_PROMPT = '"preprocessPrompt"';
const SCORE_EXTRACT_PROMPT = '"extractPrompt"';
const SCORE_GENERATE_SCORE_PROMPT = '"generateScorePrompt"';
const SCORE_GENERATE_REASON_PROMPT = '"generateReasonPrompt"';
const SCORE_ANALYZE_PROMPT = '"analyzePrompt"';
const SCORE_REASON_PROMPT = '"reasonPrompt"';
const SCORE_ADDITIONAL_CONTEXT = '"additionalContext"';
const SCORE_REQUEST_CONTEXT = '"requestContext"';
const SCORE_ENTITY_TYPE = '"entityType"';
const SCORE_ENTITY_ID = '"entityId"';
const SCORE_RESOURCE_ID = '"resourceId"';
const SCORE_THREAD_ID = '"threadId"';
const SCORE_ORGANIZATION_ID = '"organizationId"';
const SCORE_PROJECT_ID = '"projectId"';
const SCORE_BATCH_ID = '"batchId"';
const SCORE_DATASET_ID = '"datasetId"';
const SCORE_DATASET_ITEM_ID = '"datasetItemId"';
const SCORE_LONG_TEXT_COLUMNS = [
  'reason',
  'preprocessPrompt',
  'extractPrompt',
  'generateScorePrompt',
  'generateReasonPrompt',
  'analyzePrompt',
  'reasonPrompt',
] as const;
const SCORE_NULLABLE_JSON_COLUMNS = ['input', 'output'] as const;
export const ORACLE_SCORES_SCHEMA: Record<string, StorageColumn> = {
  ...TABLE_SCHEMAS[TABLE_SCORERS],
  // Experiment scorers can run against failed or suspended workflow runs, where
  // output is intentionally absent. PG stores that as a serialized null/empty
  // value; Oracle should accept the same runtime shape instead of rejecting it.
  input: { ...TABLE_SCHEMAS[TABLE_SCORERS].input!, nullable: true },
  output: { ...TABLE_SCHEMAS[TABLE_SCORERS].output!, nullable: true },
};

type ScoreRow = Record<string, unknown>;

function transformScoreRow(row: ScoreRow): ScoreRowData {
  // Reuse Mastra's shared score mapper so Oracle returns the same shape as other storage providers.
  return coreTransformScoreRow(row, { convertTimestamps: true });
}

/**
 * Appends multi-tenant scope conditions to a score query. Mutates `conditions`/`binds`.
 * Mirrors the PG scores domain so organizationId/projectId scoping behaves the same across stores.
 */
function applyTenancyFilters(conditions: string[], binds: Record<string, unknown>, filters?: ScoreTenancyFilters): void {
  if (filters?.organizationId !== undefined) {
    conditions.push(`${SCORE_ORGANIZATION_ID} = :organizationId`);
    binds.organizationId = filters.organizationId;
  }
  if (filters?.projectId !== undefined) {
    conditions.push(`${SCORE_PROJECT_ID} = :projectId`);
    binds.projectId = filters.projectId;
  }
}

export class ScoresOracle extends ScoresStorage {
  // Scores are append-style eval records keyed for scorer, run, entity, trace, and span lookups.
  static readonly MANAGED_TABLES = [TABLE_SCORERS] as const;

  private readonly db: OracleDB;
  private readonly schemaName?: string;
  private readonly skipDefaultIndexes?: boolean;
  private readonly indexes: OracleCreateIndexOptions[];

  constructor(config: OracleDomainConfig) {
    super();
    this.db = new OracleDB(config);
    this.schemaName = config.schemaName;
    this.skipDefaultIndexes = config.skipDefaultIndexes;
    this.indexes = filterIndexesForTables(config.indexes, ScoresOracle.MANAGED_TABLES);
  }

  async init(): Promise<void> {
    await this.db.createTable({ tableName: TABLE_SCORERS, schema: ORACLE_SCORES_SCHEMA });
    await this.db.alterTable({
      tableName: TABLE_SCORERS,
      schema: ORACLE_SCORES_SCHEMA,
      ifNotExists: ['spanId', 'requestContext', 'organizationId', 'projectId', 'batchId', 'datasetId', 'datasetItemId'],
    });
    await this.ensureLongTextColumns();
    await this.ensureNullableJsonColumns();
    await this.createIndexes();
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.db.clearTable(TABLE_SCORERS);
  }

  async getScoreById({ id }: { id: string }): Promise<ScoreRowData | null> {
    try {
      const row = await this.db.oneOrNone<ScoreRow>(`${this.selectScores()} FROM ${this.table()} WHERE id = :id`, { id });
      return row ? transformScoreRow(row) : null;
    } catch (error) {
      throw this.storageError('GET_SCORE_BY_ID', 'FAILED', { id }, error);
    }
  }

  async saveScore(score: SaveScorePayload): Promise<{ score: ScoreRowData }> {
    let validatedScore: SaveScorePayload;
    try {
      validatedScore = saveScorePayloadSchema.parse(score);
    } catch (error) {
      throw this.storageError(
        'SAVE_SCORE',
        'VALIDATION_FAILED',
        {
          scorer: typeof score.scorer?.id === 'string' ? score.scorer.id : String(score.scorer?.id ?? 'unknown'),
          entityId: score.entityId ?? 'unknown',
          entityType: score.entityType ?? 'unknown',
          traceId: score.traceId ?? '',
          spanId: score.spanId ?? '',
        },
        error,
        ErrorCategory.USER,
      );
    }

    try {
      const id = randomUUID();
      const now = new Date();

      // Use the generic OracleDB insert path so JSON-heavy evaluator payloads
      // and long prompt fields follow the shared JSON/CLOB bind handling.
      await this.db.insert({
        tableName: TABLE_SCORERS,
        schema: ORACLE_SCORES_SCHEMA,
        record: {
          id,
          scorerId: validatedScore.scorerId,
          traceId: validatedScore.traceId,
          spanId: validatedScore.spanId,
          runId: validatedScore.runId,
          scorer: validatedScore.scorer,
          preprocessStepResult: validatedScore.preprocessStepResult,
          extractStepResult: validatedScore.extractStepResult,
          analyzeStepResult: validatedScore.analyzeStepResult,
          score: validatedScore.score,
          reason: validatedScore.reason,
          metadata: validatedScore.metadata,
          preprocessPrompt: validatedScore.preprocessPrompt,
          extractPrompt: validatedScore.extractPrompt,
          generateScorePrompt: validatedScore.generateScorePrompt,
          generateReasonPrompt: validatedScore.generateReasonPrompt,
          analyzePrompt: validatedScore.analyzePrompt,
          reasonPrompt: validatedScore.reasonPrompt,
          input: validatedScore.input,
          output: validatedScore.output,
          additionalContext: validatedScore.additionalContext,
          requestContext: validatedScore.requestContext,
          entityType: validatedScore.entityType,
          entity: validatedScore.entity,
          entityId: validatedScore.entityId,
          source: validatedScore.source,
          resourceId: validatedScore.resourceId,
          threadId: validatedScore.threadId,
          organizationId: validatedScore.organizationId,
          projectId: validatedScore.projectId,
          batchId: validatedScore.batchId,
          datasetId: validatedScore.datasetId,
          datasetItemId: validatedScore.datasetItemId,
          createdAt: now,
          updatedAt: now,
        },
      });

      return { score: { ...validatedScore, id, createdAt: now, updatedAt: now } };
    } catch (error) {
      throw this.storageError('SAVE_SCORE', 'FAILED', { scorerId: score.scorerId, runId: score.runId }, error);
    }
  }

  async listScoresByScorerId({
    scorerId,
    pagination,
    entityId,
    entityType,
    source,
    filters,
  }: {
    scorerId: string;
    pagination: StoragePagination;
    entityId?: string;
    entityType?: string;
    source?: ScoringSource;
    filters?: ScoreTenancyFilters;
  }): Promise<ListScoresResponse> {
    const conditions = [`${SCORE_SCORER_ID} = :scorerId`];
    const binds: Record<string, unknown> = { scorerId };

    if (entityId) {
      conditions.push(`${SCORE_ENTITY_ID} = :entityId`);
      binds.entityId = entityId;
    }
    if (entityType) {
      conditions.push(`${SCORE_ENTITY_TYPE} = :entityType`);
      binds.entityType = entityType;
    }
    if (source) {
      conditions.push(`source = :source`);
      binds.source = source;
    }
    applyTenancyFilters(conditions, binds, filters);

    try {
      return await this.listScores({
        whereClause: `WHERE ${conditions.join(' AND ')}`,
        binds,
        pagination,
        operation: 'LIST_SCORES_BY_SCORER_ID',
        details: { scorerId },
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw this.storageError('LIST_SCORES_BY_SCORER_ID', 'FAILED', { scorerId }, error);
    }
  }

  async listScoresByRunId({
    runId,
    pagination,
    filters,
  }: {
    runId: string;
    pagination: StoragePagination;
    filters?: ScoreTenancyFilters;
  }): Promise<ListScoresResponse> {
    try {
      const conditions = [`${SCORE_RUN_ID} = :runId`];
      const binds: Record<string, unknown> = { runId };
      applyTenancyFilters(conditions, binds, filters);

      return await this.listScores({
        whereClause: `WHERE ${conditions.join(' AND ')}`,
        binds,
        pagination,
        operation: 'LIST_SCORES_BY_RUN_ID',
        details: { runId },
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw this.storageError('LIST_SCORES_BY_RUN_ID', 'FAILED', { runId }, error);
    }
  }

  async listScoresByEntityId({
    entityId,
    entityType,
    pagination,
    filters,
  }: {
    pagination: StoragePagination;
    entityId: string;
    entityType: string;
    filters?: ScoreTenancyFilters;
  }): Promise<ListScoresResponse> {
    try {
      const conditions = [`${SCORE_ENTITY_ID} = :entityId`, `${SCORE_ENTITY_TYPE} = :entityType`];
      const binds: Record<string, unknown> = { entityId, entityType };
      applyTenancyFilters(conditions, binds, filters);

      return await this.listScores({
        whereClause: `WHERE ${conditions.join(' AND ')}`,
        binds,
        pagination,
        operation: 'LIST_SCORES_BY_ENTITY_ID',
        details: { entityId, entityType },
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw this.storageError('LIST_SCORES_BY_ENTITY_ID', 'FAILED', { entityId, entityType }, error);
    }
  }

  async listScoresBySpan({
    traceId,
    spanId,
    pagination,
    filters,
  }: {
    traceId: string;
    spanId: string;
    pagination: StoragePagination;
    filters?: ScoreTenancyFilters;
  }): Promise<ListScoresResponse> {
    try {
      const conditions = [`${SCORE_TRACE_ID} = :traceId`, `${SCORE_SPAN_ID} = :spanId`];
      const binds: Record<string, unknown> = { traceId, spanId };
      applyTenancyFilters(conditions, binds, filters);

      return await this.listScores({
        whereClause: `WHERE ${conditions.join(' AND ')}`,
        binds,
        pagination,
        operation: 'LIST_SCORES_BY_SPAN',
        details: { traceId, spanId },
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw this.storageError('LIST_SCORES_BY_SPAN', 'FAILED', { traceId, spanId }, error);
    }
  }

  getDefaultIndexDefinitions(): OracleCreateIndexOptions[] {
    return defaultScoreIndexes(this.indexName.bind(this));
  }

  private async createIndexes(): Promise<void> {
    await this.db.withConnection(async connection => {
      if (!this.skipDefaultIndexes) {
        for (const index of this.getDefaultIndexDefinitions()) {
          try {
            await createOracleIndex(connection, index, this.schemaName);
          } catch (error) {
            this.logger?.warn?.(`Failed to create Oracle default index ${index.name}:`, error);
          }
        }
      }

      for (const index of this.indexes) {
        try {
          await createOracleIndex(connection, index, this.schemaName);
        } catch (error) {
          this.logger?.warn?.(`Failed to create Oracle custom index ${index.name}:`, error);
        }
      }
    });
  }

  private async ensureLongTextColumns(): Promise<void> {
    // LLM scorer prompts can exceed VARCHAR2(4000). Existing Oracle installs
    // may already have the old column shape, so migrate only columns that are
    // still character types and leave CLOB columns untouched.
    for (const columnName of SCORE_LONG_TEXT_COLUMNS) {
      const dataType = await this.scoreColumnDataType(columnName);
      if (dataType === 'CLOB' || dataType === 'NCLOB') continue;

      if (!dataType) {
        // The narrow column can be missing entirely because a previous
        // migration crashed between DROP and RENAME, leaving the CLOB copy
        // parked under its temporary name. Only skip when there is genuinely
        // nothing to repair; otherwise fall through so the migration resumes
        // instead of leaving the table permanently missing the column.
        const tempExists = await this.scoreColumnExists(scoreTempClobColumnName(columnName));
        if (!tempExists) continue;
      }

      await this.migrateScoreTextColumnToClob(columnName);
    }
  }

  private async ensureNullableJsonColumns(): Promise<void> {
    for (const columnName of SCORE_NULLABLE_JSON_COLUMNS) {
      const nullable = await this.scoreColumnNullable(columnName);
      if (nullable === 'N') {
        await this.db.executeDdl(`ALTER TABLE ${this.table()} MODIFY (${scoreColumnSql(columnName)} NULL)`);
      }
    }
  }

  private async scoreColumnDataType(columnName: string): Promise<string | undefined> {
    const binds: Record<string, string> = {
      tableName: TABLE_SCORERS,
      columnName,
    };
    const ownerPredicate = this.schemaName ? 'owner = UPPER(:schemaName)' : `owner = SYS_CONTEXT('USERENV', 'CURRENT_SCHEMA')`;
    if (this.schemaName) binds.schemaName = this.schemaName;

    const row = await this.db.oneOrNone<{ dataType: string }>(
      `SELECT data_type AS "dataType" FROM all_tab_columns WHERE ${ownerPredicate} AND table_name = UPPER(:tableName) AND column_name IN (:columnName, UPPER(:columnName)) FETCH FIRST 1 ROW ONLY`,
      binds,
    );

    return row?.dataType?.toUpperCase();
  }

  private async scoreColumnNullable(columnName: string): Promise<string | undefined> {
    const binds: Record<string, string> = {
      tableName: TABLE_SCORERS,
      columnName,
    };
    const ownerPredicate = this.schemaName ? 'owner = UPPER(:schemaName)' : `owner = SYS_CONTEXT('USERENV', 'CURRENT_SCHEMA')`;
    if (this.schemaName) binds.schemaName = this.schemaName;

    const row = await this.db.oneOrNone<{ nullable: string }>(
      `SELECT nullable AS "nullable" FROM all_tab_columns WHERE ${ownerPredicate} AND table_name = UPPER(:tableName) AND column_name IN (:columnName, UPPER(:columnName)) FETCH FIRST 1 ROW ONLY`,
      binds,
    );

    return row?.nullable;
  }

  private async scoreColumnExists(columnName: string): Promise<boolean> {
    // Variant of scoreColumnDataType that only checks presence, used to detect
    // an orphaned temp CLOB column (or a dropped original column) after a
    // partially-failed migration, without caring about its data type.
    const binds: Record<string, string> = {
      tableName: TABLE_SCORERS,
      columnName,
    };
    const ownerPredicate = this.schemaName ? 'owner = UPPER(:schemaName)' : `owner = SYS_CONTEXT('USERENV', 'CURRENT_SCHEMA')`;
    if (this.schemaName) binds.schemaName = this.schemaName;

    const row = await this.db.oneOrNone<{ exists: number }>(
      `SELECT 1 AS "exists" FROM all_tab_columns WHERE ${ownerPredicate} AND table_name = UPPER(:tableName) AND column_name IN (:columnName, UPPER(:columnName)) FETCH FIRST 1 ROW ONLY`,
      binds,
    );

    return row !== null;
  }

  private async migrateScoreTextColumnToClob(columnName: (typeof SCORE_LONG_TEXT_COLUMNS)[number]): Promise<void> {
    const oldColumn = scoreColumnSql(columnName);
    const tempColumn = scoreTempClobColumnName(columnName);

    // Oracle commits each DDL statement immediately - ADD, DROP, and RENAME
    // are not wrapped in one transaction - so a previous call to this method
    // can crash partway through (e.g. after DROP but before RENAME, which
    // would otherwise leave the table missing the column forever). Resume
    // from the observable column state instead of blindly repeating the full
    // sequence. The temp column existing is NOT proof the copy ran: a crash
    // can land between ADD and UPDATE, so while the original column is still
    // present it stays the source of truth and the copy re-runs.
    const oldExists = await this.scoreColumnExists(columnName);
    const tempExists = await this.scoreColumnExists(tempColumn);

    if (!tempExists) {
      await this.db.executeDdl(`ALTER TABLE ${this.table()} ADD (${tempColumn} CLOB)`, [-1430]);
    }

    if (oldExists) {
      // The UPDATE is idempotent (it rewrites the temp CLOB from the original
      // column), so re-running it on every attempt that still has the
      // original column is safe - and required, or a retry after a failed
      // copy would DROP the only column holding the data and RENAME an
      // empty CLOB into its place.
      await this.db.none(`UPDATE ${this.table()} SET ${tempColumn} = TO_CLOB(${oldColumn}) WHERE ${oldColumn} IS NOT NULL`);
      await this.db.executeDdl(`ALTER TABLE ${this.table()} DROP COLUMN ${oldColumn}`);
    }

    await this.db.executeDdl(`ALTER TABLE ${this.table()} RENAME COLUMN ${tempColumn} TO ${oldColumn}`);
  }

  private async listScores({
    whereClause,
    binds,
    pagination,
    operation,
    details,
  }: {
    whereClause: string;
    binds: Record<string, unknown>;
    pagination: StoragePagination;
    operation: string;
    details: Record<string, string | number | boolean | undefined>;
  }): Promise<ListScoresResponse> {
    try {
      // All score listing variants share the same pagination path so scorer,
      // run, entity, and trace views stay behaviorally identical.
      const countRow = await this.db.oneOrNone<{ count: number | string }>(
        `SELECT COUNT(*) AS "count" FROM ${this.table()} ${whereClause}`,
        binds,
      );
      const total = Number(countRow?.count ?? 0);
      const { page, perPage: perPageInput } = pagination;
      const perPage = normalizePerPage(perPageInput, 100);
      const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

      if (total === 0) {
        return {
          scores: [],
          pagination: {
            total: 0,
            page,
            perPage: perPageForResponse,
            hasMore: false,
          },
        };
      }

      const limit = perPageInput === false ? total : perPage;
      const end = perPageInput === false ? total : offset + perPage;
      const rows = await this.db.execute<ScoreRow>(
        // `id ASC` breaks ties between rows with identical createdAt timestamps so
        // pages stay stable instead of duplicating or dropping rows across pages.
        `${this.selectScores()} FROM ${this.table()} ${whereClause} ORDER BY ${SCORE_CREATED_AT} DESC, id ASC OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
        { ...binds, offset, limit },
      );

      return {
        scores: rows.map(row => transformScoreRow(row)),
        pagination: {
          total,
          page,
          perPage: perPageForResponse,
          hasMore: end < total,
        },
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw this.storageError(operation, 'FAILED', details, error);
    }
  }

  private selectScores(): string {
    return `SELECT ${scoreSelectColumns()}`;
  }

  private table(): string {
    return qualifyName(TABLE_SCORERS, this.schemaName);
  }

  private indexName(indexName: string): string {
    return indexNameForTable(indexName, 'IDX');
  }

  private storageError(
    operation: string,
    reason: string,
    details: Record<string, string | number | boolean | undefined>,
    cause: unknown,
    category: ErrorCategory = ErrorCategory.THIRD_PARTY,
  ): MastraError {
    return createOracleStorageError({ storeName: STORE_NAME, operation, reason, details, cause, category });
  }
}

export function getDefaultScoreIndexDefinitions(schemaIndexName: (name: string) => string): OracleCreateIndexOptions[] {
  return defaultScoreIndexes(schemaIndexName);
}

export function scoreSelectColumns(): string {
  return [
    `id AS "id"`,
    `${SCORE_SCORER_ID} AS "scorerId"`,
    `${SCORE_TRACE_ID} AS "traceId"`,
    `${SCORE_SPAN_ID} AS "spanId"`,
    `${SCORE_RUN_ID} AS "runId"`,
    `scorer AS "scorer"`,
    `${SCORE_PREPROCESS_STEP_RESULT} AS "preprocessStepResult"`,
    `${SCORE_EXTRACT_STEP_RESULT} AS "extractStepResult"`,
    `${SCORE_ANALYZE_STEP_RESULT} AS "analyzeStepResult"`,
    `score AS "score"`,
    `reason AS "reason"`,
    `metadata AS "metadata"`,
    `${SCORE_PREPROCESS_PROMPT} AS "preprocessPrompt"`,
    `${SCORE_EXTRACT_PROMPT} AS "extractPrompt"`,
    `${SCORE_GENERATE_SCORE_PROMPT} AS "generateScorePrompt"`,
    `${SCORE_GENERATE_REASON_PROMPT} AS "generateReasonPrompt"`,
    `${SCORE_ANALYZE_PROMPT} AS "analyzePrompt"`,
    `${SCORE_REASON_PROMPT} AS "reasonPrompt"`,
    `input AS "input"`,
    `output AS "output"`,
    `${SCORE_ADDITIONAL_CONTEXT} AS "additionalContext"`,
    `${SCORE_REQUEST_CONTEXT} AS "requestContext"`,
    `${SCORE_ENTITY_TYPE} AS "entityType"`,
    `entity AS "entity"`,
    `${SCORE_ENTITY_ID} AS "entityId"`,
    `source AS "source"`,
    `${SCORE_RESOURCE_ID} AS "resourceId"`,
    `${SCORE_THREAD_ID} AS "threadId"`,
    `${SCORE_ORGANIZATION_ID} AS "organizationId"`,
    `${SCORE_PROJECT_ID} AS "projectId"`,
    `${SCORE_BATCH_ID} AS "batchId"`,
    `${SCORE_DATASET_ID} AS "datasetId"`,
    `${SCORE_DATASET_ITEM_ID} AS "datasetItemId"`,
    `${SCORE_CREATED_AT} AS "createdAt"`,
    `${SCORE_UPDATED_AT} AS "updatedAt"`,
  ].join(', ');
}

function defaultScoreIndexes(indexName: (name: string) => string): OracleCreateIndexOptions[] {
  return [
    {
      name: indexName('MASTRA_SCORES_SCORER_ID'),
      table: TABLE_SCORERS,
      columns: ['scorerId'],
    },
    {
      name: indexName('MASTRA_SCORES_RUN_ID'),
      table: TABLE_SCORERS,
      columns: ['runId'],
    },
    {
      name: indexName('MASTRA_SCORES_ENTITY_ID_TYPE'),
      table: TABLE_SCORERS,
      columns: ['entityId', 'entityType'],
    },
    {
      name: indexName('MASTRA_SCORES_TRACE_ID_SPAN_ID_CREATED_AT'),
      table: TABLE_SCORERS,
      columns: ['traceId', 'spanId', 'createdAt DESC'],
    },
  ];
}

function scoreColumnSql(columnName: string): string {
  return /^[a-z][a-z0-9_]*$/.test(columnName) ? columnName : `"${columnName}"`;
}

function scoreTempClobColumnName(columnName: string): string {
  return `ORACLE_TMP_${columnName.toUpperCase()}_CLOB`;
}
