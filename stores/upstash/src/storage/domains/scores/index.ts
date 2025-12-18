import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { SaveScorePayload, ScoreRowData, ScoringSource, ValidatedSaveScorePayload } from '@mastra/core/evals';
import { saveScorePayloadSchema } from '@mastra/core/evals';
import {
  calculatePagination,
  normalizePerPage,
  ScoresStorage,
  TABLE_SCORERS,
  transformScoreRow as coreTransformScoreRow,
  createStorageErrorId,
} from '@mastra/core/storage';
import type { PaginationInfo, StoragePagination } from '@mastra/core/storage';
import type { Redis } from '@upstash/redis';
import { UpstashDB, resolveUpstashConfig } from '../../db';
import type { UpstashDomainConfig } from '../../db';
import { processRecord } from '../utils';

/**
 * Upstash-specific score row transformation.
 * Uses default options (no timestamp conversion).
 */
function transformScoreRow(row: Record<string, any>): ScoreRowData {
  return coreTransformScoreRow(row);
}

export class ScoresUpstash extends ScoresStorage {
  private client: Redis;
  #db: UpstashDB;

  constructor(config: UpstashDomainConfig) {
    super();
    const client = resolveUpstashConfig(config);
    this.client = client;
    this.#db = new UpstashDB({ client });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.deleteData({ tableName: TABLE_SCORERS });
  }

  async getScoreById({ id }: { id: string }): Promise<ScoreRowData | null> {
    try {
      const data = await this.#db.get<ScoreRowData>({
        tableName: TABLE_SCORERS,
        keys: { id },
      });
      if (!data) return null;
      return transformScoreRow(data);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('UPSTASH', 'GET_SCORE_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            ...(id && { id }),
          },
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
    pagination = { page: 0, perPage: 20 },
  }: {
    scorerId: string;
    entityId?: string;
    entityType?: string;
    source?: ScoringSource;
    pagination?: StoragePagination;
  }): Promise<{
    scores: ScoreRowData[];
    pagination: PaginationInfo;
  }> {
    const pattern = `${TABLE_SCORERS}:*`;
    const keys = await this.#db.scanKeys(pattern);
    const { page, perPage: perPageInput } = pagination;
    if (keys.length === 0) {
      return {
        scores: [],
        pagination: { total: 0, page, perPage: perPageInput, hasMore: false },
      };
    }
    const pipeline = this.client.pipeline();
    keys.forEach(key => pipeline.get(key));
    const results = await pipeline.exec();
    // Filter out nulls and by scorerId
    const filtered = results
      .map((raw: any) => {
        if (!raw) return null;
        if (typeof raw === 'string') {
          try {
            return JSON.parse(raw);
          } catch {
            return null;
          }
        }
        return raw as Record<string, any>;
      })
      .filter((row): row is Record<string, any> => {
        if (!row || typeof row !== 'object') return false;
        if (row.scorerId !== scorerId) return false;
        if (entityId && row.entityId !== entityId) return false;
        if (entityType && row.entityType !== entityType) return false;
        if (source && row.source !== source) return false;
        return true;
      });
    const perPage = normalizePerPage(perPageInput, 100); // false → MAX_SAFE_INTEGER
    const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
    const end = perPageInput === false ? filtered.length : start + perPage;
    const total = filtered.length;
    const paged = filtered.slice(start, end);
    const scores = paged.map(row => transformScoreRow(row));
    return {
      scores,
      pagination: {
        total,
        page,
        perPage: perPageForResponse,
        hasMore: end < total,
      },
    };
  }

  async saveScore(score: SaveScorePayload): Promise<{ score: ScoreRowData }> {
    let validatedScore: ValidatedSaveScorePayload;
    try {
      validatedScore = saveScorePayloadSchema.parse(score);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('UPSTASH', 'SAVE_SCORE', 'VALIDATION_FAILED'),
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

    const now = new Date();
    const id = crypto.randomUUID();
    const createdAt = now;
    const updatedAt = now;

    const scoreWithId = {
      ...validatedScore,
      id,
      createdAt,
      updatedAt,
    };

    const { key, processedRecord } = processRecord(TABLE_SCORERS, scoreWithId);
    try {
      await this.client.set(key, processedRecord);
      return { score: { ...validatedScore, id, createdAt, updatedAt } as ScoreRowData };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('UPSTASH', 'SAVE_SCORE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id },
        },
        error,
      );
    }
  }

  async listScoresByRunId({
    runId,
    pagination = { page: 0, perPage: 20 },
  }: {
    runId: string;
    pagination?: StoragePagination;
  }): Promise<{
    scores: ScoreRowData[];
    pagination: PaginationInfo;
  }> {
    const pattern = `${TABLE_SCORERS}:*`;
    const keys = await this.#db.scanKeys(pattern);
    const { page, perPage: perPageInput } = pagination;
    if (keys.length === 0) {
      return {
        scores: [],
        pagination: { total: 0, page, perPage: perPageInput, hasMore: false },
      };
    }
    const pipeline = this.client.pipeline();
    keys.forEach(key => pipeline.get(key));
    const results = await pipeline.exec();
    // Filter out nulls and by runId
    const filtered = results
      .map((raw: any) => {
        if (!raw) return null;
        if (typeof raw === 'string') {
          try {
            return JSON.parse(raw);
          } catch {
            return null;
          }
        }
        return raw as Record<string, any>;
      })
      .filter((row): row is Record<string, any> => !!row && typeof row === 'object' && row.runId === runId);
    const total = filtered.length;
    const perPage = normalizePerPage(perPageInput, 100); // false → MAX_SAFE_INTEGER
    const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
    const end = perPageInput === false ? filtered.length : start + perPage;
    const paged = filtered.slice(start, end);
    const scores = paged.map(row => transformScoreRow(row));
    return {
      scores,
      pagination: {
        total,
        page,
        perPage: perPageForResponse,
        hasMore: end < total,
      },
    };
  }

  async listScoresByEntityId({
    entityId,
    entityType,
    pagination = { page: 0, perPage: 20 },
  }: {
    entityId: string;
    entityType?: string;
    pagination?: StoragePagination;
  }): Promise<{
    scores: ScoreRowData[];
    pagination: PaginationInfo;
  }> {
    const pattern = `${TABLE_SCORERS}:*`;
    const keys = await this.#db.scanKeys(pattern);
    const { page, perPage: perPageInput } = pagination;
    if (keys.length === 0) {
      return {
        scores: [],
        pagination: { total: 0, page, perPage: perPageInput, hasMore: false },
      };
    }
    const pipeline = this.client.pipeline();
    keys.forEach(key => pipeline.get(key));
    const results = await pipeline.exec();

    const filtered = results
      .map((raw: any) => {
        if (!raw) return null;
        if (typeof raw === 'string') {
          try {
            return JSON.parse(raw);
          } catch {
            return null;
          }
        }
        return raw as Record<string, any>;
      })
      .filter((row): row is Record<string, any> => {
        if (!row || typeof row !== 'object') return false;
        if (row.entityId !== entityId) return false;
        if (entityType && row.entityType !== entityType) return false;
        return true;
      });
    const total = filtered.length;
    const perPage = normalizePerPage(perPageInput, 100); // false → MAX_SAFE_INTEGER
    const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
    const end = perPageInput === false ? filtered.length : start + perPage;
    const paged = filtered.slice(start, end);
    const scores = paged.map(row => transformScoreRow(row));
    return {
      scores,
      pagination: {
        total,
        page,
        perPage: perPageForResponse,
        hasMore: end < total,
      },
    };
  }

  async listScoresBySpan({
    traceId,
    spanId,
    pagination = { page: 0, perPage: 20 },
  }: {
    traceId: string;
    spanId: string;
    pagination?: StoragePagination;
  }): Promise<{
    scores: ScoreRowData[];
    pagination: PaginationInfo;
  }> {
    const pattern = `${TABLE_SCORERS}:*`;
    const keys = await this.#db.scanKeys(pattern);
    const { page, perPage: perPageInput } = pagination;
    if (keys.length === 0) {
      return {
        scores: [],
        pagination: { total: 0, page, perPage: perPageInput, hasMore: false },
      };
    }
    const pipeline = this.client.pipeline();
    keys.forEach(key => pipeline.get(key));
    const results = await pipeline.exec();
    // Filter out nulls and by traceId and spanId
    const filtered = results
      .map((raw: any) => {
        if (!raw) return null;
        if (typeof raw === 'string') {
          try {
            return JSON.parse(raw);
          } catch {
            return null;
          }
        }
        return raw as Record<string, any>;
      })
      .filter((row): row is Record<string, any> => {
        if (!row || typeof row !== 'object') return false;
        if (row.traceId !== traceId) return false;
        if (row.spanId !== spanId) return false;
        return true;
      });
    const total = filtered.length;
    const perPage = normalizePerPage(perPageInput, 100); // false → MAX_SAFE_INTEGER
    const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
    const end = perPageInput === false ? filtered.length : start + perPage;
    const paged = filtered.slice(start, end);
    const scores = paged.map(row => transformScoreRow(row));
    return {
      scores,
      pagination: {
        total,
        page,
        perPage: perPageForResponse,
        hasMore: end < total,
      },
    };
  }
}
