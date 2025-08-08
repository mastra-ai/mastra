import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { ScoreRowData, ScoringSource } from '@mastra/core/scores';
import { ScoresStorage } from '@mastra/core/storage';
import type { PaginationInfo, StoragePagination } from '@mastra/core/storage';
import type { Service } from 'electrodb';

export class ScoresStorageDynamoDB extends ScoresStorage {
  private service: Service<Record<string, any>>;
  constructor({ service }: { service: Service<Record<string, any>> }) {
    super();
    this.service = service;
  }

  // Helper function to parse score data (handle JSON fields)
  private parseScoreData(data: any): ScoreRowData {
    return {
      ...data,
      // Convert date strings back to Date objects for consistency
      createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
      updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
      // JSON fields are already transformed by the entity's getters
    } as ScoreRowData;
  }

  async getScoreById({ id }: { id: string }): Promise<ScoreRowData | null> {
    this.logger.debug('Getting score by ID', { id });
    try {
      const result = await this.service.entities.score.get({ entity: 'score', id }).go();

      if (!result.data) {
        return null;
      }

      return this.parseScoreData(result.data);
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_DYNAMODB_STORE_GET_SCORE_BY_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id },
        },
        error,
      );
    }
  }

  async saveScore(score: Omit<ScoreRowData, 'id' | 'createdAt' | 'updatedAt'>): Promise<{ score: ScoreRowData }> {
    this.logger.debug('Saving score', { scorerId: score.scorerId, runId: score.runId });

    const now = new Date();
    const scoreId = `score-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const scoreData = {
      entity: 'score',
      id: scoreId,
      scorerId: score.scorerId,
      traceId: score.traceId || '',
      runId: score.runId,
      scorer: typeof score.scorer === 'string' ? score.scorer : JSON.stringify(score.scorer),
      preprocessStepResult:
        typeof score.preprocessStepResult === 'string'
          ? score.preprocessStepResult
          : JSON.stringify(score.preprocessStepResult),
      analyzeStepResult:
        typeof score.analyzeStepResult === 'string' ? score.analyzeStepResult : JSON.stringify(score.analyzeStepResult),
      score: score.score,
      reason: score.reason,
      preprocessPrompt: score.preprocessPrompt,
      generateScorePrompt: score.generateScorePrompt,
      analyzePrompt: score.analyzePrompt,
      reasonPrompt: score.reasonPrompt,
      input: typeof score.input === 'string' ? score.input : JSON.stringify(score.input),
      output: typeof score.output === 'string' ? score.output : JSON.stringify(score.output),
      additionalContext:
        typeof score.additionalContext === 'string' ? score.additionalContext : JSON.stringify(score.additionalContext),
      runtimeContext:
        typeof score.runtimeContext === 'string' ? score.runtimeContext : JSON.stringify(score.runtimeContext),
      entityType: score.entityType,
      entityData: typeof score.entity === 'string' ? score.entity : JSON.stringify(score.entity),
      entityId: score.entityId,
      source: score.source,
      resourceId: score.resourceId || '',
      threadId: score.threadId || '',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    try {
      await this.service.entities.score.upsert(scoreData).go();

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
          id: 'STORAGE_DYNAMODB_STORE_SAVE_SCORE_FAILED',
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
      // Query scores by scorer ID using the GSI
      const query = this.service.entities.score.query.byScorer({ entity: 'score', scorerId });

      // Get all scores for this scorer ID (DynamoDB doesn't support OFFSET/LIMIT)
      const results = await query.go();
      let allScores = results.data.map((data: any) => this.parseScoreData(data));

      // Apply additional filters if provided
      if (entityId) {
        allScores = allScores.filter((score: ScoreRowData) => score.entityId === entityId);
      }
      if (entityType) {
        allScores = allScores.filter((score: ScoreRowData) => score.entityType === entityType);
      }
      if (source) {
        allScores = allScores.filter((score: ScoreRowData) => score.source === source);
      }

      // Sort by createdAt DESC (newest first)
      allScores.sort((a: ScoreRowData, b: ScoreRowData) => b.createdAt.getTime() - a.createdAt.getTime());

      // Apply pagination in memory
      const startIndex = pagination.page * pagination.perPage;
      const endIndex = startIndex + pagination.perPage;
      const paginatedScores = allScores.slice(startIndex, endIndex);

      // Calculate pagination info
      const total = allScores.length;
      const hasMore = endIndex < total;

      return {
        scores: paginatedScores,
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
          id: 'STORAGE_DYNAMODB_STORE_GET_SCORES_BY_SCORER_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: {
            scorerId: scorerId || '',
            entityId: entityId || '',
            entityType: entityType || '',
            source: source || '',
            page: pagination.page,
            perPage: pagination.perPage,
          },
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
    this.logger.debug('Getting scores by run ID', { runId, pagination });

    try {
      // Query scores by run ID using the GSI
      const query = this.service.entities.score.query.byRun({ entity: 'score', runId });

      // Get all scores for this run ID
      const results = await query.go();
      const allScores = results.data.map((data: any) => this.parseScoreData(data));

      // Sort by createdAt DESC (newest first)
      allScores.sort((a: ScoreRowData, b: ScoreRowData) => b.createdAt.getTime() - a.createdAt.getTime());

      // Apply pagination in memory
      const startIndex = pagination.page * pagination.perPage;
      const endIndex = startIndex + pagination.perPage;
      const paginatedScores = allScores.slice(startIndex, endIndex);

      // Calculate pagination info
      const total = allScores.length;
      const hasMore = endIndex < total;

      return {
        scores: paginatedScores,
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
          id: 'STORAGE_DYNAMODB_STORE_GET_SCORES_BY_RUN_ID_FAILED',
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
    entityId: string;
    entityType: string;
    pagination: StoragePagination;
  }): Promise<{ pagination: PaginationInfo; scores: ScoreRowData[] }> {
    this.logger.debug('Getting scores by entity ID', { entityId, entityType, pagination });

    try {
      // Use the byEntityData index which uses entityId as the primary key
      const query = this.service.entities.score.query.byEntityData({ entity: 'score', entityId });

      // Get all scores for this entity ID
      const results = await query.go();
      let allScores = results.data.map((data: any) => this.parseScoreData(data));

      // Filter by entityType since the index only uses entityId
      allScores = allScores.filter((score: ScoreRowData) => score.entityType === entityType);

      // Sort by createdAt DESC (newest first)
      allScores.sort((a: ScoreRowData, b: ScoreRowData) => b.createdAt.getTime() - a.createdAt.getTime());

      // Apply pagination in memory
      const startIndex = pagination.page * pagination.perPage;
      const endIndex = startIndex + pagination.perPage;
      const paginatedScores = allScores.slice(startIndex, endIndex);

      // Calculate pagination info
      const total = allScores.length;
      const hasMore = endIndex < total;

      return {
        scores: paginatedScores,
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
          id: 'STORAGE_DYNAMODB_STORE_GET_SCORES_BY_ENTITY_ID_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { entityId, entityType, page: pagination.page, perPage: pagination.perPage },
        },
        error,
      );
    }
  }
}
