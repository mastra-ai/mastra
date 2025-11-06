import { ErrorDomain, ErrorCategory, MastraError } from '@mastra/core/error';
import { saveScorePayloadSchema } from '@mastra/core/evals';
import type { ScoreRowData, ScoringSource, ValidatedSaveScorePayload } from '@mastra/core/evals';
import {
  ScoresStorage,
  TABLE_SCORERS,
  calculatePagination,
  normalizePerPage,
  safelyParseJSON,
} from '@mastra/core/storage';
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
  deserialized.requestContext = safelyParseJSON(row.requestContext);
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
    let parsedScore: ValidatedSaveScorePayload;
    try {
      parsedScore = saveScorePayloadSchema.parse(score);
    } catch (error) {
      throw new MastraError(
        {
          id: 'CLOUDFLARE_STORAGE_SAVE_SCORE_FAILED_INVALID_SCORE_PAYLOAD',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { scoreId: score.id },
        },
        error,
      );
    }

    try {
      const id = crypto.randomUUID();

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

  async listScoresByRunId({
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
      const keys = await this.operations.listKV(TABLE_SCORERS);
      const scores: ScoreRowData[] = [];

      for (const { name: key } of keys) {
        const score = await this.operations.getKV(TABLE_SCORERS, key);
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
          id: 'CLOUDFLARE_STORAGE_SCORES_GET_SCORES_BY_SPAN_FAILED',
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
