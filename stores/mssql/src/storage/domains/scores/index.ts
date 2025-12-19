import { randomUUID } from 'node:crypto';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { SaveScorePayload, ScoreRowData, ScoringSource, ValidatedSaveScorePayload } from '@mastra/core/evals';
import { saveScorePayloadSchema } from '@mastra/core/evals';
import type { PaginationInfo, StoragePagination } from '@mastra/core/storage';
import {
  createStorageErrorId,
  ScoresStorage,
  TABLE_SCORERS,
  TABLE_SCHEMAS,
  calculatePagination,
  normalizePerPage,
  transformScoreRow as coreTransformScoreRow,
} from '@mastra/core/storage';
import type { ConnectionPool } from 'mssql';
import { resolveMssqlConfig } from '../../db';
import type { MssqlDB, MssqlDomainConfig } from '../../db';
import { getSchemaName, getTableName } from '../utils';

/**
 * MSSQL-specific score row transformation.
 * Converts timestamp strings to Date objects.
 */
function transformScoreRow(row: Record<string, any>): ScoreRowData {
  return coreTransformScoreRow(row, {
    convertTimestamps: true,
  });
}

export class ScoresMSSQL extends ScoresStorage {
  public pool: ConnectionPool;
  private db: MssqlDB;
  private schema?: string;
  private needsConnect: boolean;

  constructor(config: MssqlDomainConfig) {
    super();
    const { pool, db, schema, needsConnect } = resolveMssqlConfig(config);
    this.pool = pool;
    this.db = db;
    this.schema = schema;
    this.needsConnect = needsConnect;
  }

  async init(): Promise<void> {
    if (this.needsConnect) {
      await this.pool.connect();
      this.needsConnect = false;
    }
    await this.db.createTable({ tableName: TABLE_SCORERS, schema: TABLE_SCHEMAS[TABLE_SCORERS] });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.db.clearTable({ tableName: TABLE_SCORERS });
  }

  async getScoreById({ id }: { id: string }): Promise<ScoreRowData | null> {
    try {
      const request = this.pool.request();
      request.input('p1', id);
      const result = await request.query(
        `SELECT * FROM ${getTableName({ indexName: TABLE_SCORERS, schemaName: getSchemaName(this.schema) })} WHERE id = @p1`,
      );

      if (result.recordset.length === 0) {
        return null;
      }

      return transformScoreRow(result.recordset[0]);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'GET_SCORE_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id },
        },
        error,
      );
    }
  }

  async saveScore(score: SaveScorePayload): Promise<{ score: ScoreRowData }> {
    let validatedScore: ValidatedSaveScorePayload;
    try {
      validatedScore = saveScorePayloadSchema.parse(score);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'SAVE_SCORE', 'VALIDATION_FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: {
            scorer: score.scorer?.id ?? 'unknown',
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
      // Generate ID like other storage implementations
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

      await this.db.insert({
        tableName: TABLE_SCORERS,
        record: {
          id: scoreId,
          ...rest,
          input: input || '',
          output: output || '',
          preprocessStepResult: preprocessStepResult || null,
          analyzeStepResult: analyzeStepResult || null,
          metadata: metadata || null,
          additionalContext: additionalContext || null,
          requestContext: requestContext || null,
          entity: entity || null,
          scorer: scorer || null,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
      });

      return { score: { ...validatedScore, id: scoreId, createdAt: now, updatedAt: now } as ScoreRowData };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'SAVE_SCORE', 'FAILED'),
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
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
    try {
      // Build dynamic WHERE clause
      const conditions: string[] = ['[scorerId] = @p1'];
      const params: Record<string, any> = { p1: scorerId };
      let paramIndex = 2;

      if (entityId) {
        conditions.push(`[entityId] = @p${paramIndex}`);
        params[`p${paramIndex}`] = entityId;
        paramIndex++;
      }

      if (entityType) {
        conditions.push(`[entityType] = @p${paramIndex}`);
        params[`p${paramIndex}`] = entityType;
        paramIndex++;
      }

      if (source) {
        conditions.push(`[source] = @p${paramIndex}`);
        params[`p${paramIndex}`] = source;
        paramIndex++;
      }

      const whereClause = conditions.join(' AND ');
      const tableName = getTableName({ indexName: TABLE_SCORERS, schemaName: getSchemaName(this.schema) });

      // Count query
      const countRequest = this.pool.request();
      Object.entries(params).forEach(([key, value]) => {
        countRequest.input(key, value);
      });

      const totalResult = await countRequest.query(`SELECT COUNT(*) as count FROM ${tableName} WHERE ${whereClause}`);
      const total = totalResult.recordset[0]?.count || 0;
      const { page, perPage: perPageInput } = pagination;
      if (total === 0) {
        return {
          pagination: {
            total: 0,
            page,
            perPage: perPageInput,
            hasMore: false,
          },
          scores: [],
        };
      }

      const perPage = normalizePerPage(perPageInput, 100); // false → MAX_SAFE_INTEGER
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
      const limitValue = perPageInput === false ? total : perPage;
      const end = perPageInput === false ? total : start + perPage;

      // Data query
      const dataRequest = this.pool.request();
      Object.entries(params).forEach(([key, value]) => {
        dataRequest.input(key, value);
      });
      dataRequest.input('perPage', limitValue);
      dataRequest.input('offset', start);

      const dataQuery = `SELECT * FROM ${tableName} WHERE ${whereClause} ORDER BY [createdAt] DESC OFFSET @offset ROWS FETCH NEXT @perPage ROWS ONLY`;

      const result = await dataRequest.query(dataQuery);

      return {
        pagination: {
          total: Number(total),
          page,
          perPage: perPageForResponse,
          hasMore: end < total,
        },
        scores: result.recordset.map(row => transformScoreRow(row)),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'LIST_SCORES_BY_SCORER_ID', 'FAILED'),
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
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
    try {
      const request = this.pool.request();
      request.input('p1', runId);

      const totalResult = await request.query(
        `SELECT COUNT(*) as count FROM ${getTableName({ indexName: TABLE_SCORERS, schemaName: getSchemaName(this.schema) })} WHERE [runId] = @p1`,
      );

      const total = totalResult.recordset[0]?.count || 0;
      const { page, perPage: perPageInput } = pagination;

      if (total === 0) {
        return {
          pagination: {
            total: 0,
            page,
            perPage: perPageInput,
            hasMore: false,
          },
          scores: [],
        };
      }

      const perPage = normalizePerPage(perPageInput, 100); // false → MAX_SAFE_INTEGER
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
      const limitValue = perPageInput === false ? total : perPage;
      const end = perPageInput === false ? total : start + perPage;

      const dataRequest = this.pool.request();
      dataRequest.input('p1', runId);
      dataRequest.input('p2', limitValue);
      dataRequest.input('p3', start);

      const result = await dataRequest.query(
        `SELECT * FROM ${getTableName({ indexName: TABLE_SCORERS, schemaName: getSchemaName(this.schema) })} WHERE [runId] = @p1 ORDER BY [createdAt] DESC OFFSET @p3 ROWS FETCH NEXT @p2 ROWS ONLY`,
      );

      return {
        pagination: {
          total: Number(total),
          page,
          perPage: perPageForResponse,
          hasMore: end < total,
        },
        scores: result.recordset.map(row => transformScoreRow(row)),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'LIST_SCORES_BY_RUN_ID', 'FAILED'),
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
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
    try {
      const request = this.pool.request();
      request.input('p1', entityId);
      request.input('p2', entityType);

      const totalResult = await request.query(
        `SELECT COUNT(*) as count FROM ${getTableName({ indexName: TABLE_SCORERS, schemaName: getSchemaName(this.schema) })} WHERE [entityId] = @p1 AND [entityType] = @p2`,
      );

      const total = totalResult.recordset[0]?.count || 0;
      const { page, perPage: perPageInput } = pagination;
      const perPage = normalizePerPage(perPageInput, 100); // false → MAX_SAFE_INTEGER
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

      if (total === 0) {
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
      const limitValue = perPageInput === false ? total : perPage;
      const end = perPageInput === false ? total : start + perPage;

      const dataRequest = this.pool.request();
      dataRequest.input('p1', entityId);
      dataRequest.input('p2', entityType);
      dataRequest.input('p3', limitValue);
      dataRequest.input('p4', start);

      const result = await dataRequest.query(
        `SELECT * FROM ${getTableName({ indexName: TABLE_SCORERS, schemaName: getSchemaName(this.schema) })} WHERE [entityId] = @p1 AND [entityType] = @p2 ORDER BY [createdAt] DESC OFFSET @p4 ROWS FETCH NEXT @p3 ROWS ONLY`,
      );

      return {
        pagination: {
          total: Number(total),
          page,
          perPage: perPageForResponse,
          hasMore: end < total,
        },
        scores: result.recordset.map(row => transformScoreRow(row)),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'LIST_SCORES_BY_ENTITY_ID', 'FAILED'),
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
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
    try {
      const request = this.pool.request();
      request.input('p1', traceId);
      request.input('p2', spanId);

      const totalResult = await request.query(
        `SELECT COUNT(*) as count FROM ${getTableName({ indexName: TABLE_SCORERS, schemaName: getSchemaName(this.schema) })} WHERE [traceId] = @p1 AND [spanId] = @p2`,
      );

      const total = totalResult.recordset[0]?.count || 0;
      const { page, perPage: perPageInput } = pagination;

      const perPage = normalizePerPage(perPageInput, 100); // false → MAX_SAFE_INTEGER
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

      if (total === 0) {
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
      const limitValue = perPageInput === false ? total : perPage;
      const end = perPageInput === false ? total : start + perPage;

      const dataRequest = this.pool.request();
      dataRequest.input('p1', traceId);
      dataRequest.input('p2', spanId);
      dataRequest.input('p3', limitValue);
      dataRequest.input('p4', start);

      const result = await dataRequest.query(
        `SELECT * FROM ${getTableName({ indexName: TABLE_SCORERS, schemaName: getSchemaName(this.schema) })} WHERE [traceId] = @p1 AND [spanId] = @p2 ORDER BY [createdAt] DESC OFFSET @p4 ROWS FETCH NEXT @p3 ROWS ONLY`,
      );

      return {
        pagination: {
          total: Number(total),
          page,
          perPage: perPageForResponse,
          hasMore: end < total,
        },
        scores: result.recordset.map(row => transformScoreRow(row)),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MSSQL', 'LIST_SCORES_BY_SPAN', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { traceId, spanId },
        },
        error,
      );
    }
  }
}
