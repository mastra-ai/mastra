import { ErrorDomain, ErrorCategory, MastraError } from '@mastra/core/error';
import { saveScorePayloadSchema } from '@mastra/core/evals';
import type { ListScoresResponse, SaveScorePayload, ScoreRowData, ScoringSource } from '@mastra/core/evals';
import {
  createStorageErrorId,
  ScoresStorage,
  TABLE_SCORERS,
  calculatePagination,
  normalizePerPage,
  transformScoreRow as coreTransformScoreRow,
} from '@mastra/core/storage';
import type { StoragePagination } from '@mastra/core/storage';
import { CloudflareKVDB, resolveCloudflareConfig } from '../../db';
import type { CloudflareDomainConfig } from '../../types';

/**
 * Cloudflare KV-specific score row transformation.
 * Uses default options (no timestamp conversion).
 */
function transformScoreRow(row: Record<string, any>): ScoreRowData {
  return coreTransformScoreRow(row);
}

export class ScoresStorageCloudflare extends ScoresStorage {
  #db: CloudflareKVDB;

  constructor(config: CloudflareDomainConfig) {
    super();
    this.#db = new CloudflareKVDB(resolveCloudflareConfig(config));
  }

  async init(): Promise<void> {
    // Cloudflare KV is schemaless, no table creation needed
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.clearTable({ tableName: TABLE_SCORERS });
  }

  async getScoreById({ id }: { id: string }): Promise<ScoreRowData | null> {
    try {
      const score = await this.#db.getKV(TABLE_SCORERS, id);
      if (!score) {
        return null;
      }
      return transformScoreRow(score);
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE', 'GET_SCORE_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: `Failed to get score by id: ${id}`,
        },
        error,
      );
      this.logger?.trackException(mastraError);
      this.logger?.error(mastraError.toString());
      return null;
    }
  }

  async saveScore(score: SaveScorePayload): Promise<{ score: ScoreRowData }> {
    let parsedScore: SaveScorePayload;
    try {
      parsedScore = saveScorePayloadSchema.parse(score);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE', 'SAVE_SCORE', 'VALIDATION_FAILED'),
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

      await this.#db.putKV({
        tableName: TABLE_SCORERS,
        key: id,
        value: serializedRecord,
      });

      return { score: { ...parsedScore, id, createdAt: now, updatedAt: now } as ScoreRowData };
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE', 'SAVE_SCORE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id },
        },
        error,
      );
      this.logger?.trackException(mastraError);
      this.logger?.error(mastraError.toString());
      throw mastraError;
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
      const keys = await this.#db.listKV(TABLE_SCORERS);
      const scores: ScoreRowData[] = [];

      for (const { name: key } of keys) {
        const score = await this.#db.getKV(TABLE_SCORERS, key);

        if (entityId && score.entityId !== entityId) {
          continue;
        }
        if (entityType && score.entityType !== entityType) {
          continue;
        }
        if (source && score.source !== source) {
          continue;
        }

        if (score && score.scorerId === scorerId) {
          scores.push(transformScoreRow(score));
        }
      }

      // Sort by createdAt desc
      scores.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA;
      });

      const { page, perPage: perPageInput } = pagination;
      const perPage = normalizePerPage(perPageInput, 100);
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

      const total = scores.length;
      const end = perPageInput === false ? scores.length : start + perPage;
      const pagedScores = scores.slice(start, end);

      return {
        pagination: {
          total,
          page,
          perPage: perPageForResponse,
          hasMore: end < total,
        },
        scores: pagedScores,
      };
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE', 'GET_SCORES_BY_SCORER_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: `Failed to get scores by scorer id: ${scorerId}`,
        },
        error,
      );
      this.logger?.trackException(mastraError);
      this.logger?.error(mastraError.toString());
      return { pagination: { total: 0, page: 0, perPage: 100, hasMore: false }, scores: [] };
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
      const keys = await this.#db.listKV(TABLE_SCORERS);
      const scores: ScoreRowData[] = [];

      for (const { name: key } of keys) {
        const score = await this.#db.getKV(TABLE_SCORERS, key);
        if (score && score.runId === runId) {
          scores.push(transformScoreRow(score));
        }
      }

      // Sort by createdAt desc
      scores.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA;
      });

      const { page, perPage: perPageInput } = pagination;
      const perPage = normalizePerPage(perPageInput, 100);
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

      const total = scores.length;
      const end = perPageInput === false ? scores.length : start + perPage;
      const pagedScores = scores.slice(start, end);

      return {
        pagination: {
          total,
          page,
          perPage: perPageForResponse,
          hasMore: end < total,
        },
        scores: pagedScores,
      };
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE', 'GET_SCORES_BY_RUN_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: `Failed to get scores by run id: ${runId}`,
        },
        error,
      );
      this.logger?.trackException(mastraError);
      this.logger?.error(mastraError.toString());
      return { pagination: { total: 0, page: 0, perPage: 100, hasMore: false }, scores: [] };
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
      const keys = await this.#db.listKV(TABLE_SCORERS);
      const scores: ScoreRowData[] = [];

      for (const { name: key } of keys) {
        const score = await this.#db.getKV(TABLE_SCORERS, key);
        if (score && score.entityId === entityId && score.entityType === entityType) {
          scores.push(transformScoreRow(score));
        }
      }

      // Sort by createdAt desc
      scores.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA;
      });

      const { page, perPage: perPageInput } = pagination;
      const perPage = normalizePerPage(perPageInput, 100);
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

      const total = scores.length;
      const end = perPageInput === false ? scores.length : start + perPage;
      const pagedScores = scores.slice(start, end);

      return {
        pagination: {
          total,
          page,
          perPage: perPageForResponse,
          hasMore: end < total,
        },
        scores: pagedScores,
      };
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE', 'GET_SCORES_BY_ENTITY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: `Failed to get scores by entity id: ${entityId}, type: ${entityType}`,
        },
        error,
      );
      this.logger?.trackException(mastraError);
      this.logger?.error(mastraError.toString());
      return { pagination: { total: 0, page: 0, perPage: 100, hasMore: false }, scores: [] };
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
      const keys = await this.#db.listKV(TABLE_SCORERS);
      const scores: ScoreRowData[] = [];

      for (const { name: key } of keys) {
        const score = await this.#db.getKV(TABLE_SCORERS, key);
        if (score && score.traceId === traceId && score.spanId === spanId) {
          scores.push(transformScoreRow(score));
        }
      }

      // Sort by createdAt desc
      scores.sort((a, b) => {
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA;
      });

      const { page, perPage: perPageInput } = pagination;
      const perPage = normalizePerPage(perPageInput, 100);
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

      const total = scores.length;
      const end = perPageInput === false ? scores.length : start + perPage;
      const pagedScores = scores.slice(start, end);

      return {
        pagination: {
          total,
          page,
          perPage: perPageForResponse,
          hasMore: end < total,
        },
        scores: pagedScores,
      };
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: createStorageErrorId('CLOUDFLARE', 'GET_SCORES_BY_SPAN', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: `Failed to get scores by span: traceId=${traceId}, spanId=${spanId}`,
        },
        error,
      );
      this.logger?.trackException(mastraError);
      this.logger?.error(mastraError.toString());
      return { pagination: { total: 0, page: 0, perPage: 100, hasMore: false }, scores: [] };
    }
  }
}
