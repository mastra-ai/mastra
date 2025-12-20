import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import type { SaveScorePayload, ScoreRowData, ScoringSource, ValidatedSaveScorePayload } from '@mastra/core/evals';
import { saveScorePayloadSchema } from '@mastra/core/evals';
import {
  createStorageErrorId,
  ScoresStorage,
  TABLE_SCORERS,
  calculatePagination,
  normalizePerPage,
  safelyParseJSON,
  transformScoreRow as coreTransformScoreRow,
} from '@mastra/core/storage';
import type { PaginationInfo, StoragePagination } from '@mastra/core/storage';
import type { MongoDBConnector } from '../../connectors/MongoDBConnector';
import { resolveMongoDBConfig } from '../../db';
import type { MongoDBDomainConfig, MongoDBIndexConfig } from '../../types';

/**
 * MongoDB-specific score row transformation.
 * Converts timestamp strings to Date objects.
 */
function transformScoreRow(row: Record<string, any>): ScoreRowData {
  return coreTransformScoreRow(row, {
    convertTimestamps: true,
  });
}

export class ScoresStorageMongoDB extends ScoresStorage {
  #connector: MongoDBConnector;
  #skipDefaultIndexes?: boolean;

  constructor(config: MongoDBDomainConfig) {
    super();
    this.#connector = resolveMongoDBConfig(config);
    this.#skipDefaultIndexes = config.skipDefaultIndexes;
  }

  private async getCollection(name: string) {
    return this.#connector.getCollection(name);
  }

  getDefaultIndexDefinitions(): MongoDBIndexConfig[] {
    return [
      { collection: TABLE_SCORERS, keys: { id: 1 }, options: { unique: true } },
      { collection: TABLE_SCORERS, keys: { scorerId: 1 } },
      { collection: TABLE_SCORERS, keys: { runId: 1 } },
      { collection: TABLE_SCORERS, keys: { entityId: 1, entityType: 1 } },
      { collection: TABLE_SCORERS, keys: { traceId: 1, spanId: 1 } },
      { collection: TABLE_SCORERS, keys: { createdAt: -1 } },
      { collection: TABLE_SCORERS, keys: { source: 1 } },
    ];
  }

  async createDefaultIndexes(): Promise<void> {
    if (this.#skipDefaultIndexes) {
      return;
    }

    for (const indexDef of this.getDefaultIndexDefinitions()) {
      try {
        const collection = await this.getCollection(indexDef.collection);
        await collection.createIndex(indexDef.keys, indexDef.options);
      } catch (error) {
        console.warn(`Failed to create index on ${indexDef.collection}:`, error);
      }
    }
  }

  async init(): Promise<void> {
    await this.createDefaultIndexes();
  }

  async dangerouslyClearAll(): Promise<void> {
    const collection = await this.getCollection(TABLE_SCORERS);
    await collection.deleteMany({});
  }

  async getScoreById({ id }: { id: string }): Promise<ScoreRowData | null> {
    try {
      const collection = await this.getCollection(TABLE_SCORERS);
      const document = await collection.findOne({ id });

      if (!document) {
        return null;
      }

      return transformScoreRow(document);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'GET_SCORE_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id },
        },
        error,
      );
    }
  }

  async saveScore(score: SaveScorePayload): Promise<{ score: ScoreRowData }> {
    let validatedScore: ValidatedSaveScorePayload;
    try {
      validatedScore = saveScorePayloadSchema.parse(score);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'SAVE_SCORE', 'VALIDATION_FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: {
            scorer: score.scorer?.id ?? 'unknown',
            entityId: score.entityId ?? 'unknown',
            entityType: score.entityType ?? 'unknown',
            traceId: score.traceId ?? '',
            spanId: score.spanId ?? '',
          },
        },
        error,
      );
    }
    try {
      const now = new Date();
      const scoreId = crypto.randomUUID();

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
      const requestContext =
        typeof validatedScore.requestContext === 'string'
          ? safelyParseJSON(validatedScore.requestContext)
          : validatedScore.requestContext;
      const entity =
        typeof validatedScore.entity === 'string' ? safelyParseJSON(validatedScore.entity) : validatedScore.entity;
      const createdAt = now;
      const updatedAt = now;

      const dataToSave = {
        ...validatedScore,
        id: scoreId,
        scorer,
        preprocessStepResult,
        analyzeStepResult,
        input,
        output,
        requestContext,
        entity,
        createdAt,
        updatedAt,
      };

      const collection = await this.getCollection(TABLE_SCORERS);
      await collection.insertOne(dataToSave);

      return { score: dataToSave as ScoreRowData };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'SAVE_SCORE', 'FAILED'),
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

      const collection = await this.getCollection(TABLE_SCORERS);
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
          id: createStorageErrorId('MONGODB', 'LIST_SCORES_BY_SCORER_ID', 'FAILED'),
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

      const collection = await this.getCollection(TABLE_SCORERS);
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
          id: createStorageErrorId('MONGODB', 'LIST_SCORES_BY_RUN_ID', 'FAILED'),
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

      const collection = await this.getCollection(TABLE_SCORERS);
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
          id: createStorageErrorId('MONGODB', 'LIST_SCORES_BY_ENTITY_ID', 'FAILED'),
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
      const collection = await this.getCollection(TABLE_SCORERS);
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
          id: createStorageErrorId('MONGODB', 'LIST_SCORES_BY_SPAN', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { traceId, spanId, page: pagination.page, perPage: pagination.perPage },
        },
        error,
      );
    }
  }
}
