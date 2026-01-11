import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { ListScoresResponse, SaveScorePayload, ScoreRowData, ScoringSource } from '@mastra/core/evals';
import { saveScorePayloadSchema } from '@mastra/core/evals';
import type { StoragePagination, CreateIndexOptions } from '@mastra/core/storage';
import {
  calculatePagination,
  createStorageErrorId,
  normalizePerPage,
  ScoresStorage,
  TABLE_SCORERS,
  TABLE_SCHEMAS,
  transformScoreRow as coreTransformScoreRow,
} from '@mastra/core/storage';
import { DsqlDB, resolveDsqlConfig } from '../../db';
import type { DsqlDomainConfig } from '../../db';
import { getTableName, getSchemaName } from '../utils';

/**
 * DSQL-specific score row transformation.
 * Uses Z-suffix timestamps (createdAtZ, updatedAtZ) when available.
 */
function transformScoreRow(row: Record<string, any>): ScoreRowData {
  return coreTransformScoreRow(row, {
    preferredTimestampFields: {
      createdAt: 'createdAtZ',
      updatedAt: 'updatedAtZ',
    },
  });
}

export class ScoresDSQL extends ScoresStorage {
  #db: DsqlDB;
  #schema: string;
  #skipDefaultIndexes?: boolean;
  #indexes?: CreateIndexOptions[];

  /** Tables managed by this domain */
  static readonly MANAGED_TABLES = [TABLE_SCORERS] as const;

  constructor(config: DsqlDomainConfig) {
    super();
    const { client, schemaName, skipDefaultIndexes, indexes } = resolveDsqlConfig(config);
    this.#db = new DsqlDB({ client, schemaName, skipDefaultIndexes });
    this.#schema = schemaName || 'public';
    this.#skipDefaultIndexes = skipDefaultIndexes;
    // Filter indexes to only those for tables managed by this domain
    this.#indexes = indexes?.filter(idx => (ScoresDSQL.MANAGED_TABLES as readonly string[]).includes(idx.table));
  }

  async init(): Promise<void> {
    await this.#db.createTable({ tableName: TABLE_SCORERS, schema: TABLE_SCHEMAS[TABLE_SCORERS] });
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  /**
   * Returns default index definitions for the scores domain tables.
   * Note: Aurora DSQL does not support ASC/DESC in index columns.
   */
  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    const schemaPrefix = this.#schema !== 'public' ? `${this.#schema}_` : '';
    return [
      {
        name: `${schemaPrefix}mastra_scores_trace_id_span_id_created_at_idx`,
        table: TABLE_SCORERS,
        columns: ['traceId', 'spanId', 'createdAt'],
      },
    ];
  }

  /**
   * Creates default indexes for optimal query performance.
   */
  async createDefaultIndexes(): Promise<void> {
    if (this.#skipDefaultIndexes) {
      return;
    }

    for (const indexDef of this.getDefaultIndexDefinitions()) {
      try {
        await this.#db.createIndex(indexDef);
      } catch (error) {
        // Log but continue - indexes are performance optimizations
        this.logger?.warn?.(`Failed to create index ${indexDef.name}:`, error);
      }
    }
  }

  /**
   * Creates custom user-defined indexes for this domain's tables.
   */
  async createCustomIndexes(): Promise<void> {
    if (!this.#indexes || this.#indexes.length === 0) {
      return;
    }

    for (const indexDef of this.#indexes) {
      try {
        await this.#db.createIndex(indexDef);
      } catch (error) {
        // Log but continue - indexes are performance optimizations
        this.logger?.warn?.(`Failed to create custom index ${indexDef.name}:`, error);
      }
    }
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.clearTable({ tableName: TABLE_SCORERS });
  }

  async getScoreById({ id }: { id: string }): Promise<ScoreRowData | null> {
    try {
      const result = await this.#db.client.oneOrNone<ScoreRowData>(
        `SELECT * FROM ${getTableName({ indexName: TABLE_SCORERS, schemaName: getSchemaName(this.#schema) })} WHERE id = $1`,
        [id],
      );

      return result ? transformScoreRow(result) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('DSQL', 'GET_SCORE_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
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
      const conditions: string[] = [`"scorerId" = $1`];
      const queryParams: any[] = [scorerId];
      let paramIndex = 2;

      if (entityId) {
        conditions.push(`"entityId" = $${paramIndex++}`);
        queryParams.push(entityId);
      }

      if (entityType) {
        conditions.push(`"entityType" = $${paramIndex++}`);
        queryParams.push(entityType);
      }

      if (source) {
        conditions.push(`"source" = $${paramIndex++}`);
        queryParams.push(source);
      }

      const whereClause = conditions.join(' AND ');

      const total = await this.#db.client.oneOrNone<{ count: string }>(
        `SELECT COUNT(*) FROM ${getTableName({ indexName: TABLE_SCORERS, schemaName: getSchemaName(this.#schema) })} WHERE ${whereClause}`,
        queryParams,
      );
      const { page, perPage: perPageInput } = pagination;
      const perPage = normalizePerPage(perPageInput, 100);
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

      if (total?.count === '0' || !total?.count) {
        return {
          pagination: {
            total: 0,
            page,
            perPage: perPageForResponse,
            hasMore: false,
          },
          scores: [],
        };
      }
      const limitValue = perPageInput === false ? Number(total?.count) : perPage;
      const end = perPageInput === false ? Number(total?.count) : start + perPage;
      const result = await this.#db.client.manyOrNone<ScoreRowData>(
        `SELECT * FROM ${getTableName({ indexName: TABLE_SCORERS, schemaName: getSchemaName(this.#schema) })} WHERE ${whereClause} ORDER BY "createdAt" DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
        [...queryParams, limitValue, start],
      );

      return {
        pagination: {
          total: Number(total?.count) || 0,
          page,
          perPage: perPageForResponse,
          hasMore: end < Number(total?.count),
        },
        scores: result.map(transformScoreRow),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('DSQL', 'LIST_SCORES_BY_SCORER_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async saveScore(score: SaveScorePayload): Promise<{ score: ScoreRowData }> {
    let parsedScore: SaveScorePayload;
    try {
      parsedScore = saveScorePayloadSchema.parse(score);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('DSQL', 'SAVE_SCORE', 'VALIDATION_FAILED'),
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
      const id = crypto.randomUUID();
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
      } = parsedScore;

      await this.#db.insert({
        tableName: TABLE_SCORERS,
        record: {
          id,
          ...rest,
          input: JSON.stringify(input) || '',
          output: JSON.stringify(output) || '',
          scorer: scorer ? JSON.stringify(scorer) : null,
          preprocessStepResult: preprocessStepResult ? JSON.stringify(preprocessStepResult) : null,
          analyzeStepResult: analyzeStepResult ? JSON.stringify(analyzeStepResult) : null,
          metadata: metadata ? JSON.stringify(metadata) : null,
          additionalContext: additionalContext ? JSON.stringify(additionalContext) : null,
          requestContext: requestContext ? JSON.stringify(requestContext) : null,
          entity: entity ? JSON.stringify(entity) : null,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
      });

      return { score: { ...parsedScore, id, createdAt: now, updatedAt: now } as ScoreRowData };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('DSQL', 'SAVE_SCORE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
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
      const total = await this.#db.client.oneOrNone<{ count: string }>(
        `SELECT COUNT(*) FROM ${getTableName({ indexName: TABLE_SCORERS, schemaName: getSchemaName(this.#schema) })} WHERE "runId" = $1`,
        [runId],
      );
      const { page, perPage: perPageInput } = pagination;
      const perPage = normalizePerPage(perPageInput, 100);
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

      if (total?.count === '0' || !total?.count) {
        return {
          pagination: {
            total: 0,
            page,
            perPage: perPageForResponse,
            hasMore: false,
          },
          scores: [],
        };
      }

      const limitValue = perPageInput === false ? Number(total?.count) : perPage;
      const end = perPageInput === false ? Number(total?.count) : start + perPage;

      const result = await this.#db.client.manyOrNone<ScoreRowData>(
        `SELECT * FROM ${getTableName({ indexName: TABLE_SCORERS, schemaName: getSchemaName(this.#schema) })} WHERE "runId" = $1 ORDER BY "createdAt" DESC LIMIT $2 OFFSET $3`,
        [runId, limitValue, start],
      );
      return {
        pagination: {
          total: Number(total?.count) || 0,
          page,
          perPage: perPageForResponse,
          hasMore: end < Number(total?.count),
        },
        scores: result.map(transformScoreRow),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('DSQL', 'LIST_SCORES_BY_RUN_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
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
      const total = await this.#db.client.oneOrNone<{ count: string }>(
        `SELECT COUNT(*) FROM ${getTableName({ indexName: TABLE_SCORERS, schemaName: getSchemaName(this.#schema) })} WHERE "entityId" = $1 AND "entityType" = $2`,
        [entityId, entityType],
      );
      const { page, perPage: perPageInput } = pagination;
      const perPage = normalizePerPage(perPageInput, 100);
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

      if (total?.count === '0' || !total?.count) {
        return {
          pagination: {
            total: 0,
            page,
            perPage: perPageForResponse,
            hasMore: false,
          },
          scores: [],
        };
      }

      const limitValue = perPageInput === false ? Number(total?.count) : perPage;
      const end = perPageInput === false ? Number(total?.count) : start + perPage;

      const result = await this.#db.client.manyOrNone<ScoreRowData>(
        `SELECT * FROM ${getTableName({ indexName: TABLE_SCORERS, schemaName: getSchemaName(this.#schema) })} WHERE "entityId" = $1 AND "entityType" = $2 ORDER BY "createdAt" DESC LIMIT $3 OFFSET $4`,
        [entityId, entityType, limitValue, start],
      );
      return {
        pagination: {
          total: Number(total?.count) || 0,
          page,
          perPage: perPageForResponse,
          hasMore: end < Number(total?.count),
        },
        scores: result.map(transformScoreRow),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('DSQL', 'LIST_SCORES_BY_ENTITY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
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
      const tableName = getTableName({ indexName: TABLE_SCORERS, schemaName: getSchemaName(this.#schema) });
      const countSQLResult = await this.#db.client.oneOrNone<{ count: string }>(
        `SELECT COUNT(*) as count FROM ${tableName} WHERE "traceId" = $1 AND "spanId" = $2`,
        [traceId, spanId],
      );

      const total = Number(countSQLResult?.count ?? 0);
      const { page, perPage: perPageInput } = pagination;
      const perPage = normalizePerPage(perPageInput, 100);
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
      const limitValue = perPageInput === false ? total : perPage;
      const end = perPageInput === false ? total : start + perPage;
      const result = await this.#db.client.manyOrNone<ScoreRowData>(
        `SELECT * FROM ${tableName} WHERE "traceId" = $1 AND "spanId" = $2 ORDER BY "createdAt" DESC LIMIT $3 OFFSET $4`,
        [traceId, spanId, limitValue, start],
      );

      const hasMore = end < total;
      const scores = result.map(row => transformScoreRow(row)) ?? [];

      return {
        scores,
        pagination: {
          total,
          page,
          perPage: perPageForResponse,
          hasMore,
        },
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('DSQL', 'LIST_SCORES_BY_SPAN', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }
}
