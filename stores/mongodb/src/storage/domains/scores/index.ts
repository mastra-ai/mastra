import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { ScoreRowData, ScoringEntityType, ScoringSource, ValidatedSaveScorePayload } from '@mastra/core/evals';
import { saveScorePayloadSchema } from '@mastra/core/evals';
import {
  ScoresStorage,
  TABLE_SCORERS,
  calculatePagination,
  normalizePerPage,
  safelyParseJSON,
} from '@mastra/core/storage';
import type { PaginationInfo, StoragePagination } from '@mastra/core/storage';
import type { StoreOperationsMongoDB } from '../operations';

function transformScoreRow(row: Record<string, any>): ScoreRowData {
  let scorerValue: any = null;
  if (row.scorer) {
    try {
      scorerValue = typeof row.scorer === 'string' ? safelyParseJSON(row.scorer) : row.scorer;
    } catch (e) {
      console.warn('Failed to parse scorer:', e);
    }
  }

  let preprocessStepResultValue: any = null;
  if (row.preprocessStepResult) {
    try {
      preprocessStepResultValue =
        typeof row.preprocessStepResult === 'string'
          ? safelyParseJSON(row.preprocessStepResult)
          : row.preprocessStepResult;
    } catch (e) {
      console.warn('Failed to parse preprocessStepResult:', e);
    }
  }

  let analyzeStepResultValue: any = null;
  if (row.analyzeStepResult) {
    try {
      analyzeStepResultValue =
        typeof row.analyzeStepResult === 'string' ? safelyParseJSON(row.analyzeStepResult) : row.analyzeStepResult;
    } catch (e) {
      console.warn('Failed to parse analyzeStepResult:', e);
    }
  }

  let inputValue: any = null;
  if (row.input) {
    try {
      inputValue = typeof row.input === 'string' ? safelyParseJSON(row.input) : row.input;
    } catch (e) {
      console.warn('Failed to parse input:', e);
    }
  }

  let outputValue: any = null;
  if (row.output) {
    try {
      outputValue = typeof row.output === 'string' ? safelyParseJSON(row.output) : row.output;
    } catch (e) {
      console.warn('Failed to parse output:', e);
    }
  }

  let entityValue: any = null;
  if (row.entity) {
    try {
      entityValue = typeof row.entity === 'string' ? safelyParseJSON(row.entity) : row.entity;
    } catch (e) {
      console.warn('Failed to parse entity:', e);
    }
  }

  let requestContextValue: any = null;
  if (row.requestContext) {
    try {
      requestContextValue =
        typeof row.requestContext === 'string' ? safelyParseJSON(row.requestContext) : row.requestContext;
    } catch (e) {
      console.warn('Failed to parse requestContext:', e);
    }
  }

  let metadataValue: any = null;
  if (row.metadata) {
    try {
      metadataValue = typeof row.metadata === 'string' ? safelyParseJSON(row.metadata) : row.metadata;
    } catch (e) {
      console.warn('Failed to parse metadata:', e);
    }
  }

  return {
    id: row.id as string,
    entityId: row.entityId as string,
    entityType: row.entityType as ScoringEntityType,
    scorerId: row.scorerId as string,
    traceId: row.traceId as string,
    spanId: row.spanId as string,
    runId: row.runId as string,
    scorer: scorerValue,
    preprocessStepResult: preprocessStepResultValue,
    preprocessPrompt: row.preprocessPrompt as string,
    analyzeStepResult: analyzeStepResultValue,
    generateScorePrompt: row.generateScorePrompt as string,
    score: row.score as number,
    analyzePrompt: row.analyzePrompt as string,
    reasonPrompt: row.reasonPrompt as string,
    metadata: metadataValue,
    input: inputValue,
    output: outputValue,
    additionalContext: row.additionalContext,
    requestContext: requestContextValue,
    entity: entityValue,
    source: row.source as ScoringSource,
    resourceId: row.resourceId as string,
    threadId: row.threadId as string,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
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

      const scoreData = {
        id: scoreId,
        entityId: validatedScore.entityId,
        entityType: validatedScore.entityType,
        scorerId: validatedScore.scorerId,
        traceId: validatedScore.traceId || '',
        spanId: validatedScore.spanId || '',
        runId: validatedScore.runId,
        scorer:
          typeof validatedScore.scorer === 'string' ? safelyParseJSON(validatedScore.scorer) : validatedScore.scorer,
        preprocessStepResult:
          typeof validatedScore.preprocessStepResult === 'string'
            ? safelyParseJSON(validatedScore.preprocessStepResult)
            : validatedScore.preprocessStepResult,
        analyzeStepResult:
          typeof validatedScore.analyzeStepResult === 'string'
            ? safelyParseJSON(validatedScore.analyzeStepResult)
            : validatedScore.analyzeStepResult,
        score: validatedScore.score,
        reason: validatedScore.reason,
        preprocessPrompt: validatedScore.preprocessPrompt,
        generateScorePrompt: validatedScore.generateScorePrompt,
        generateReasonPrompt: validatedScore.generateReasonPrompt,
        analyzePrompt: validatedScore.analyzePrompt,
        input: typeof validatedScore.input === 'string' ? safelyParseJSON(validatedScore.input) : validatedScore.input,
        output:
          typeof validatedScore.output === 'string' ? safelyParseJSON(validatedScore.output) : validatedScore.output,
        additionalContext: validatedScore.additionalContext,
        requestContext:
          typeof validatedScore.requestContext === 'string'
            ? safelyParseJSON(validatedScore.requestContext)
            : validatedScore.requestContext,
        entity:
          typeof validatedScore.entity === 'string' ? safelyParseJSON(validatedScore.entity) : validatedScore.entity,
        source: validatedScore.source,
        resourceId: validatedScore.resourceId || '',
        threadId: validatedScore.threadId || '',
        createdAt: now,
        updatedAt: now,
      };

      const collection = await this.operations.getCollection(TABLE_SCORERS);
      await collection.insertOne(scoreData);

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

  async listScoresByScorerId({
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
      const { page, perPage: perPageInput } = pagination;
      const perPage = normalizePerPage(perPageInput, 100);
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

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

      if (total === 0) {
        return {
          scores: [],
          pagination: {
            total: 0,
            page,
            perPage: perPageInput,
            hasMore: false,
          },
        };
      }

      const end = perPageInput === false ? total : start + perPage;

      // Build query - omit limit() when perPage is false to fetch all results
      let cursor = collection.find(query).sort({ createdAt: 'desc' }).skip(start);

      if (perPageInput !== false) {
        cursor = cursor.limit(perPage);
      }

      const documents = await cursor.toArray();
      const scores = documents.map(row => transformScoreRow(row));

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
          id: 'STORAGE_MONGODB_STORE_GET_SCORES_BY_SCORER_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { scorerId, page: pagination.page, perPage: pagination.perPage },
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
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
    try {
      const { page, perPage: perPageInput } = pagination;
      const perPage = normalizePerPage(perPageInput, 100);
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

      const collection = await this.operations.getCollection(TABLE_SCORERS);
      const total = await collection.countDocuments({ runId });

      if (total === 0) {
        return {
          scores: [],
          pagination: {
            total: 0,
            page,
            perPage: perPageInput,
            hasMore: false,
          },
        };
      }

      const end = perPageInput === false ? total : start + perPage;

      // Build query - omit limit() when perPage is false to fetch all results
      let cursor = collection.find({ runId }).sort({ createdAt: 'desc' }).skip(start);

      if (perPageInput !== false) {
        cursor = cursor.limit(perPage);
      }

      const documents = await cursor.toArray();
      const scores = documents.map(row => transformScoreRow(row));

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
          id: 'STORAGE_MONGODB_STORE_GET_SCORES_BY_RUN_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { runId, page: pagination.page, perPage: pagination.perPage },
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
      const perPage = normalizePerPage(perPageInput, 100);
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

      const collection = await this.operations.getCollection(TABLE_SCORERS);
      const total = await collection.countDocuments({ entityId, entityType });

      if (total === 0) {
        return {
          scores: [],
          pagination: {
            total: 0,
            page,
            perPage: perPageInput,
            hasMore: false,
          },
        };
      }

      const end = perPageInput === false ? total : start + perPage;

      // Build query - omit limit() when perPage is false to fetch all results
      let cursor = collection.find({ entityId, entityType }).sort({ createdAt: 'desc' }).skip(start);

      if (perPageInput !== false) {
        cursor = cursor.limit(perPage);
      }

      const documents = await cursor.toArray();
      const scores = documents.map(row => transformScoreRow(row));

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
          id: 'STORAGE_MONGODB_STORE_GET_SCORES_BY_ENTITY_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { entityId, entityType, page: pagination.page, perPage: pagination.perPage },
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

      const query = { traceId, spanId };
      const collection = await this.operations.getCollection(TABLE_SCORERS);
      const total = await collection.countDocuments(query);

      if (total === 0) {
        return {
          scores: [],
          pagination: {
            total: 0,
            page,
            perPage: perPageInput,
            hasMore: false,
          },
        };
      }

      const end = perPageInput === false ? total : start + perPage;

      // Build query - omit limit() when perPage is false to fetch all results
      let cursor = collection.find(query).sort({ createdAt: 'desc' }).skip(start);

      if (perPageInput !== false) {
        cursor = cursor.limit(perPage);
      }

      const documents = await cursor.toArray();
      const scores = documents.map(row => transformScoreRow(row));

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
