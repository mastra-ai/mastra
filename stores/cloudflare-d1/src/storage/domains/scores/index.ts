import { ErrorDomain, ErrorCategory, MastraError } from '@mastra/core/error';
import type { ScoreRowData, ScoringSource, ValidatedSaveScorePayload } from '@mastra/core/evals';
import { saveScorePayloadSchema } from '@mastra/core/evals';
import {
  ScoresStorage,
  TABLE_SCORERS,
  calculatePagination,
  normalizePerPage,
  safelyParseJSON,
} from '@mastra/core/storage';
import type { StoragePagination, PaginationInfo } from '@mastra/core/storage';
import type Cloudflare from 'cloudflare';
import { createSqlBuilder } from '../../sql-builder';
import type { StoreOperationsD1 } from '../operations';

export type D1QueryResult = Awaited<ReturnType<Cloudflare['d1']['database']['query']>>['result'];

export interface D1Client {
  query(args: { sql: string; params: string[] }): Promise<{ result: D1QueryResult }>;
}

function transformScoreRow(row: Record<string, any>): ScoreRowData {
  const deserialized: Record<string, any> = { ...row };

  // Reverse serialized JSON fields (stored as strings in D1)
  deserialized.input = safelyParseJSON(row.input);
  deserialized.output = safelyParseJSON(row.output);
  deserialized.scorer = safelyParseJSON(row.scorer);
  deserialized.preprocessStepResult = safelyParseJSON(row.preprocessStepResult);
  deserialized.analyzeStepResult = safelyParseJSON(row.analyzeStepResult);
  deserialized.metadata = safelyParseJSON(row.metadata);
  deserialized.additionalContext = safelyParseJSON(row.additionalContext);
  deserialized.requestContext = safelyParseJSON(row.requestContext);
  deserialized.entity = safelyParseJSON(row.entity);

  deserialized.createdAt = row.createdAtZ || row.createdAt;
  deserialized.updatedAt = row.updatedAtZ || row.updatedAt;

  return deserialized as ScoreRowData;
}

export class ScoresStorageD1 extends ScoresStorage {
  private operations: StoreOperationsD1;

  constructor({ operations }: { operations: StoreOperationsD1 }) {
    super();
    this.operations = operations;
  }

  async getScoreById({ id }: { id: string }): Promise<ScoreRowData | null> {
    try {
      const fullTableName = this.operations.getTableName(TABLE_SCORERS);
      const query = createSqlBuilder().select('*').from(fullTableName).where('id = ?', id);
      const { sql, params } = query.build();

      const result = await this.operations.executeQuery({ sql, params, first: true });

      if (!result) {
        return null;
      }

      return transformScoreRow(result);
    } catch (error) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_D1_STORE_SCORES_GET_SCORE_BY_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async saveScore(score: Omit<ScoreRowData, 'createdAt' | 'updatedAt'>): Promise<{ score: ScoreRowData }> {
    let parsedScore: ValidatedSaveScorePayload;
    try {
      parsedScore = saveScorePayloadSchema.parse(score);
    } catch (error) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_D1_STORE_SCORES_SAVE_SCORE_FAILED_INVALID_SCORE_PAYLOAD',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { scoreId: score.id },
        },
        error,
      );
    }

    try {
      const id = crypto.randomUUID();
      const fullTableName = this.operations.getTableName(TABLE_SCORERS);

      // Serialize all object values to JSON strings
      const serializedRecord: Record<string, any> = {};
      for (const [key, value] of Object.entries(parsedScore)) {
        if (value !== null && value !== undefined) {
          if (typeof value === 'object') {
            serializedRecord[key] = JSON.stringify(value);
          } else {
            serializedRecord[key] = value;
          }
        } else {
          serializedRecord[key] = null;
        }
      }

      serializedRecord.id = id;
      serializedRecord.createdAt = new Date().toISOString();
      serializedRecord.updatedAt = new Date().toISOString();

      const columns = Object.keys(serializedRecord);
      const values = Object.values(serializedRecord);

      const query = createSqlBuilder().insert(fullTableName, columns, values);
      const { sql, params } = query.build();

      await this.operations.executeQuery({ sql, params });

      const scoreFromDb = await this.getScoreById({ id });
      return { score: scoreFromDb! };
    } catch (error) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_D1_STORE_SCORES_SAVE_SCORE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async listScoresByScorerId({
    scorerId,
    entityId,
    entityType,
    source,
    pagination,
  }: {
    scorerId: string;
    entityId?: string;
    entityType?: string;
    source?: ScoringSource;
    pagination: StoragePagination;
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
    try {
      const { page, perPage: perPageInput } = pagination;
      const perPage = normalizePerPage(perPageInput, 100);
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

      const fullTableName = this.operations.getTableName(TABLE_SCORERS);

      // Get total count
      const countQuery = createSqlBuilder().count().from(fullTableName).where('scorerId = ?', scorerId);
      if (entityId) {
        countQuery.andWhere('entityId = ?', entityId);
      }
      if (entityType) {
        countQuery.andWhere('entityType = ?', entityType);
      }
      if (source) {
        countQuery.andWhere('source = ?', source);
      }
      const countResult = await this.operations.executeQuery(countQuery.build());
      const total = Array.isArray(countResult) ? Number(countResult?.[0]?.count ?? 0) : Number(countResult?.count ?? 0);

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

      const end = perPageInput === false ? total : start + perPage;
      const limitValue = perPageInput === false ? total : perPage;

      // Get paginated results
      const selectQuery = createSqlBuilder().select('*').from(fullTableName).where('scorerId = ?', scorerId);

      if (entityId) {
        selectQuery.andWhere('entityId = ?', entityId);
      }
      if (entityType) {
        selectQuery.andWhere('entityType = ?', entityType);
      }
      if (source) {
        selectQuery.andWhere('source = ?', source);
      }
      selectQuery.limit(limitValue).offset(start);

      const { sql, params } = selectQuery.build();
      const results = await this.operations.executeQuery({ sql, params });

      const scores = Array.isArray(results) ? results.map(transformScoreRow) : [];

      return {
        pagination: {
          total,
          page,
          perPage: perPageForResponse,
          hasMore: end < total,
        },
        scores,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_D1_STORE_SCORES_GET_SCORES_BY_SCORER_ID_FAILED',
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
      const { page, perPage: perPageInput } = pagination;
      const perPage = normalizePerPage(perPageInput, 100);
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

      const fullTableName = this.operations.getTableName(TABLE_SCORERS);

      // Get total count
      const countQuery = createSqlBuilder().count().from(fullTableName).where('runId = ?', runId);
      const countResult = await this.operations.executeQuery(countQuery.build());
      const total = Array.isArray(countResult) ? Number(countResult?.[0]?.count ?? 0) : Number(countResult?.count ?? 0);

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

      const end = perPageInput === false ? total : start + perPage;
      const limitValue = perPageInput === false ? total : perPage;

      // Get paginated results
      const selectQuery = createSqlBuilder()
        .select('*')
        .from(fullTableName)
        .where('runId = ?', runId)
        .limit(limitValue)
        .offset(start);

      const { sql, params } = selectQuery.build();
      const results = await this.operations.executeQuery({ sql, params });

      const scores = Array.isArray(results) ? results.map(transformScoreRow) : [];

      return {
        pagination: {
          total,
          page,
          perPage: perPageForResponse,
          hasMore: end < total,
        },
        scores,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_D1_STORE_SCORES_GET_SCORES_BY_RUN_ID_FAILED',
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
      const { page, perPage: perPageInput } = pagination;
      const perPage = normalizePerPage(perPageInput, 100);
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

      const fullTableName = this.operations.getTableName(TABLE_SCORERS);

      // Get total count
      const countQuery = createSqlBuilder()
        .count()
        .from(fullTableName)
        .where('entityId = ?', entityId)
        .andWhere('entityType = ?', entityType);
      const countResult = await this.operations.executeQuery(countQuery.build());
      const total = Array.isArray(countResult) ? Number(countResult?.[0]?.count ?? 0) : Number(countResult?.count ?? 0);

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

      const end = perPageInput === false ? total : start + perPage;
      const limitValue = perPageInput === false ? total : perPage;

      // Get paginated results
      const selectQuery = createSqlBuilder()
        .select('*')
        .from(fullTableName)
        .where('entityId = ?', entityId)
        .andWhere('entityType = ?', entityType)
        .limit(limitValue)
        .offset(start);

      const { sql, params } = selectQuery.build();
      const results = await this.operations.executeQuery({ sql, params });

      const scores = Array.isArray(results) ? results.map(transformScoreRow) : [];

      return {
        pagination: {
          total,
          page,
          perPage: perPageForResponse,
          hasMore: end < total,
        },
        scores,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_D1_STORE_SCORES_GET_SCORES_BY_ENTITY_ID_FAILED',
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
      const { page, perPage: perPageInput } = pagination;
      const perPage = normalizePerPage(perPageInput, 100);
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

      const fullTableName = this.operations.getTableName(TABLE_SCORERS);

      // Get total count
      const countQuery = createSqlBuilder()
        .count()
        .from(fullTableName)
        .where('traceId = ?', traceId)
        .andWhere('spanId = ?', spanId);
      const countResult = await this.operations.executeQuery(countQuery.build());
      const total = Array.isArray(countResult) ? Number(countResult?.[0]?.count ?? 0) : Number(countResult?.count ?? 0);

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

      const end = perPageInput === false ? total : start + perPage;
      const limitValue = perPageInput === false ? total : perPage;

      // Get paginated results
      const selectQuery = createSqlBuilder()
        .select('*')
        .from(fullTableName)
        .where('traceId = ?', traceId)
        .andWhere('spanId = ?', spanId)
        .orderBy('createdAt', 'DESC')
        .limit(limitValue)
        .offset(start);

      const { sql, params } = selectQuery.build();
      const results = await this.operations.executeQuery({ sql, params });
      const scores = Array.isArray(results) ? results.map(transformScoreRow) : [];

      return {
        pagination: {
          total,
          page,
          perPage: perPageForResponse,
          hasMore: end < total,
        },
        scores,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_D1_STORE_SCORES_GET_SCORES_BY_SPAN_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }
}
