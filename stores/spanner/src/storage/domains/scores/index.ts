import { randomUUID } from 'node:crypto';
import type { Database } from '@google-cloud/spanner';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { ListScoresResponse, SaveScorePayload, ScoreRowData, ScoringSource } from '@mastra/core/evals';
import { saveScorePayloadSchema } from '@mastra/core/evals';
import type { StoragePagination, CreateIndexOptions } from '@mastra/core/storage';
import {
  createStorageErrorId,
  ScoresStorage,
  TABLE_SCORERS,
  TABLE_SCHEMAS,
  calculatePagination,
  normalizePerPage,
  transformScoreRow as coreTransformScoreRow,
} from '@mastra/core/storage';
import { SpannerDB, resolveSpannerConfig } from '../../db';
import type { SpannerDomainConfig } from '../../db';
import { quoteIdent } from '../../db/utils';
import { transformFromSpannerRow } from '../utils';

function transformScoreRow(row: Record<string, any>): ScoreRowData {
  // Pre-process Spanner-specific types (timestamp objects, jsonb strings) before
  // delegating to the shared core transform.
  const normalized = transformFromSpannerRow<Record<string, any>>({ tableName: TABLE_SCORERS, row });
  return coreTransformScoreRow(normalized, { convertTimestamps: true });
}

export class ScoresSpanner extends ScoresStorage {
  private database: Database;
  private db: SpannerDB;
  private readonly skipDefaultIndexes?: boolean;
  private readonly indexes?: CreateIndexOptions[];

  static readonly MANAGED_TABLES = [TABLE_SCORERS] as const;

  constructor(config: SpannerDomainConfig) {
    super();
    const { database, indexes, skipDefaultIndexes, initMode } = resolveSpannerConfig(config);
    this.database = database;
    this.db = new SpannerDB({ database, skipDefaultIndexes, initMode });
    this.skipDefaultIndexes = skipDefaultIndexes;
    this.indexes = indexes?.filter(idx => (ScoresSpanner.MANAGED_TABLES as readonly string[]).includes(idx.table));
  }

  async init(): Promise<void> {
    await this.db.createTable({ tableName: TABLE_SCORERS, schema: TABLE_SCHEMAS[TABLE_SCORERS] });
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    return [
      {
        name: 'mastra_scores_trace_id_span_id_idx',
        table: TABLE_SCORERS,
        columns: ['traceId', 'spanId'],
      },
      {
        name: 'mastra_scores_run_id_idx',
        table: TABLE_SCORERS,
        columns: ['runId'],
      },
      {
        name: 'mastra_scores_entity_idx',
        table: TABLE_SCORERS,
        columns: ['entityId', 'entityType'],
      },
      // listScoresByScorerId orders by createdAt DESC; an index leading with
      // scorerId lets the query seek per-scorer rather than scanning.
      {
        name: 'mastra_scores_scorer_id_created_at_idx',
        table: TABLE_SCORERS,
        columns: ['scorerId', 'createdAt DESC'],
      },
    ];
  }

  async createDefaultIndexes(): Promise<void> {
    if (this.skipDefaultIndexes) return;
    await this.db.createIndexes(this.getDefaultIndexDefinitions());
  }

  async createCustomIndexes(): Promise<void> {
    if (!this.indexes || this.indexes.length === 0) return;
    await this.db.createIndexes(this.indexes);
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.db.clearTable({ tableName: TABLE_SCORERS });
  }

  async getScoreById({ id }: { id: string }): Promise<ScoreRowData | null> {
    try {
      const [rows] = await this.database.run({
        sql: `SELECT * FROM ${quoteIdent(TABLE_SCORERS, 'table name')} WHERE id = @id LIMIT 1`,
        params: { id },
        json: true,
      });
      const row = (rows as Array<Record<string, any>>)[0];
      if (!row) return null;
      return transformScoreRow(row);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'GET_SCORE_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id },
        },
        error,
      );
    }
  }

  async saveScore(score: SaveScorePayload): Promise<{ score: ScoreRowData }> {
    let validatedScore: SaveScorePayload;
    try {
      validatedScore = saveScorePayloadSchema.parse(score);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'SAVE_SCORE', 'VALIDATION_FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: {
            scorer: typeof score.scorer?.id === 'string' ? score.scorer.id : String(score.scorer?.id ?? 'unknown'),
            entityId: score.entityId ?? 'unknown',
            entityType: score.entityType ?? 'unknown',
            traceId: score.traceId ?? '',
            spanId: score.spanId ?? '',
          },
        },
        error,
      );
    }

    try {
      const scoreId = randomUUID();
      const now = new Date();
      const {
        scorer,
        preprocessStepResult,
        analyzeStepResult,
        metadata,
        input,
        output,
        additionalContext,
        requestContext,
        entity,
        ...rest
      } = validatedScore;

      const insertedRecord = {
        id: scoreId,
        ...rest,
        input: input ?? {},
        output: output ?? {},
        preprocessStepResult: preprocessStepResult ?? null,
        analyzeStepResult: analyzeStepResult ?? null,
        metadata: metadata ?? null,
        additionalContext: additionalContext ?? null,
        requestContext: requestContext ?? null,
        entity: entity ?? null,
        scorer: scorer ?? null,
        createdAt: now,
        updatedAt: now,
      };
      await this.db.insert({
        tableName: TABLE_SCORERS,
        record: insertedRecord,
      });

      return { score: insertedRecord as ScoreRowData };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'SAVE_SCORE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  private async listScoresByConditions(
    conditions: string[],
    params: Record<string, any>,
    pagination: StoragePagination,
  ): Promise<ListScoresResponse> {
    const tableName = quoteIdent(TABLE_SCORERS, 'table name');
    const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const [countRows] = await this.database.run({
      sql: `SELECT COUNT(*) AS count FROM ${tableName} ${whereSql}`,
      params,
      json: true,
    });
    const total = Number((countRows as Array<{ count: number | string }>)[0]?.count ?? 0);
    const { page, perPage: perPageInput } = pagination;
    if (total === 0) {
      return { pagination: { total: 0, page, perPage: perPageInput, hasMore: false }, scores: [] };
    }
    const perPage = normalizePerPage(perPageInput, 100);
    const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
    const limitValue = perPageInput === false ? total : perPage;
    const end = perPageInput === false ? total : start + perPage;

    const sql = `SELECT * FROM ${tableName} ${whereSql} ORDER BY ${quoteIdent('createdAt', 'column name')} DESC, id DESC LIMIT @limit OFFSET @offset`;
    const [rows] = await this.database.run({
      sql,
      params: { ...params, limit: limitValue, offset: start },
      json: true,
    });
    return {
      pagination: { total, page, perPage: perPageForResponse, hasMore: end < total },
      scores: (rows as Array<Record<string, any>>).map(r => transformScoreRow(r)),
    };
  }

  async listScoresByScorerId({
    scorerId,
    pagination,
    entityId,
    entityType,
    source,
  }: {
    scorerId: string;
    pagination: StoragePagination;
    entityId?: string;
    entityType?: string;
    source?: ScoringSource;
  }): Promise<ListScoresResponse> {
    try {
      const conditions = [`${quoteIdent('scorerId', 'column name')} = @scorerId`];
      const params: Record<string, any> = { scorerId };
      if (entityId) {
        conditions.push(`${quoteIdent('entityId', 'column name')} = @entityId`);
        params.entityId = entityId;
      }
      if (entityType) {
        conditions.push(`${quoteIdent('entityType', 'column name')} = @entityType`);
        params.entityType = entityType;
      }
      if (source) {
        conditions.push(`${quoteIdent('source', 'column name')} = @source`);
        params.source = source;
      }
      return await this.listScoresByConditions(conditions, params, pagination);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'LIST_SCORES_BY_SCORER_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { scorerId },
        },
        error,
      );
    }
  }

  async listScoresByRunId({
    runId,
    pagination,
  }: {
    runId: string;
    pagination: StoragePagination;
  }): Promise<ListScoresResponse> {
    try {
      return await this.listScoresByConditions(
        [`${quoteIdent('runId', 'column name')} = @runId`],
        { runId },
        pagination,
      );
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'LIST_SCORES_BY_RUN_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { runId },
        },
        error,
      );
    }
  }

  async listScoresByEntityId({
    entityId,
    entityType,
    pagination,
  }: {
    pagination: StoragePagination;
    entityId: string;
    entityType: string;
  }): Promise<ListScoresResponse> {
    try {
      return await this.listScoresByConditions(
        [
          `${quoteIdent('entityId', 'column name')} = @entityId`,
          `${quoteIdent('entityType', 'column name')} = @entityType`,
        ],
        { entityId, entityType },
        pagination,
      );
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'LIST_SCORES_BY_ENTITY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { entityId, entityType },
        },
        error,
      );
    }
  }

  async listScoresBySpan({
    traceId,
    spanId,
    pagination,
  }: {
    traceId: string;
    spanId: string;
    pagination: StoragePagination;
  }): Promise<ListScoresResponse> {
    try {
      return await this.listScoresByConditions(
        [`${quoteIdent('traceId', 'column name')} = @traceId`, `${quoteIdent('spanId', 'column name')} = @spanId`],
        { traceId, spanId },
        pagination,
      );
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'LIST_SCORES_BY_SPAN', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { traceId, spanId },
        },
        error,
      );
    }
  }
}
