import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { SaveScorePayload, ScoreRowData, ScoringSource } from '@mastra/core/evals';
import { saveScorePayloadSchema } from '@mastra/core/evals';
import {
  calculatePagination,
  normalizePerPage,
  ScoresStorage,
  TABLE_SCORERS,
  transformScoreRow,
  createStorageErrorId,
} from '@mastra/core/storage';
import type { PaginationInfo, StoragePagination } from '@mastra/core/storage';

import { RedisDB } from '../../db';
import type { RedisDomainConfig } from '../../db';
import type { RedisClient } from '../../types';
import { processRecord } from '../utils';

export class ScoresRedis extends ScoresStorage {
  private client: RedisClient;
  private db: RedisDB;

  constructor(config: RedisDomainConfig) {
    super();
    this.client = config.client;
    this.db = new RedisDB({ client: config.client });
  }

  public async dangerouslyClearAll(): Promise<void> {
    await this.db.deleteData({ tableName: TABLE_SCORERS });
  }

  public async getScoreById({ id }: { id: string }): Promise<ScoreRowData | null> {
    try {
      const data = await this.db.get<ScoreRowData>({
        tableName: TABLE_SCORERS,
        keys: { id },
      });

      if (!data) {
        return null;
      }

      return transformScoreRow(data as Record<string, unknown>);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('REDIS', 'GET_SCORE_BY_ID', 'FAILED'),
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

  public async listScoresByScorerId({
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
    return this.fetchAndFilterScores(pagination, row => {
      if (row.scorerId !== scorerId) {
        return false;
      }
      if (entityId && row.entityId !== entityId) {
        return false;
      }
      if (entityType && row.entityType !== entityType) {
        return false;
      }
      if (source && row.source !== source) {
        return false;
      }
      return true;
    });
  }

  public async saveScore(score: SaveScorePayload): Promise<{ score: ScoreRowData }> {
    let validatedScore: SaveScorePayload;
    try {
      validatedScore = saveScorePayloadSchema.parse(score);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('REDIS', 'SAVE_SCORE', 'VALIDATION_FAILED'),
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

    const now = new Date();
    const id = crypto.randomUUID();

    const scoreWithId = {
      ...validatedScore,
      id,
      createdAt: now,
      updatedAt: now,
    };

    const { key, processedRecord } = processRecord(TABLE_SCORERS, scoreWithId);
    try {
      await this.client.set(key, JSON.stringify(processedRecord));
      return { score: { ...validatedScore, id, createdAt: now, updatedAt: now } as ScoreRowData };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('REDIS', 'SAVE_SCORE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id },
        },
        error,
      );
    }
  }

  public async listScoresByRunId({
    runId,
    pagination = { page: 0, perPage: 20 },
  }: {
    runId: string;
    pagination?: StoragePagination;
  }): Promise<{
    scores: ScoreRowData[];
    pagination: PaginationInfo;
  }> {
    return this.fetchAndFilterScores(pagination, row => row.runId === runId);
  }

  public async listScoresByEntityId({
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
    return this.fetchAndFilterScores(pagination, row => {
      if (row.entityId !== entityId) {
        return false;
      }
      if (entityType && row.entityType !== entityType) {
        return false;
      }
      return true;
    });
  }

  public async listScoresBySpan({
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
    return this.fetchAndFilterScores(pagination, row => row.traceId === traceId && row.spanId === spanId);
  }

  private async fetchAndFilterScores(
    pagination: StoragePagination,
    filterFn: (row: Record<string, unknown>) => boolean,
  ): Promise<{ scores: ScoreRowData[]; pagination: PaginationInfo }> {
    const { page, perPage: perPageInput } = pagination;
    const keys = await this.db.scanKeys(`${TABLE_SCORERS}:*`);

    if (keys.length === 0) {
      return {
        scores: [],
        pagination: { total: 0, page, perPage: perPageInput, hasMore: false },
      };
    }

    const results = await this.client.mGet(keys);

    const filtered = results
      .map((data): Record<string, unknown> | null => {
        if (!data) {
          return null;
        }
        try {
          return JSON.parse(data) as Record<string, unknown>;
        } catch {
          return null;
        }
      })
      .filter((row): row is Record<string, unknown> => !!row && typeof row === 'object' && filterFn(row));

    const total = filtered.length;
    const perPage = normalizePerPage(perPageInput, 100);
    const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
    const end = perPageInput === false ? total : start + perPage;
    const scores = filtered.slice(start, end).map(row => transformScoreRow(row));

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
