import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { ScoreRowData, ScoringSource } from '@mastra/core/scores';
import { ScoresStorage, TABLE_SCORERS } from '@mastra/core/storage';
import type { Redis } from '@upstash/redis';
import type { StoreOperationsUpstash } from '../operations';
import { processRecord } from '../utils';

function transformScoreRow(row: Record<string, any>): ScoreRowData {
  const parseField = (v: any) => {
    if (typeof v === 'string') {
      try {
        return JSON.parse(v);
      } catch {
        return v;
      }
    }
    return v;
  };
  return {
    ...row,
    scorer: parseField(row.scorer),
    preprocessStepResult: parseField(row.preprocessStepResult),
    generateScorePrompt: row.generateScorePrompt,
    generateReasonPrompt: row.generateReasonPrompt,
    analyzeStepResult: parseField(row.analyzeStepResult),
    metadata: parseField(row.metadata),
    input: parseField(row.input),
    output: parseField(row.output),
    additionalContext: parseField(row.additionalContext),
    runtimeContext: parseField(row.runtimeContext),
    entity: parseField(row.entity),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  } as ScoreRowData;
}

export class ScoresUpstash extends ScoresStorage {
  private client: Redis;
  private operations: StoreOperationsUpstash;

  constructor({ client, operations }: { client: Redis; operations: StoreOperationsUpstash }) {
    super();
    this.client = client;
    this.operations = operations;
  }

  async getScoreById({ id }: { id: string }): Promise<ScoreRowData | null> {
    try {
      const data = await this.operations.load<ScoreRowData>({
        tableName: TABLE_SCORERS,
        keys: { id },
      });
      if (!data) return null;
      return transformScoreRow(data);
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_UPSTASH_STORAGE_GET_SCORE_BY_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id },
        },
        error,
      );
    }
  }

  async getScoresByScorerId({
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
    pagination?: { page: number; perPage: number };
  }): Promise<{
    scores: ScoreRowData[];
    pagination: { total: number; page: number; perPage: number; hasMore: boolean };
  }> {
    const pattern = `${TABLE_SCORERS}:*`;
    const keys = await this.operations.scanKeys(pattern);
    if (keys.length === 0) {
      return {
        scores: [],
        pagination: { total: 0, page: pagination.page, perPage: pagination.perPage, hasMore: false },
      };
    }
    const pipeline = this.client.pipeline();
    keys.forEach(key => pipeline.get(key));
    const results = await pipeline.exec();
    // Filter out nulls and by scorerId
    const filtered = results
      .map((row: any) => row as Record<string, any> | null)
      .filter((row): row is Record<string, any> => {
        if (!row || typeof row !== 'object') return false;
        if (row.scorerId !== scorerId) return false;
        if (entityId && row.entityId !== entityId) return false;
        if (entityType && row.entityType !== entityType) return false;
        if (source && row.source !== source) return false;
        return true;
      });
    const total = filtered.length;
    const { page, perPage } = pagination;
    const start = page * perPage;
    const end = start + perPage;
    const paged = filtered.slice(start, end);
    const scores = paged.map(row => transformScoreRow(row));
    return {
      scores,
      pagination: {
        total,
        page,
        perPage,
        hasMore: end < total,
      },
    };
  }

  async saveScore(score: ScoreRowData): Promise<{ score: ScoreRowData }> {
    const { key, processedRecord } = processRecord(TABLE_SCORERS, score);
    try {
      await this.client.set(key, processedRecord);
      return { score };
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_UPSTASH_STORAGE_SAVE_SCORE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id: score.id },
        },
        error,
      );
    }
  }

  async getScoresByRunId({
    runId,
    pagination = { page: 0, perPage: 20 },
  }: {
    runId: string;
    pagination?: { page: number; perPage: number };
  }): Promise<{
    scores: ScoreRowData[];
    pagination: { total: number; page: number; perPage: number; hasMore: boolean };
  }> {
    const pattern = `${TABLE_SCORERS}:*`;
    const keys = await this.operations.scanKeys(pattern);
    if (keys.length === 0) {
      return {
        scores: [],
        pagination: { total: 0, page: pagination.page, perPage: pagination.perPage, hasMore: false },
      };
    }
    const pipeline = this.client.pipeline();
    keys.forEach(key => pipeline.get(key));
    const results = await pipeline.exec();
    // Filter out nulls and by runId
    const filtered = results
      .map((row: any) => row as Record<string, any> | null)
      .filter((row): row is Record<string, any> => !!row && typeof row === 'object' && row.runId === runId);
    const total = filtered.length;
    const { page, perPage } = pagination;
    const start = page * perPage;
    const end = start + perPage;
    const paged = filtered.slice(start, end);
    const scores = paged.map(row => transformScoreRow(row));
    return {
      scores,
      pagination: {
        total,
        page,
        perPage,
        hasMore: end < total,
      },
    };
  }

  async getScoresByEntityId({
    entityId,
    entityType,
    pagination = { page: 0, perPage: 20 },
  }: {
    entityId: string;
    entityType?: string;
    pagination?: { page: number; perPage: number };
  }): Promise<{
    scores: ScoreRowData[];
    pagination: { total: number; page: number; perPage: number; hasMore: boolean };
  }> {
    const pattern = `${TABLE_SCORERS}:*`;
    const keys = await this.operations.scanKeys(pattern);
    if (keys.length === 0) {
      return {
        scores: [],
        pagination: { total: 0, page: pagination.page, perPage: pagination.perPage, hasMore: false },
      };
    }
    const pipeline = this.client.pipeline();
    keys.forEach(key => pipeline.get(key));
    const results = await pipeline.exec();

    const filtered = results
      .map((row: any) => row as Record<string, any> | null)
      .filter((row): row is Record<string, any> => {
        if (!row || typeof row !== 'object') return false;
        if (row.entityId !== entityId) return false;
        if (entityType && row.entityType !== entityType) return false;
        return true;
      });
    const total = filtered.length;
    const { page, perPage } = pagination;
    const start = page * perPage;
    const end = start + perPage;
    const paged = filtered.slice(start, end);
    const scores = paged.map(row => transformScoreRow(row));
    return {
      scores,
      pagination: {
        total,
        page,
        perPage,
        hasMore: end < total,
      },
    };
  }
}
