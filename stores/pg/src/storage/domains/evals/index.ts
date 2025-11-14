import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { saveScorePayloadSchema } from '@mastra/core/evals';
import type { ScoreRowData, ScoringSource, ValidatedSaveScorePayload } from '@mastra/core/evals';
import type {
  PaginationInfo,
  StoragePagination,
  CreateIndexOptions,
  IndexInfo,
  StorageIndexStats,
} from '@mastra/core/storage';
import {
  calculatePagination,
  normalizePerPage,
  safelyParseJSON,
  EvalsStorageBase,
  TABLE_SCORERS,
  TABLE_SCHEMAS,
} from '@mastra/core/storage';
import { PGDomainBase } from '../base';
import type { PGDomainConfig } from '../base';
import { IndexManagementPG } from '../operations';
import { getTableName } from '../utils';

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
    requestContext: safelyParseJSON(row.requestContext),
    entity: safelyParseJSON(row.entity),
    createdAt: row.createdAtZ || row.createdAt,
    updatedAt: row.updatedAtZ || row.updatedAt,
  } as ScoreRowData;
}

// Evals domain table names
type EvalsTableNames = typeof TABLE_SCORERS;

export class EvalsStoragePG extends EvalsStorageBase {
  private domainBase: PGDomainBase;
  indexManagement?: IndexManagementPG;
  schemaPrefix?: string;

  constructor(opts: PGDomainConfig) {
    super();
    this.domainBase = new PGDomainBase(opts);
    this.schemaPrefix =
      this.domainBase.getSchema() && this.domainBase.getSchema() !== 'public' ? `${this.domainBase.getSchema()}_` : '';
  }

  private getIndexManagement() {
    if (!this.indexManagement) {
      this.indexManagement = new IndexManagementPG({
        client: this.domainBase.getClient(),
        schemaName: this.domainBase.getSchema(),
      });
    }
    return this.indexManagement;
  }

  async createIndex<T extends EvalsTableNames>({
    name,
    table,
    columns,
  }: {
    table: T;
  } & Omit<CreateIndexOptions, 'table'>) {
    const indexManagement = this.getIndexManagement();

    await indexManagement.createIndex({
      name: `${this.schemaPrefix}${name}`,
      table,
      columns,
    });
  }

  async listIndexes<T extends EvalsTableNames>(table: T): Promise<IndexInfo[]> {
    const indexManagement = this.getIndexManagement();
    return indexManagement.listIndexes(table);
  }

  async describeIndex(name: string): Promise<StorageIndexStats> {
    const indexManagement = this.getIndexManagement();
    return indexManagement.describeIndex(`${this.schemaPrefix}${name}`);
  }

  async dropIndex(name: string) {
    const indexManagement = this.getIndexManagement();
    await indexManagement.dropIndex(`${this.schemaPrefix}${name}`);
  }

  async createIndexes(): Promise<void> {
    // Create indexes for evals domain
    // Create scores index
    try {
      await this.createIndex({
        name: 'mastra_scores_trace_id_span_id_created_at_idx',
        table: TABLE_SCORERS,
        columns: ['traceId', 'spanId', 'createdAt DESC'],
      });
    } catch (error) {
      // Log but don't fail initialization - indexes are performance optimizations
      this.logger?.warn?.('Failed to create evals scores index:', error);
    }
  }

  async dropIndexes(): Promise<void> {
    await this.dropIndex('mastra_scores_trace_id_span_id_created_at_idx');
  }

  async init(): Promise<void> {
    await this.domainBase
      .getOperations()
      .createTable({ tableName: TABLE_SCORERS, schema: TABLE_SCHEMAS[TABLE_SCORERS] });

    await this.createIndexes();
  }

  async close(): Promise<void> {
    await this.domainBase.close();
  }

  async dropData(): Promise<void> {
    await this.domainBase.getOperations().clearTable({ tableName: TABLE_SCORERS });
  }

  async getScoreById({ id }: { id: string }): Promise<ScoreRowData | null> {
    try {
      const result = await this.domainBase
        .getClient()
        .oneOrNone<ScoreRowData>(
          `SELECT * FROM ${getTableName({ indexName: TABLE_SCORERS, schemaName: this.domainBase.getSchema() })} WHERE id = $1`,
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

      const total = await this.domainBase.getClient().oneOrNone<{
        count: string;
      }>(`SELECT COUNT(*) FROM ${getTableName({ indexName: TABLE_SCORERS, schemaName: this.domainBase.getSchema() })} WHERE ${whereClause}`, queryParams);
      const { page, perPage: perPageInput } = pagination;
      const perPage = normalizePerPage(perPageInput, 100); // false → MAX_SAFE_INTEGER
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
      const result = await this.domainBase
        .getClient()
        .manyOrNone<ScoreRowData>(
          `SELECT * FROM ${getTableName({ indexName: TABLE_SCORERS, schemaName: this.domainBase.getSchema() })} WHERE ${whereClause} ORDER BY "createdAt" DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
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
          id: 'MASTRA_STORAGE_PG_STORE_GET_SCORES_BY_SCORER_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async saveScore(score: Omit<ScoreRowData, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ score: ScoreRowData }> {
    let parsedScore: ValidatedSaveScorePayload;
    try {
      parsedScore = saveScorePayloadSchema.parse(score);
    } catch (error) {
      throw new MastraError(
        {
          id: 'MASTRA_STORAGE_PG_STORE_SAVE_SCORE_FAILED_INVALID_SCORE_PAYLOAD',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: {
            scorer: score.scorer.id,
            entityId: score.entityId,
            entityType: score.entityType,
            traceId: score.traceId || '',
            spanId: score.spanId || '',
          },
        },
        error,
      );
    }

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
        requestContext,
        entity,
        ...rest
      } = parsedScore;

      await this.domainBase.getOperations().insert({
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

  async listScoresByRunId({
    runId,
    pagination,
  }: {
    runId: string;
    pagination: StoragePagination;
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
    try {
      const total = await this.domainBase.getClient().oneOrNone<{
        count: string;
      }>(`SELECT COUNT(*) FROM ${getTableName({ indexName: TABLE_SCORERS, schemaName: this.domainBase.getSchema() })} WHERE "runId" = $1`, [runId]);
      const { page, perPage: perPageInput } = pagination;
      const perPage = normalizePerPage(perPageInput, 100); // false → MAX_SAFE_INTEGER
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

      const result = await this.domainBase
        .getClient()
        .manyOrNone<ScoreRowData>(
          `SELECT * FROM ${getTableName({ indexName: TABLE_SCORERS, schemaName: this.domainBase.getSchema() })} WHERE "runId" = $1 LIMIT $2 OFFSET $3`,
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
          id: 'MASTRA_STORAGE_PG_STORE_GET_SCORES_BY_RUN_ID_FAILED',
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
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
    try {
      const total = await this.domainBase.getClient().oneOrNone<{
        count: string;
      }>(`SELECT COUNT(*) FROM ${getTableName({ indexName: TABLE_SCORERS, schemaName: this.domainBase.getSchema() })} WHERE "entityId" = $1 AND "entityType" = $2`, [entityId, entityType]);
      const { page, perPage: perPageInput } = pagination;
      const perPage = normalizePerPage(perPageInput, 100); // false → MAX_SAFE_INTEGER
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

      const result = await this.domainBase
        .getClient()
        .manyOrNone<ScoreRowData>(
          `SELECT * FROM ${getTableName({ indexName: TABLE_SCORERS, schemaName: this.domainBase.getSchema() })} WHERE "entityId" = $1 AND "entityType" = $2 LIMIT $3 OFFSET $4`,
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
          id: 'MASTRA_STORAGE_PG_STORE_GET_SCORES_BY_ENTITY_ID_FAILED',
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
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
    try {
      const tableName = getTableName({ indexName: TABLE_SCORERS, schemaName: this.domainBase.getSchema() });
      const countSQLResult = await this.domainBase.getClient().oneOrNone<{
        count: string;
      }>(`SELECT COUNT(*) as count FROM ${tableName} WHERE "traceId" = $1 AND "spanId" = $2`, [traceId, spanId]);

      const total = Number(countSQLResult?.count ?? 0);
      const { page, perPage: perPageInput } = pagination;
      const perPage = normalizePerPage(perPageInput, 100); // false → MAX_SAFE_INTEGER
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
      const limitValue = perPageInput === false ? total : perPage;
      const end = perPageInput === false ? total : start + perPage;
      const result = await this.domainBase
        .getClient()
        .manyOrNone<ScoreRowData>(
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
          id: 'MASTRA_STORAGE_PG_STORE_GET_SCORES_BY_SPAN_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }
}
