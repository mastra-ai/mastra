import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { ScoreRowData } from '@mastra/core/scores';
import type { PaginationInfo, StoragePagination } from '@mastra/core/storage';
import { ScoresStorage, TABLE_SCORERS } from '@mastra/core/storage';
import type { ConnectionPool } from 'mssql';
import type { StoreOperationsMSSQL } from '../operations';
import { getSchemaName, getTableName } from '../utils';

function parseJSON(jsonString: string): any {
  try {
    return JSON.parse(jsonString);
  } catch {
    return jsonString;
  }
}

function transformScoreRow(row: Record<string, any>): ScoreRowData {
  return {
    ...row,
    input: parseJSON(row.input),
    scorer: parseJSON(row.scorer),
    preprocessStepResult: parseJSON(row.preprocessStepResult),
    analyzeStepResult: parseJSON(row.analyzeStepResult),
    metadata: parseJSON(row.metadata),
    output: parseJSON(row.output),
    additionalContext: parseJSON(row.additionalContext),
    runtimeContext: parseJSON(row.runtimeContext),
    entity: parseJSON(row.entity),
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
      } = score;

      await this.operations.insert({
        tableName: TABLE_SCORERS,
        record: {
          id: scoreId,
          ...rest,
          input: JSON.stringify(input) || '',
          output: JSON.stringify(output) || '',
          preprocessStepResult: preprocessStepResult ? JSON.stringify(preprocessStepResult) : null,
          analyzeStepResult: analyzeStepResult ? JSON.stringify(analyzeStepResult) : null,
          metadata: metadata ? JSON.stringify(metadata) : null,
          additionalContext: additionalContext ? JSON.stringify(additionalContext) : null,
          runtimeContext: runtimeContext ? JSON.stringify(runtimeContext) : null,
          entity: entity ? JSON.stringify(entity) : null,
          scorer: scorer ? JSON.stringify(scorer) : null,
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
  }: {
    scorerId: string;
    pagination: StoragePagination;
    entityId?: string;
    entityType?: string;
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
    try {
      const request = this.pool.request();
      request.input('p1', scorerId);

      const totalResult = await request.query(
        `SELECT COUNT(*) as count FROM ${getTableName({ indexName: TABLE_SCORERS, schemaName: getSchemaName(this.schema) })} WHERE [scorerId] = @p1`,
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
      dataRequest.input('p1', scorerId);
      dataRequest.input('p2', pagination.perPage);
      dataRequest.input('p3', pagination.page * pagination.perPage);

      const result = await dataRequest.query(
        `SELECT * FROM ${getTableName({ indexName: TABLE_SCORERS, schemaName: getSchemaName(this.schema) })} WHERE [scorerId] = @p1 ORDER BY [createdAt] DESC OFFSET @p3 ROWS FETCH NEXT @p2 ROWS ONLY`,
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
}
