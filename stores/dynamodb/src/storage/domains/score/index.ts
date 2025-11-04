import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { ScoreRowData, ScoringSource, ValidatedSaveScorePayload } from '@mastra/core/evals';
import { saveScorePayloadSchema } from '@mastra/core/evals';
import { ScoresStorage, calculatePagination, normalizePerPage } from '@mastra/core/storage';
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
    let validatedScore: ValidatedSaveScorePayload;
    try {
      validatedScore = saveScorePayloadSchema.parse(score);
    } catch (error) {
      throw new MastraError(
        {
          id: 'STORAGE_DYNAMODB_STORE_SAVE_SCORE_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }

    const now = new Date();
    const scoreId = `score-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const scoreData = {
      entity: 'score',
      id: scoreId,
      scorerId: validatedScore.scorerId,
      traceId: validatedScore.traceId || '',
      spanId: validatedScore.spanId || '',
      runId: validatedScore.runId,
      scorer: typeof validatedScore.scorer === 'string' ? validatedScore.scorer : JSON.stringify(validatedScore.scorer),
      preprocessStepResult:
        typeof validatedScore.preprocessStepResult === 'string'
          ? validatedScore.preprocessStepResult
          : JSON.stringify(validatedScore.preprocessStepResult),
      analyzeStepResult:
        typeof validatedScore.analyzeStepResult === 'string'
          ? validatedScore.analyzeStepResult
          : JSON.stringify(validatedScore.analyzeStepResult),
      score: validatedScore.score,
      reason: validatedScore.reason,
      preprocessPrompt: validatedScore.preprocessPrompt,
      generateScorePrompt: validatedScore.generateScorePrompt,
      generateReasonPrompt: validatedScore.generateReasonPrompt,
      analyzePrompt: validatedScore.analyzePrompt,
      input: typeof validatedScore.input === 'string' ? validatedScore.input : JSON.stringify(validatedScore.input),
      output: typeof validatedScore.output === 'string' ? validatedScore.output : JSON.stringify(validatedScore.output),
      additionalContext:
        typeof validatedScore.additionalContext === 'string'
          ? validatedScore.additionalContext
          : JSON.stringify(validatedScore.additionalContext),
      requestContext:
        typeof validatedScore.requestContext === 'string'
          ? validatedScore.requestContext
          : JSON.stringify(validatedScore.requestContext),
      entityType: validatedScore.entityType,
      entityData:
        typeof validatedScore.entity === 'string' ? validatedScore.entity : JSON.stringify(validatedScore.entity),
      entityId: validatedScore.entityId,
      source: validatedScore.source,
      resourceId: validatedScore.resourceId || '',
      threadId: validatedScore.threadId || '',
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

      const { page, perPage: perPageInput } = pagination;
      const perPage = normalizePerPage(perPageInput, Number.MAX_SAFE_INTEGER);
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

      // Apply pagination in memory
      const total = allScores.length;
      const end = perPageInput === false ? allScores.length : start + perPage;
      const paginatedScores = allScores.slice(start, end);

      return {
        scores: paginatedScores,
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

  async listScoresByRunId({
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

      const { page, perPage: perPageInput } = pagination;
      const perPage = normalizePerPage(perPageInput, Number.MAX_SAFE_INTEGER);
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

      // Apply pagination in memory
      const total = allScores.length;
      const end = perPageInput === false ? allScores.length : start + perPage;
      const paginatedScores = allScores.slice(start, end);

      return {
        scores: paginatedScores,
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
          id: 'STORAGE_DYNAMODB_STORE_GET_SCORES_BY_RUN_ID_FAILED',
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

      const { page, perPage: perPageInput } = pagination;
      const perPage = normalizePerPage(perPageInput, Number.MAX_SAFE_INTEGER);
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

      // Apply pagination in memory
      const total = allScores.length;
      const end = perPageInput === false ? allScores.length : start + perPage;
      const paginatedScores = allScores.slice(start, end);

      return {
        scores: paginatedScores,
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
          id: 'STORAGE_DYNAMODB_STORE_GET_SCORES_BY_ENTITY_ID_FAILED',
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
    this.logger.debug('Getting scores by span', { traceId, spanId, pagination });

    try {
      // Query scores by trace ID and span ID using the GSI
      const query = this.service.entities.score.query.bySpan({ entity: 'score', traceId, spanId });

      // Get all scores for this trace and span ID
      const results = await query.go();
      const allScores = results.data.map((data: any) => this.parseScoreData(data));

      // Sort by createdAt DESC (newest first)
      allScores.sort((a: ScoreRowData, b: ScoreRowData) => b.createdAt.getTime() - a.createdAt.getTime());

      const { page, perPage: perPageInput } = pagination;
      const perPage = normalizePerPage(perPageInput, Number.MAX_SAFE_INTEGER);
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

      // Apply pagination in memory
      const total = allScores.length;
      const end = perPageInput === false ? allScores.length : start + perPage;
      const paginatedScores = allScores.slice(start, end);

      return {
        scores: paginatedScores,
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
          id: 'STORAGE_DYNAMODB_STORE_GET_SCORES_BY_SPAN_FAILED',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { traceId, spanId, page: pagination.page, perPage: pagination.perPage },
        },
        error,
      );
    }
  }
}
