import { ErrorDomain, ErrorCategory, MastraError } from '@mastra/core/error';
import type { ScoreRowData, ScoringSource } from '@mastra/core/scores';
import { ScoresStorage, TABLE_SCORERS, safelyParseJSON } from '@mastra/core/storage';
import type { StoragePagination, PaginationInfo } from '@mastra/core/storage';
import type { StoreOperationsCloudflare } from '../operations';

function transformScoreRow(row: Record<string, any>): ScoreRowData {
  const deserialized: Record<string, any> = { ...row };

  deserialized.input = safelyParseJSON(row.input);
  deserialized.output = safelyParseJSON(row.output);
  deserialized.scorer = safelyParseJSON(row.scorer);
  deserialized.preprocessStepResult = safelyParseJSON(row.preprocessStepResult);
  deserialized.analyzeStepResult = safelyParseJSON(row.analyzeStepResult);
  deserialized.metadata = safelyParseJSON(row.metadata);
  deserialized.additionalContext = safelyParseJSON(row.additionalContext);
  deserialized.runtimeContext = safelyParseJSON(row.runtimeContext);
  deserialized.entity = safelyParseJSON(row.entity);

  return deserialized as ScoreRowData;
}

export class ScoresStorageCloudflare extends ScoresStorage {
  private operations: StoreOperationsCloudflare;

  constructor({ operations }: { operations: StoreOperationsCloudflare }) {
    super();
    this.operations = operations;
  }

  async getScoreById({ id }: { id: string }): Promise<ScoreRowData | null> {
    try {
      const score = await this.operations.getKV(TABLE_SCORERS, id);
      if (!score) {
        return null;
      }
      return transformScoreRow(score);
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'CLOUDFLARE_STORAGE_SCORES_GET_SCORE_BY_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: `Failed to get score by id: ${id}`,
        },
        error,
      );
      this.logger.trackException(mastraError);
      this.logger.error(mastraError.toString());
      return null;
    }
  }

  async saveScore(score: Omit<ScoreRowData, 'createdAt' | 'updatedAt'>): Promise<{ score: ScoreRowData }> {
    try {
      const id = crypto.randomUUID();
      const { input, ...rest } = score;

      // Serialize all object values to JSON strings
      const serializedRecord: Record<string, any> = {};
      for (const [key, value] of Object.entries(rest)) {
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

      await this.operations.putKV({
        tableName: TABLE_SCORERS,
        key: id,
        value: serializedRecord,
      });

      const scoreFromDb = await this.getScoreById({ id: score.id });
      return { score: scoreFromDb! };
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'CLOUDFLARE_STORAGE_SCORES_SAVE_SCORE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: `Failed to save score: ${score.id}`,
        },
        error,
      );
      this.logger.trackException(mastraError);
      this.logger.error(mastraError.toString());
      throw mastraError;
    }
  }

  async getScoresByScorerId({
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
      const keys = await this.operations.listKV(TABLE_SCORERS);
      const scores: ScoreRowData[] = [];

      for (const { name: key } of keys) {
        const score = await this.operations.getKV(TABLE_SCORERS, key);

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

      const total = scores.length;
      const start = pagination.page * pagination.perPage;
      const end = start + pagination.perPage;
      const pagedScores = scores.slice(start, end);

      return {
        pagination: {
          total,
          page: pagination.page,
          perPage: pagination.perPage,
          hasMore: end < total,
        },
        scores: pagedScores,
      };
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'CLOUDFLARE_STORAGE_SCORES_GET_SCORES_BY_SCORER_ID_FAILED',
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

  async getScoresByRunId({
    runId,
    pagination,
  }: {
    runId: string;
    pagination: StoragePagination;
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
    try {
      const keys = await this.operations.listKV(TABLE_SCORERS);
      const scores: ScoreRowData[] = [];

      for (const { name: key } of keys) {
        const score = await this.operations.getKV(TABLE_SCORERS, key);
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

      const total = scores.length;
      const start = pagination.page * pagination.perPage;
      const end = start + pagination.perPage;
      const pagedScores = scores.slice(start, end);

      return {
        pagination: {
          total,
          page: pagination.page,
          perPage: pagination.perPage,
          hasMore: end < total,
        },
        scores: pagedScores,
      };
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'CLOUDFLARE_STORAGE_SCORES_GET_SCORES_BY_RUN_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: `Failed to get scores by run id: ${runId}`,
        },
        error,
      );
      this.logger.trackException(mastraError);
      this.logger.error(mastraError.toString());
      return { pagination: { total: 0, page: 0, perPage: 100, hasMore: false }, scores: [] };
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
      const keys = await this.operations.listKV(TABLE_SCORERS);
      const scores: ScoreRowData[] = [];

      for (const { name: key } of keys) {
        const score = await this.operations.getKV(TABLE_SCORERS, key);
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

      const total = scores.length;
      const start = pagination.page * pagination.perPage;
      const end = start + pagination.perPage;
      const pagedScores = scores.slice(start, end);

      return {
        pagination: {
          total,
          page: pagination.page,
          perPage: pagination.perPage,
          hasMore: end < total,
        },
        scores: pagedScores,
      };
    } catch (error) {
      const mastraError = new MastraError(
        {
          id: 'CLOUDFLARE_STORAGE_SCORES_GET_SCORES_BY_ENTITY_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          text: `Failed to get scores by entity id: ${entityId}, type: ${entityType}`,
        },
        error,
      );
      this.logger.trackException(mastraError);
      this.logger.error(mastraError.toString());
      return { pagination: { total: 0, page: 0, perPage: 100, hasMore: false }, scores: [] };
    }
  }
}
