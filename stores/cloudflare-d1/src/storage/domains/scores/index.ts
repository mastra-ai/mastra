import { ErrorDomain, ErrorCategory, MastraError } from '@mastra/core/error';
import type { ListScoresResponse, SaveScorePayload, ScoreRowData, ScoringSource } from '@mastra/core/evals';
import { saveScorePayloadSchema } from '@mastra/core/evals';
import {
  createStorageErrorId,
  ScoresStorage,
  TABLE_SCORERS,
  TABLE_SCHEMAS,
  calculatePagination,
  normalizePerPage,
  transformScoreRow as coreTransformScoreRow,
} from '@mastra/core/storage';
import type { StoragePagination } from '@mastra/core/storage';
import { D1DB, resolveD1Config } from '../../db';
import type { D1DomainConfig } from '../../db';
import { createSqlBuilder } from '../../sql-builder';

/**
 * Cloudflare D1-specific score row transformation.
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

export class ScoresStorageD1 extends ScoresStorage {
  #db: D1DB;

  constructor(config: D1DomainConfig) {
    super();
    this.#db = new D1DB(resolveD1Config(config));
  }

  async init(): Promise<void> {
    await this.#db.createTable({ tableName: TABLE_SCORERS, schema: TABLE_SCHEMAS[TABLE_SCORERS] });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.clearTable({ tableName: TABLE_SCORERS });
  }

  async getScoreById({ id }: { id: string }): Promise<ScoreRowData | null> {
    try {
      const fullTableName = this.#db.getTableName(TABLE_SCORERS);
      const query = createSqlBuilder().select('*').from(fullTableName).where('id = ?', id);
      const { sql, params } = query.build();

      const result = await this.#db.executeQuery({ sql, params, first: true });

      if (!result) {
        return null;
      }

      return transformScoreRow(result);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE_D1', 'GET_SCORE_BY_ID', 'FAILED'),
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
          id: createStorageErrorId('CLOUDFLARE_D1', 'SAVE_SCORE', 'VALIDATION_FAILED'),
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

    const id = crypto.randomUUID();

    try {
      const fullTableName = this.#db.getTableName(TABLE_SCORERS);

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

      const now = new Date();
      serializedRecord.id = id;
      serializedRecord.createdAt = now.toISOString();
      serializedRecord.updatedAt = now.toISOString();

      const columns = Object.keys(serializedRecord);
      const values = Object.values(serializedRecord);

      const query = createSqlBuilder().insert(fullTableName, columns, values);
      const { sql, params } = query.build();

      await this.#db.executeQuery({ sql, params });

      return { score: { ...parsedScore, id, createdAt: now, updatedAt: now } as ScoreRowData };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE_D1', 'SAVE_SCORE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id },
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
      const perPage = normalizePerPage(perPageInput, 100);
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

      const fullTableName = this.#db.getTableName(TABLE_SCORERS);

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
      const countResult = await this.#db.executeQuery(countQuery.build());
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
      const results = await this.#db.executeQuery({ sql, params });

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
          id: createStorageErrorId('CLOUDFLARE_D1', 'GET_SCORES_BY_SCORER_ID', 'FAILED'),
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
      const { page, perPage: perPageInput } = pagination;
      const perPage = normalizePerPage(perPageInput, 100);
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

      const fullTableName = this.#db.getTableName(TABLE_SCORERS);

      // Get total count
      const countQuery = createSqlBuilder().count().from(fullTableName).where('runId = ?', runId);
      const countResult = await this.#db.executeQuery(countQuery.build());
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
      const results = await this.#db.executeQuery({ sql, params });

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
          id: createStorageErrorId('CLOUDFLARE_D1', 'GET_SCORES_BY_RUN_ID', 'FAILED'),
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
      const perPage = normalizePerPage(perPageInput, 100);
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

      const fullTableName = this.#db.getTableName(TABLE_SCORERS);

      // Get total count
      const countQuery = createSqlBuilder()
        .count()
        .from(fullTableName)
        .where('entityId = ?', entityId)
        .andWhere('entityType = ?', entityType);
      const countResult = await this.#db.executeQuery(countQuery.build());
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
      const results = await this.#db.executeQuery({ sql, params });

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
          id: createStorageErrorId('CLOUDFLARE_D1', 'GET_SCORES_BY_ENTITY_ID', 'FAILED'),
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

      const fullTableName = this.#db.getTableName(TABLE_SCORERS);

      // Get total count
      const countQuery = createSqlBuilder()
        .count()
        .from(fullTableName)
        .where('traceId = ?', traceId)
        .andWhere('spanId = ?', spanId);
      const countResult = await this.#db.executeQuery(countQuery.build());
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
      const results = await this.#db.executeQuery({ sql, params });
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
          id: createStorageErrorId('CLOUDFLARE_D1', 'GET_SCORES_BY_SPAN', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }
}
