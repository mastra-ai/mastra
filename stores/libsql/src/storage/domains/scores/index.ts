import type { Client, InValue } from '@libsql/client';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { saveScorePayloadSchema } from '@mastra/core/evals';
import type { ListScoresResponse, SaveScorePayload, ScoreRowData, ScoringSource } from '@mastra/core/evals';
import {
  createStorageErrorId,
  TABLE_SCORERS,
  SCORERS_SCHEMA,
  ScoresStorage,
  calculatePagination,
  normalizePerPage,
  transformScoreRow as coreTransformScoreRow,
} from '@mastra/core/storage';
import type { StoragePagination } from '@mastra/core/storage';
import { LibSQLDB, resolveClient } from '../../db';
import type { LibSQLDomainConfig } from '../../db';

export class ScoresLibSQL extends ScoresStorage {
  #db: LibSQLDB;
  #client: Client;

  constructor(config: LibSQLDomainConfig) {
    super();
    const client = resolveClient(config);
    this.#client = client;
    this.#db = new LibSQLDB({ client, maxRetries: config.maxRetries, initialBackoffMs: config.initialBackoffMs });
  }

  async init(): Promise<void> {
    await this.#db.createTable({ tableName: TABLE_SCORERS, schema: SCORERS_SCHEMA });
    // Add columns for backwards compatibility
    await this.#db.alterTable({
      tableName: TABLE_SCORERS,
      schema: SCORERS_SCHEMA,
      ifNotExists: ['spanId', 'requestContext'],
    });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.deleteData({ tableName: TABLE_SCORERS });
  }

  async listScoresByRunId({
    runId,
    pagination,
  }: {
    runId: string;
    pagination: StoragePagination;
  }): Promise<ListScoresResponse> {
    try {
      const { page, perPage: perPageInput } = pagination;

      // Get total count first
      const countResult = await this.#client.execute({
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

      const result = await this.#client.execute({
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
          id: createStorageErrorId('LIBSQL', 'LIST_SCORES_BY_RUN_ID', 'FAILED'),
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
  }): Promise<ListScoresResponse> {
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
      const countResult = await this.#client.execute({
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

      const result = await this.#client.execute({
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
          id: createStorageErrorId('LIBSQL', 'LIST_SCORES_BY_SCORER_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  /**
   * LibSQL-specific score row transformation.
   * Maps additionalLLMContext column to additionalContext field.
   */
  private transformScoreRow(row: Record<string, any>): ScoreRowData {
    return coreTransformScoreRow(row, {
      fieldMappings: { additionalContext: 'additionalLLMContext' },
    });
  }

  async getScoreById({ id }: { id: string }): Promise<ScoreRowData | null> {
    const result = await this.#client.execute({
      sql: `SELECT * FROM ${TABLE_SCORERS} WHERE id = ?`,
      args: [id],
    });
    return result.rows?.[0] ? this.transformScoreRow(result.rows[0]) : null;
  }

  async saveScore(score: SaveScorePayload): Promise<{ score: ScoreRowData }> {
    let parsedScore: SaveScorePayload;
    try {
      parsedScore = saveScorePayloadSchema.parse(score);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'SAVE_SCORE', 'VALIDATION_FAILED'),
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

      await this.#db.insert({
        tableName: TABLE_SCORERS,
        record: {
          ...parsedScore,
          id,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
      });

      return { score: { ...parsedScore, id, createdAt: now, updatedAt: now } as ScoreRowData };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'SAVE_SCORE', 'FAILED'),
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
      const { page, perPage: perPageInput } = pagination;

      // Get total count first
      const countResult = await this.#client.execute({
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

      const result = await this.#client.execute({
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
          id: createStorageErrorId('LIBSQL', 'LIST_SCORES_BY_ENTITY_ID', 'FAILED'),
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
      const { page, perPage: perPageInput } = pagination;
      const perPage = normalizePerPage(perPageInput, 100);
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

      const countSQLResult = await this.#client.execute({
        sql: `SELECT COUNT(*) as count FROM ${TABLE_SCORERS} WHERE traceId = ? AND spanId = ?`,
        args: [traceId, spanId],
      });

      const total = Number(countSQLResult.rows?.[0]?.count ?? 0);

      const limitValue = perPageInput === false ? total : perPage;
      const end = perPageInput === false ? total : start + perPage;

      const result = await this.#client.execute({
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
          id: createStorageErrorId('LIBSQL', 'LIST_SCORES_BY_SPAN', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }
}
