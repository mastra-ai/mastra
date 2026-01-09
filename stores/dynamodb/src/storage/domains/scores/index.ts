import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { ListScoresResponse, SaveScorePayload, ScoreRowData, ScoringSource } from '@mastra/core/evals';
import { saveScorePayloadSchema } from '@mastra/core/evals';
import {
  createStorageErrorId,
  SCORERS_SCHEMA,
  ScoresStorage,
  calculatePagination,
  normalizePerPage,
  TABLE_SCORERS,
} from '@mastra/core/storage';
import type { StoragePagination } from '@mastra/core/storage';
import type { Service } from 'electrodb';
import { resolveDynamoDBConfig } from '../../db';
import type { DynamoDBDomainConfig } from '../../db';
import { deleteTableData } from '../utils';

export class ScoresStorageDynamoDB extends ScoresStorage {
  private service: Service<Record<string, any>>;
  constructor(config: DynamoDBDomainConfig) {
    super();
    this.service = resolveDynamoDBConfig(config);
  }

  async dangerouslyClearAll(): Promise<void> {
    await deleteTableData(this.service, TABLE_SCORERS);
  }

  /**
   * DynamoDB-specific score row transformation.
   *
   * Note: This implementation does NOT use coreTransformScoreRow because:
   * 1. ElectroDB already parses JSON fields via its entity getters
   * 2. DynamoDB stores empty strings for null values (which need special handling)
   * 3. 'entity' is a reserved ElectroDB key, so we use 'entityData' column
   */
  private parseScoreData(data: any): ScoreRowData {
    const result: Record<string, any> = {};

    // Map schema fields, handling DynamoDB's empty string for null convention
    for (const key of Object.keys(SCORERS_SCHEMA)) {
      if (['traceId', 'resourceId', 'threadId', 'spanId'].includes(key)) {
        result[key] = data[key] === '' ? null : data[key];
        continue;
      }
      result[key] = data[key];
    }

    // 'entity' is a reserved ElectroDB key, mapped from 'entityData'
    result.entity = data.entityData ?? null;

    return {
      ...result,
      createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
      updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
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
          id: createStorageErrorId('DYNAMODB', 'GET_SCORE_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id },
        },
        error,
      );
    }
  }

  async saveScore(score: SaveScorePayload): Promise<{ score: ScoreRowData }> {
    let validatedScore: SaveScorePayload;
    try {
      validatedScore = saveScorePayloadSchema.parse(score);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('DYNAMODB', 'SAVE_SCORE', 'VALIDATION_FAILED'),
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
    const scoreId = crypto.randomUUID();

    const scorer =
      typeof validatedScore.scorer === 'string' ? validatedScore.scorer : JSON.stringify(validatedScore.scorer);
    const preprocessStepResult =
      typeof validatedScore.preprocessStepResult === 'string'
        ? validatedScore.preprocessStepResult
        : JSON.stringify(validatedScore.preprocessStepResult);
    const analyzeStepResult =
      typeof validatedScore.analyzeStepResult === 'string'
        ? validatedScore.analyzeStepResult
        : JSON.stringify(validatedScore.analyzeStepResult);
    const input =
      typeof validatedScore.input === 'string' ? validatedScore.input : JSON.stringify(validatedScore.input);
    const output =
      typeof validatedScore.output === 'string' ? validatedScore.output : JSON.stringify(validatedScore.output);
    const requestContext =
      typeof validatedScore.requestContext === 'string'
        ? validatedScore.requestContext
        : JSON.stringify(validatedScore.requestContext);
    const entity =
      typeof validatedScore.entity === 'string' ? validatedScore.entity : JSON.stringify(validatedScore.entity);
    const metadata =
      typeof validatedScore.metadata === 'string'
        ? validatedScore.metadata
        : validatedScore.metadata
          ? JSON.stringify(validatedScore.metadata)
          : undefined;
    const additionalContext =
      typeof validatedScore.additionalContext === 'string'
        ? validatedScore.additionalContext
        : validatedScore.additionalContext
          ? JSON.stringify(validatedScore.additionalContext)
          : undefined;

    const scoreData = Object.fromEntries(
      Object.entries({
        ...validatedScore,
        entity: 'score',
        id: scoreId,
        scorer,
        preprocessStepResult,
        analyzeStepResult,
        input,
        output,
        requestContext,
        metadata,
        additionalContext,
        entityData: entity,
        traceId: validatedScore.traceId || '',
        resourceId: validatedScore.resourceId || '',
        threadId: validatedScore.threadId || '',
        spanId: validatedScore.spanId || '',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      }).filter(([_, value]) => value !== undefined && value !== null),
    );

    try {
      await this.service.entities.score.upsert(scoreData).go();

      return {
        score: {
          ...validatedScore,
          id: scoreId,
          createdAt: now,
          updatedAt: now,
        } as ScoreRowData,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('DYNAMODB', 'SAVE_SCORE', 'FAILED'),
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
  }): Promise<ListScoresResponse> {
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
          id: createStorageErrorId('DYNAMODB', 'LIST_SCORES_BY_SCORER_ID', 'FAILED'),
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
  }): Promise<ListScoresResponse> {
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
          id: createStorageErrorId('DYNAMODB', 'LIST_SCORES_BY_RUN_ID', 'FAILED'),
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
  }): Promise<ListScoresResponse> {
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
          id: createStorageErrorId('DYNAMODB', 'LIST_SCORES_BY_ENTITY_ID', 'FAILED'),
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
  }): Promise<ListScoresResponse> {
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
          id: createStorageErrorId('DYNAMODB', 'LIST_SCORES_BY_SPAN', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { traceId, spanId, page: pagination.page, perPage: pagination.perPage },
        },
        error,
      );
    }
  }
}
