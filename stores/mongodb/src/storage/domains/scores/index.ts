import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { ScoreRowData, ScoringSource, ValidatedSaveScorePayload } from '@mastra/core/scores';
import { saveScorePayloadSchema } from '@mastra/core/scores';
import { ScoresStorage, TABLE_SCORERS, safelyParseJSON } from '@mastra/core/storage';
import type { PaginationInfo, StoragePagination } from '@mastra/core/storage';
import type { StoreOperationsMongoDB } from '../operations';
import { transformRow } from '../utils';

function transformScoreRow(row: Record<string, any>): ScoreRowData {
  const transformedRow = transformRow({ row, tableName: TABLE_SCORERS });
  return transformedRow as ScoreRowData;
}

export class ScoresStorageMongoDB extends ScoresStorage {
  private operations: StoreOperationsMongoDB;

  constructor({ operations }: { operations: StoreOperationsMongoDB }) {
    super();
    this.operations = operations;
  }

  async getScoreById({ id }: { id: string }): Promise<ScoreRowData | null> {
    try {
      const collection = await this.operations.getCollection(TABLE_SCORERS);
      const document = await collection.findOne({ id });

      if (!document) {
        return null;
      }

      return transformScoreRow(document);
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_MONGODB_STORE_GET_SCORE_BY_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id },
        },
        error,
      );
    }
  }

  async saveScore(score: Omit<ScoreRowData, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ score: ScoreRowData }> {
    let validatedScore: ValidatedSaveScorePayload;
    try {
      validatedScore = saveScorePayloadSchema.parse(score);
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_MONGODB_STORE_SAVE_SCORE_VALIDATION_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
    try {
      const now = new Date();
      const scoreId = `score-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const scorer =
        typeof validatedScore.scorer === 'string' ? safelyParseJSON(validatedScore.scorer) : validatedScore.scorer;
      const preprocessStepResult =
        typeof validatedScore.preprocessStepResult === 'string'
          ? safelyParseJSON(validatedScore.preprocessStepResult)
          : validatedScore.preprocessStepResult;
      const analyzeStepResult =
        typeof validatedScore.analyzeStepResult === 'string'
          ? safelyParseJSON(validatedScore.analyzeStepResult)
          : validatedScore.analyzeStepResult;
      const input =
        typeof validatedScore.input === 'string' ? safelyParseJSON(validatedScore.input) : validatedScore.input;
      const output =
        typeof validatedScore.output === 'string' ? safelyParseJSON(validatedScore.output) : validatedScore.output;
      const runtimeContext =
        typeof validatedScore.runtimeContext === 'string'
          ? safelyParseJSON(validatedScore.runtimeContext)
          : validatedScore.runtimeContext;
      const entity =
        typeof validatedScore.entity === 'string' ? safelyParseJSON(validatedScore.entity) : validatedScore.entity;
      const createdAt = now;
      const updatedAt = now;

      const dataToSave = {
        ...validatedScore,
        scorer,
        preprocessStepResult,
        analyzeStepResult,
        input,
        output,
        runtimeContext,
        entity,
        createdAt,
        updatedAt,
      };

      const collection = await this.operations.getCollection(TABLE_SCORERS);
      await collection.insertOne(dataToSave);

      const savedScore: ScoreRowData = {
        ...score,
        id: scoreId,
        createdAt: now,
        updatedAt: now,
      };

      return { score: savedScore };
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_MONGODB_STORE_SAVE_SCORE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { scorerId: score.scorerId, runId: score.runId },
        },
        error,
      );
    }
  }

  async getScoresByScorerId({
    scorerId,
    pagination,
    entityId,
    entityType,
    source,
  }: {
    scorerId: string;
    pagination: StoragePagination;
    entityId?: string;
    entityType?: string;
    source?: ScoringSource;
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
    try {
      const query: any = { scorerId };

      if (entityId) {
        query.entityId = entityId;
      }

      if (entityType) {
        query.entityType = entityType;
      }

      if (source) {
        query.source = source;
      }

      const collection = await this.operations.getCollection(TABLE_SCORERS);
      const total = await collection.countDocuments(query);
      const currentOffset = pagination.page * pagination.perPage;

      if (total === 0) {
        return {
          scores: [],
          pagination: {
            total: 0,
            page: pagination.page,
            perPage: pagination.perPage,
            hasMore: false,
          },
        };
      }

      const documents = await collection
        .find(query)
        .sort({ createdAt: 'desc' })
        .skip(currentOffset)
        .limit(pagination.perPage)
        .toArray();

      const scores = documents.map(row => transformScoreRow(row));
      const hasMore = currentOffset + scores.length < total;

      return {
        scores,
        pagination: {
          total,
          page: pagination.page,
          perPage: pagination.perPage,
          hasMore,
        },
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_MONGODB_STORE_GET_SCORES_BY_SCORER_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { scorerId, page: pagination.page, perPage: pagination.perPage },
        },
        error,
      );
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
      const collection = await this.operations.getCollection(TABLE_SCORERS);
      const total = await collection.countDocuments({ runId });
      const currentOffset = pagination.page * pagination.perPage;

      if (total === 0) {
        return {
          scores: [],
          pagination: {
            total: 0,
            page: pagination.page,
            perPage: pagination.perPage,
            hasMore: false,
          },
        };
      }

      const documents = await collection
        .find({ runId })
        .sort({ createdAt: 'desc' })
        .skip(currentOffset)
        .limit(pagination.perPage)
        .toArray();

      const scores = documents.map(row => transformScoreRow(row));
      const hasMore = currentOffset + scores.length < total;

      return {
        scores,
        pagination: {
          total,
          page: pagination.page,
          perPage: pagination.perPage,
          hasMore,
        },
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_MONGODB_STORE_GET_SCORES_BY_RUN_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { runId, page: pagination.page, perPage: pagination.perPage },
        },
        error,
      );
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
      const collection = await this.operations.getCollection(TABLE_SCORERS);
      const total = await collection.countDocuments({ entityId, entityType });
      const currentOffset = pagination.page * pagination.perPage;

      if (total === 0) {
        return {
          scores: [],
          pagination: {
            total: 0,
            page: pagination.page,
            perPage: pagination.perPage,
            hasMore: false,
          },
        };
      }

      const documents = await collection
        .find({ entityId, entityType })
        .sort({ createdAt: 'desc' })
        .skip(currentOffset)
        .limit(pagination.perPage)
        .toArray();

      const scores = documents.map(row => transformScoreRow(row));
      const hasMore = currentOffset + scores.length < total;

      return {
        scores,
        pagination: {
          total,
          page: pagination.page,
          perPage: pagination.perPage,
          hasMore,
        },
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_MONGODB_STORE_GET_SCORES_BY_ENTITY_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { entityId, entityType, page: pagination.page, perPage: pagination.perPage },
        },
        error,
      );
    }
  }

  async getScoresBySpan({
    traceId,
    spanId,
    pagination,
  }: {
    traceId: string;
    spanId: string;
    pagination: StoragePagination;
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
    try {
      const query = { traceId, spanId };
      const collection = await this.operations.getCollection(TABLE_SCORERS);
      const total = await collection.countDocuments(query);
      const currentOffset = pagination.page * pagination.perPage;

      if (total === 0) {
        return {
          scores: [],
          pagination: {
            total: 0,
            page: pagination.page,
            perPage: pagination.perPage,
            hasMore: false,
          },
        };
      }

      const documents = await collection
        .find(query)
        .sort({ createdAt: 'desc' })
        .skip(currentOffset)
        .limit(pagination.perPage)
        .toArray();

      const scores = documents.map(row => transformScoreRow(row));
      const hasMore = currentOffset + scores.length < total;

      return {
        scores,
        pagination: {
          total,
          page: pagination.page,
          perPage: pagination.perPage,
          hasMore,
        },
      };
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_MONGODB_STORE_GET_SCORES_BY_SPAN_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { traceId, spanId, page: pagination.page, perPage: pagination.perPage },
        },
        error,
      );
    }
  }
}
