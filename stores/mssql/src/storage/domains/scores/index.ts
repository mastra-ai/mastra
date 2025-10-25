import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { ScoreRowData, ScoringSource, ValidatedSaveScorePayload } from '@mastra/core/scores';
import { saveScorePayloadSchema } from '@mastra/core/scores';
import type { PaginationInfo, StoragePagination } from '@mastra/core/storage';
import { ScoresStorage, TABLE_SCORERS, safelyParseJSON } from '@mastra/core/storage';
import type { ConnectionPool } from 'mssql';
import type { StoreOperationsMSSQL } from '../operations';
import { getSchemaName, getTableName } from '../utils';

function transformScoreRow(row: Record<string, any>): ScoreRowData {
  return {
    ...row,
    input: safelyParseJSON(row.input),
    scorer: safelyParseJSON(row.scorer),
    preprocessStepResult: safelyParseJSON(row.preprocessStepResult),
    analyzeStepResult: safelyParseJSON(row.analyzeStepResult),
    metadata: safelyParseJSON(row.metadata),
    output: safelyParseJSON(row.output),
    additionalContext: safelyParseJSON(row.additionalContext),
    runtimeContext: safelyParseJSON(row.runtimeContext),
    entity: safelyParseJSON(row.entity),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  } as ScoreRowData;
}

export class ScoresMSSQL extends ScoresStorage {
  public pool: ConnectionPool;
  private operations: StoreOperationsMSSQL;
  private schema?: string;

  constructor({
    pool,
    operations,
    schema,
  }: {
    pool: ConnectionPool;
    operations: StoreOperationsMSSQL;
    schema?: string;
  }) {
    super();
    this.pool = pool;
    this.operations = operations;
    this.schema = schema;
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
          id: 'MASTRA_STORAGE_MSSQL_STORE_GET_SCORE_BY_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id },
        },
        error,
      );
    }
  }

  async saveScore(score: Omit<ScoreRowData, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ score: ScoreRowData }> {
    let validatedScore: ValidatedSaveScorePayload;
    try {
      validatedScore = saveScorePayloadSchema.parse(score);
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_MSSQL_STORE_SAVE_SCORE_VALIDATION_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }

    try {
      // Generate ID like other storage implementations
      const scoreId = crypto.randomUUID();

      const {
        scorer,
        preprocessStepResult,
        analyzeStepResult,
        metadata,
        input,
        output,
        additionalContext,
        runtimeContext,
        entity,
        ...rest
      } = validatedScore;

      await this.operations.insert({
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
          runtimeContext: runtimeContext || null,
          entity: entity || null,
          scorer: scorer || null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });

      const scoreFromDb = await this.getScoreById({ id: scoreId });
      return { score: scoreFromDb! };
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_MSSQL_STORE_SAVE_SCORE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getScoresByScorerId({
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

      if (total === 0) {
        return {
          pagination: {
            total: 0,
            page: pagination.page,
            perPage: pagination.perPage,
            hasMore: false,
          },
          scores: [],
        };
      }

      // Data query
      const dataRequest = this.pool.request();
      Object.entries(params).forEach(([key, value]) => {
        dataRequest.input(key, value);
      });
      dataRequest.input('perPage', pagination.perPage);
      dataRequest.input('offset', pagination.page * pagination.perPage);

      const dataQuery = `SELECT * FROM ${tableName} WHERE ${whereClause} ORDER BY [createdAt] DESC OFFSET @offset ROWS FETCH NEXT @perPage ROWS ONLY`;

      const result = await dataRequest.query(dataQuery);

      return {
        pagination: {
          total: Number(total),
          page: pagination.page,
          perPage: pagination.perPage,
          hasMore: Number(total) > (pagination.page + 1) * pagination.perPage,
        },
        scores: result.recordset.map(row => transformScoreRow(row)),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_MSSQL_STORE_GET_SCORES_BY_SCORER_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { scorerId },
        },
        error,
      );
    }
  }

  async getScoresByRunId({
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

      if (total === 0) {
        return {
          pagination: {
            total: 0,
            page: pagination.page,
            perPage: pagination.perPage,
            hasMore: false,
          },
          scores: [],
        };
      }

      const dataRequest = this.pool.request();
      dataRequest.input('p1', runId);
      dataRequest.input('p2', pagination.perPage);
      dataRequest.input('p3', pagination.page * pagination.perPage);

      const result = await dataRequest.query(
        `SELECT * FROM ${getTableName({ indexName: TABLE_SCORERS, schemaName: getSchemaName(this.schema) })} WHERE [runId] = @p1 ORDER BY [createdAt] DESC OFFSET @p3 ROWS FETCH NEXT @p2 ROWS ONLY`,
      );

      return {
        pagination: {
          total: Number(total),
          page: pagination.page,
          perPage: pagination.perPage,
          hasMore: Number(total) > (pagination.page + 1) * pagination.perPage,
        },
        scores: result.recordset.map(row => transformScoreRow(row)),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_MSSQL_STORE_GET_SCORES_BY_RUN_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { runId },
        },
        error,
      );
    }
  }

  async getScoresByEntityId({
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

      if (total === 0) {
        return {
          pagination: {
            total: 0,
            page: pagination.page,
            perPage: pagination.perPage,
            hasMore: false,
          },
          scores: [],
        };
      }

      const dataRequest = this.pool.request();
      dataRequest.input('p1', entityId);
      dataRequest.input('p2', entityType);
      dataRequest.input('p3', pagination.perPage);
      dataRequest.input('p4', pagination.page * pagination.perPage);

      const result = await dataRequest.query(
        `SELECT * FROM ${getTableName({ indexName: TABLE_SCORERS, schemaName: getSchemaName(this.schema) })} WHERE [entityId] = @p1 AND [entityType] = @p2 ORDER BY [createdAt] DESC OFFSET @p4 ROWS FETCH NEXT @p3 ROWS ONLY`,
      );

      return {
        pagination: {
          total: Number(total),
          page: pagination.page,
          perPage: pagination.perPage,
          hasMore: Number(total) > (pagination.page + 1) * pagination.perPage,
        },
        scores: result.recordset.map(row => transformScoreRow(row)),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_MSSQL_STORE_GET_SCORES_BY_ENTITY_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { entityId, entityType },
        },
        error,
      );
    }
  }

  async getScoresBySpan({
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

      if (total === 0) {
        return {
          pagination: {
            total: 0,
            page: pagination.page,
            perPage: pagination.perPage,
            hasMore: false,
          },
          scores: [],
        };
      }

      const limit = pagination.perPage + 1;
      const dataRequest = this.pool.request();
      dataRequest.input('p1', traceId);
      dataRequest.input('p2', spanId);
      dataRequest.input('p3', limit);
      dataRequest.input('p4', pagination.page * pagination.perPage);

      const result = await dataRequest.query(
        `SELECT * FROM ${getTableName({ indexName: TABLE_SCORERS, schemaName: getSchemaName(this.schema) })} WHERE [traceId] = @p1 AND [spanId] = @p2 ORDER BY [createdAt] DESC OFFSET @p4 ROWS FETCH NEXT @p3 ROWS ONLY`,
      );

      return {
        pagination: {
          total: Number(total),
          page: pagination.page,
          perPage: pagination.perPage,
          hasMore: result.recordset.length > pagination.perPage,
        },
        scores: result.recordset.slice(0, pagination.perPage).map(row => transformScoreRow(row)),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_MSSQL_STORE_GET_SCORES_BY_SPAN_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { traceId, spanId },
        },
        error,
      );
    }
  }
}
