import type { Client, InValue } from '@libsql/client';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { saveScorePayloadSchema } from '@mastra/core/evals';
import type { ScoreRowData, ScoringSource, ValidatedSaveScorePayload } from '@mastra/core/evals';
import {
  TABLE_SCORERS,
  ScoresStorage,
  calculatePagination,
  normalizePerPage,
  safelyParseJSON,
} from '@mastra/core/storage';
import type { PaginationInfo, StoragePagination } from '@mastra/core/storage';
import type { StoreOperationsLibSQL } from '../operations';

export class ScoresLibSQL extends ScoresStorage {
  private operations: StoreOperationsLibSQL;
  private client: Client;
  constructor({ client, operations }: { client: Client; operations: StoreOperationsLibSQL }) {
    super();
    this.operations = operations;
    this.client = client;
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

      // Get total count first
      const countResult = await this.client.execute({
        sql: `SELECT COUNT(*) as count FROM ${TABLE_SCORERS} WHERE runId = ?`,
        args: [runId],
      });
      const total = Number(countResult.rows?.[0]?.count ?? 0);

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

      const perPage = normalizePerPage(perPageInput, 100);
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
      const limitValue = perPageInput === false ? total : perPage;
      const end = perPageInput === false ? total : start + perPage;

      const result = await this.client.execute({
        sql: `SELECT * FROM ${TABLE_SCORERS} WHERE runId = ? ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
        args: [runId, limitValue, start],
      });

      const scores = result.rows?.map(row => this.transformScoreRow(row)) ?? [];

      return {
        scores,
        pagination: {
          total,
          page,
          perPage: perPageForResponse,
          hasMore: end < total,
        },
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'LIBSQL_STORE_GET_SCORES_BY_RUN_ID_FAILED',
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

      const conditions: string[] = [];
      const queryParams: InValue[] = [];

      if (scorerId) {
        conditions.push(`scorerId = ?`);
        queryParams.push(scorerId);
      }

      if (entityId) {
        conditions.push(`entityId = ?`);
        queryParams.push(entityId);
      }

      if (entityType) {
        conditions.push(`entityType = ?`);
        queryParams.push(entityType);
      }

      if (source) {
        conditions.push(`source = ?`);
        queryParams.push(source);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count first
      const countResult = await this.client.execute({
        sql: `SELECT COUNT(*) as count FROM ${TABLE_SCORERS} ${whereClause}`,
        args: queryParams,
      });
      const total = Number(countResult.rows?.[0]?.count ?? 0);

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

      const perPage = normalizePerPage(perPageInput, 100);
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
      const limitValue = perPageInput === false ? total : perPage;
      const end = perPageInput === false ? total : start + perPage;

      const result = await this.client.execute({
        sql: `SELECT * FROM ${TABLE_SCORERS} ${whereClause} ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
        args: [...queryParams, limitValue, start],
      });

      const scores = result.rows?.map(row => this.transformScoreRow(row)) ?? [];

      return {
        scores,
        pagination: {
          total,
          page,
          perPage: perPageForResponse,
          hasMore: end < total,
        },
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'LIBSQL_STORE_GET_SCORES_BY_SCORER_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  private transformScoreRow(row: Record<string, any>): ScoreRowData {
    const scorerValue = safelyParseJSON(row.scorer);
    const inputValue = safelyParseJSON(row.input ?? '{}');
    const outputValue = safelyParseJSON(row.output ?? '{}');
    const additionalLLMContextValue = row.additionalLLMContext ? safelyParseJSON(row.additionalLLMContext) : null;
    const requestContextValue = row.requestContext ? safelyParseJSON(row.requestContext) : null;
    const metadataValue = row.metadata ? safelyParseJSON(row.metadata) : null;
    const entityValue = row.entity ? safelyParseJSON(row.entity) : null;
    const preprocessStepResultValue = row.preprocessStepResult ? safelyParseJSON(row.preprocessStepResult) : null;
    const analyzeStepResultValue = row.analyzeStepResult ? safelyParseJSON(row.analyzeStepResult) : null;

    return {
      id: row.id,
      traceId: row.traceId,
      spanId: row.spanId,
      runId: row.runId,
      scorer: scorerValue,
      score: row.score,
      reason: row.reason,
      preprocessStepResult: preprocessStepResultValue,
      analyzeStepResult: analyzeStepResultValue,
      analyzePrompt: row.analyzePrompt,
      preprocessPrompt: row.preprocessPrompt,
      generateScorePrompt: row.generateScorePrompt,
      generateReasonPrompt: row.generateReasonPrompt,
      metadata: metadataValue,
      input: inputValue,
      output: outputValue,
      additionalContext: additionalLLMContextValue,
      requestContext: requestContextValue,
      entityType: row.entityType,
      entity: entityValue,
      entityId: row.entityId,
      scorerId: row.scorerId,
      source: row.source,
      resourceId: row.resourceId,
      threadId: row.threadId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async getScoreById({ id }: { id: string }): Promise<ScoreRowData | null> {
    const result = await this.client.execute({
      sql: `SELECT * FROM ${TABLE_SCORERS} WHERE id = ?`,
      args: [id],
    });
    return result.rows?.[0] ? this.transformScoreRow(result.rows[0]) : null;
  }

  async saveScore(score: Omit<ScoreRowData, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ score: ScoreRowData }> {
    let parsedScore: ValidatedSaveScorePayload;
    try {
      parsedScore = saveScorePayloadSchema.parse(score);
    } catch (error) {
      throw new MastraError(
        {
          id: 'LIBSQL_STORE_SAVE_SCORE_FAILED_INVALID_SCORE_PAYLOAD',
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
      const id = crypto.randomUUID();

      await this.operations.insert({
        tableName: TABLE_SCORERS,
        record: {
          id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          ...parsedScore,
        },
      });

      const scoreFromDb = await this.getScoreById({ id });
      return { score: scoreFromDb! };
    } catch (error) {
      throw new MastraError(
        {
          id: 'LIBSQL_STORE_SAVE_SCORE_FAILED',
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

      // Get total count first
      const countResult = await this.client.execute({
        sql: `SELECT COUNT(*) as count FROM ${TABLE_SCORERS} WHERE entityId = ? AND entityType = ?`,
        args: [entityId, entityType],
      });
      const total = Number(countResult.rows?.[0]?.count ?? 0);

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

      const perPage = normalizePerPage(perPageInput, 100);
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
      const limitValue = perPageInput === false ? total : perPage;
      const end = perPageInput === false ? total : start + perPage;

      const result = await this.client.execute({
        sql: `SELECT * FROM ${TABLE_SCORERS} WHERE entityId = ? AND entityType = ? ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
        args: [entityId, entityType, limitValue, start],
      });

      const scores = result.rows?.map(row => this.transformScoreRow(row)) ?? [];

      return {
        scores,
        pagination: {
          total,
          page,
          perPage: perPageForResponse,
          hasMore: end < total,
        },
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'LIBSQL_STORE_GET_SCORES_BY_ENTITY_ID_FAILED',
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

      const countSQLResult = await this.client.execute({
        sql: `SELECT COUNT(*) as count FROM ${TABLE_SCORERS} WHERE traceId = ? AND spanId = ?`,
        args: [traceId, spanId],
      });

      const total = Number(countSQLResult.rows?.[0]?.count ?? 0);

      const limitValue = perPageInput === false ? total : perPage;
      const end = perPageInput === false ? total : start + perPage;

      const result = await this.client.execute({
        sql: `SELECT * FROM ${TABLE_SCORERS} WHERE traceId = ? AND spanId = ? ORDER BY createdAt DESC LIMIT ? OFFSET ?`,
        args: [traceId, spanId, limitValue, start],
      });

      const scores = result.rows?.map(row => this.transformScoreRow(row)) ?? [];

      return {
        scores,
        pagination: {
          total,
          page,
          perPage: perPageForResponse,
          hasMore: end < total,
        },
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'LIBSQL_STORE_GET_SCORES_BY_SPAN_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }
}
