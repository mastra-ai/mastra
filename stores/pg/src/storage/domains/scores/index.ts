import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { ScoreRowData, ScoringSource } from '@mastra/core/scores';
import type { PaginationInfo, StoragePagination } from '@mastra/core/storage';
import { safelyParseJSON, ScoresStorage, TABLE_SCORERS } from '@mastra/core/storage';
import type { IDatabase } from 'pg-promise';
import type { StoreOperationsPG } from '../operations';
import { getTableName } from '../utils';

function transformScoreRow(row: Record<string, any>): ScoreRowData {
  console.log(`row is`, JSON.stringify(row, null, 2));
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
    createdAt: row.createdAtZ || row.createdAt,
    updatedAt: row.updatedAtZ || row.updatedAt,
  } as ScoreRowData;
}

export class ScoresPG extends ScoresStorage {
  public client: IDatabase<{}>;
  private operations: StoreOperationsPG;
  private schema?: string;

  constructor({
    client,
    operations,
    schema,
  }: {
    client: IDatabase<{}>;
    operations: StoreOperationsPG;
    schema?: string;
  }) {
    super();
    this.client = client;
    this.operations = operations;
    this.schema = schema;
  }

  async getScoreById({ id }: { id: string }): Promise<ScoreRowData | null> {
    try {
      const result = await this.client.oneOrNone<ScoreRowData>(
        `SELECT * FROM ${getTableName({ indexName: TABLE_SCORERS, schemaName: this.schema })} WHERE id = $1`,
        [id],
      );

      return result ? transformScoreRow(result) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_PG_STORE_GET_SCORE_BY_ID_FAILED',
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

      const total = await this.client.oneOrNone<{ count: string }>(
        `SELECT COUNT(*) FROM ${getTableName({ indexName: TABLE_SCORERS, schemaName: this.schema })} WHERE ${whereClause}`,
        queryParams,
      );
      if (total?.count === '0' || !total?.count) {
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

      const result = await this.client.manyOrNone<ScoreRowData>(
        `SELECT * FROM ${getTableName({ indexName: TABLE_SCORERS, schemaName: this.schema })} WHERE ${whereClause} ORDER BY "createdAt" DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
        [...queryParams, pagination.perPage, pagination.page * pagination.perPage],
      );

      return {
        pagination: {
          total: Number(total?.count) || 0,
          page: pagination.page,
          perPage: pagination.perPage,
          hasMore: Number(total?.count) > (pagination.page + 1) * pagination.perPage,
        },
        scores: result.map(transformScoreRow),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_PG_STORE_GET_SCORES_BY_SCORER_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async saveScore(score: Omit<ScoreRowData, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ score: ScoreRowData }> {
    try {
      // Generate ID like other storage implementations
      const id = crypto.randomUUID();

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

      console.log(`saving score with id: ${id}`);

      await this.operations.insert({
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
          runtimeContext: runtimeContext ? JSON.stringify(runtimeContext) : null,
          entity: entity ? JSON.stringify(entity) : null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      });

      const scoreFromDb = await this.getScoreById({ id });
      return { score: scoreFromDb! };
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_PG_STORE_SAVE_SCORE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
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
      const total = await this.client.oneOrNone<{ count: string }>(
        `SELECT COUNT(*) FROM ${getTableName({ indexName: TABLE_SCORERS, schemaName: this.schema })} WHERE "runId" = $1`,
        [runId],
      );
      if (total?.count === '0' || !total?.count) {
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

      const result = await this.client.manyOrNone<ScoreRowData>(
        `SELECT * FROM ${getTableName({ indexName: TABLE_SCORERS, schemaName: this.schema })} WHERE "runId" = $1 LIMIT $2 OFFSET $3`,
        [runId, pagination.perPage, pagination.page * pagination.perPage],
      );
      return {
        pagination: {
          total: Number(total?.count) || 0,
          page: pagination.page,
          perPage: pagination.perPage,
          hasMore: Number(total?.count) > (pagination.page + 1) * pagination.perPage,
        },
        scores: result.map(transformScoreRow),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_PG_STORE_GET_SCORES_BY_RUN_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
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
      const total = await this.client.oneOrNone<{ count: string }>(
        `SELECT COUNT(*) FROM ${getTableName({ indexName: TABLE_SCORERS, schemaName: this.schema })} WHERE "entityId" = $1 AND "entityType" = $2`,
        [entityId, entityType],
      );

      if (total?.count === '0' || !total?.count) {
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

      const result = await this.client.manyOrNone<ScoreRowData>(
        `SELECT * FROM ${getTableName({ indexName: TABLE_SCORERS, schemaName: this.schema })} WHERE "entityId" = $1 AND "entityType" = $2 LIMIT $3 OFFSET $4`,
        [entityId, entityType, pagination.perPage, pagination.page * pagination.perPage],
      );
      return {
        pagination: {
          total: Number(total?.count) || 0,
          page: pagination.page,
          perPage: pagination.perPage,
          hasMore: Number(total?.count) > (pagination.page + 1) * pagination.perPage,
        },
        scores: result.map(transformScoreRow),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_PG_STORE_GET_SCORES_BY_ENTITY_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }
}
