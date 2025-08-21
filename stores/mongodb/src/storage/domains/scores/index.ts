import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { ScoreRowData, ScoringEntityType, ScoringSource } from '@mastra/core/scores';
import { ScoresStorage, TABLE_SCORERS, safelyParseJSON } from '@mastra/core/storage';
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

  let runtimeContextValue: any = null;
  if (row.runtimeContext) {
    try {
      runtimeContextValue =
        typeof row.runtimeContext === 'string' ? safelyParseJSON(row.runtimeContext) : row.runtimeContext;
    } catch (e) {
      console.warn('Failed to parse runtimeContext:', e);
    }
  }

  return {
    id: row.id as string,
    entityId: row.entityId as string,
    entityType: row.entityType as ScoringEntityType,
    scorerId: row.scorerId as string,
    traceId: row.traceId as string,
    runId: row.runId as string,
    scorer: scorerValue,
    preprocessStepResult: preprocessStepResultValue,
    analyzeStepResult: analyzeStepResultValue,
    score: row.score as number,
    reason: row.reason as string,
    extractPrompt: row.extractPrompt as string,
    analyzePrompt: row.analyzePrompt as string,
    reasonPrompt: row.reasonPrompt as string,
    input: inputValue,
    output: outputValue,
    additionalContext: row.additionalContext,
    runtimeContext: runtimeContextValue,
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
    try {
      const now = new Date();
      const scoreId = `score-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const scoreData = {
        id: scoreId,
        entityId: score.entityId,
        entityType: score.entityType,
        scorerId: score.scorerId,
        traceId: score.traceId || '',
        runId: score.runId,
        scorer: typeof score.scorer === 'string' ? safelyParseJSON(score.scorer) : score.scorer,
        preprocessStepResult:
          typeof score.preprocessStepResult === 'string'
            ? safelyParseJSON(score.preprocessStepResult)
            : score.preprocessStepResult,
        analyzeStepResult:
          typeof score.analyzeStepResult === 'string'
            ? safelyParseJSON(score.analyzeStepResult)
            : score.analyzeStepResult,
        score: score.score,
        reason: score.reason,
        preprocessPrompt: score.preprocessPrompt,
        generateScorePrompt: score.generateScorePrompt,
        generateReasonPrompt: score.generateReasonPrompt,
        analyzePrompt: score.analyzePrompt,
        reasonPrompt: score.reasonPrompt,
        input: typeof score.input === 'string' ? safelyParseJSON(score.input) : score.input,
        output: typeof score.output === 'string' ? safelyParseJSON(score.output) : score.output,
        additionalContext: score.additionalContext,
        runtimeContext:
          typeof score.runtimeContext === 'string' ? safelyParseJSON(score.runtimeContext) : score.runtimeContext,
        entity: typeof score.entity === 'string' ? safelyParseJSON(score.entity) : score.entity,
        source: score.source,
        resourceId: score.resourceId || '',
        threadId: score.threadId || '',
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
}
