import { randomUUID } from 'node:crypto';

import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  ExperimentsStorage,
  createStorageErrorId,
  TABLE_EXPERIMENTS,
  TABLE_EXPERIMENT_RESULTS,
  normalizePerPage,
  calculatePagination,
  safelyParseJSON,
} from '@mastra/core/storage';
import type {
  Experiment,
  ExperimentResult,
  ExperimentResultStatus,
  CreateExperimentInput,
  UpdateExperimentInput,
  AddExperimentResultInput,
  UpdateExperimentResultInput,
  ListExperimentsInput,
  ListExperimentsOutput,
  ListExperimentResultsInput,
  ListExperimentResultsOutput,
  ExperimentReviewCounts,
} from '@mastra/core/storage';
import type { MongoDBConnector } from '../../connectors/MongoDBConnector';
import { resolveMongoDBConfig } from '../../db';
import type { MongoDBDomainConfig, MongoDBIndexConfig } from '../../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') return new Date(value);
  return new Date();
}

function toDateOrNull(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  return toDate(value);
}

function parseJsonField(value: unknown): any {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'string') return safelyParseJSON(value);
  return value;
}

function transformExperimentRow(row: Record<string, unknown>): Experiment {
  return {
    id: row.id as string,
    name: (row.name as string) ?? undefined,
    description: (row.description as string) ?? undefined,
    metadata: parseJsonField(row.metadata) ?? undefined,
    datasetId: (row.datasetId as string | null) ?? null,
    datasetVersion: row.datasetVersion != null ? Number(row.datasetVersion) : null,
    targetType: row.targetType as Experiment['targetType'],
    targetId: row.targetId as string,
    status: row.status as Experiment['status'],
    totalItems: Number(row.totalItems ?? 0),
    succeededCount: Number(row.succeededCount ?? 0),
    failedCount: Number(row.failedCount ?? 0),
    skippedCount: Number(row.skippedCount ?? 0),
    agentVersion: (row.agentVersion as string | null) ?? null,
    startedAt: toDateOrNull(row.startedAt),
    completedAt: toDateOrNull(row.completedAt),
    createdAt: toDate(row.createdAt),
    updatedAt: toDate(row.updatedAt),
  };
}

function transformExperimentResultRow(row: Record<string, unknown>): ExperimentResult {
  return {
    id: row.id as string,
    experimentId: row.experimentId as string,
    itemId: row.itemId as string,
    itemDatasetVersion: row.itemDatasetVersion != null ? Number(row.itemDatasetVersion) : null,
    input: parseJsonField(row.input),
    output: parseJsonField(row.output) ?? null,
    groundTruth: parseJsonField(row.groundTruth) ?? null,
    error: parseJsonField(row.error) ?? null,
    startedAt: toDate(row.startedAt),
    completedAt: toDate(row.completedAt),
    retryCount: Number(row.retryCount ?? 0),
    traceId: (row.traceId as string | null) ?? null,
    status: (row.status as ExperimentResultStatus | null) ?? null,
    tags: Array.isArray(row.tags) ? row.tags : (parseJsonField(row.tags) ?? null),
    createdAt: toDate(row.createdAt),
  };
}

// ---------------------------------------------------------------------------
// MongoDB Experiments Storage
// ---------------------------------------------------------------------------

export class MongoDBExperimentsStorage extends ExperimentsStorage {
  #connector: MongoDBConnector;
  #skipDefaultIndexes?: boolean;
  #indexes?: MongoDBIndexConfig[];

  static readonly MANAGED_COLLECTIONS = [TABLE_EXPERIMENTS, TABLE_EXPERIMENT_RESULTS] as const;

  constructor(config: MongoDBDomainConfig) {
    super();
    this.#connector = resolveMongoDBConfig(config);
    this.#skipDefaultIndexes = config.skipDefaultIndexes;
    this.#indexes = config.indexes?.filter(idx =>
      (MongoDBExperimentsStorage.MANAGED_COLLECTIONS as readonly string[]).includes(idx.collection),
    );
  }

  private async getCollection(name: string) {
    return this.#connector.getCollection(name);
  }

  // -------------------------------------------------------------------------
  // Index Management
  // -------------------------------------------------------------------------

  getDefaultIndexDefinitions(): MongoDBIndexConfig[] {
    return [
      { collection: TABLE_EXPERIMENTS, keys: { id: 1 }, options: { unique: true } },
      { collection: TABLE_EXPERIMENTS, keys: { datasetId: 1 } },
      { collection: TABLE_EXPERIMENTS, keys: { createdAt: -1, id: 1 } },
      { collection: TABLE_EXPERIMENT_RESULTS, keys: { id: 1 }, options: { unique: true } },
      { collection: TABLE_EXPERIMENT_RESULTS, keys: { experimentId: 1 } },
      { collection: TABLE_EXPERIMENT_RESULTS, keys: { experimentId: 1, itemId: 1 }, options: { unique: true } },
      { collection: TABLE_EXPERIMENT_RESULTS, keys: { createdAt: -1 } },
      { collection: TABLE_EXPERIMENT_RESULTS, keys: { experimentId: 1, startedAt: 1, id: 1 } },
    ];
  }

  async createDefaultIndexes(): Promise<void> {
    if (this.#skipDefaultIndexes) return;
    for (const indexDef of this.getDefaultIndexDefinitions()) {
      try {
        const collection = await this.getCollection(indexDef.collection);
        await collection.createIndex(indexDef.keys, indexDef.options);
      } catch (error) {
        this.logger?.warn?.(`Failed to create index on ${indexDef.collection}:`, error);
      }
    }
  }

  async createCustomIndexes(): Promise<void> {
    if (!this.#indexes || this.#indexes.length === 0) return;
    for (const indexDef of this.#indexes) {
      try {
        const collection = await this.getCollection(indexDef.collection);
        await collection.createIndex(indexDef.keys, indexDef.options);
      } catch (error) {
        this.logger?.warn?.(`Failed to create custom index on ${indexDef.collection}:`, error);
      }
    }
  }

  async init(): Promise<void> {
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  // -------------------------------------------------------------------------
  // Experiment CRUD
  // -------------------------------------------------------------------------

  async createExperiment(input: CreateExperimentInput): Promise<Experiment> {
    const id = input.id ?? randomUUID();
    const now = new Date();

    const doc = {
      id,
      name: input.name ?? null,
      description: input.description ?? null,
      metadata: input.metadata ?? null,
      datasetId: input.datasetId ?? null,
      datasetVersion: input.datasetVersion ?? null,
      targetType: input.targetType,
      targetId: input.targetId,
      status: 'pending' as const,
      totalItems: input.totalItems,
      succeededCount: 0,
      failedCount: 0,
      skippedCount: 0,
      agentVersion: null,
      startedAt: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    try {
      const collection = await this.getCollection(TABLE_EXPERIMENTS);
      await collection.insertOne(doc);

      return {
        id,
        name: input.name,
        description: input.description,
        metadata: input.metadata,
        datasetId: input.datasetId ?? null,
        datasetVersion: input.datasetVersion ?? null,
        targetType: input.targetType,
        targetId: input.targetId,
        status: 'pending',
        totalItems: input.totalItems,
        succeededCount: 0,
        failedCount: 0,
        skippedCount: 0,
        agentVersion: null,
        startedAt: null,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'CREATE_EXPERIMENT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { name: input.name ?? 'unnamed' },
        },
        error,
      );
    }
  }

  async updateExperiment(input: UpdateExperimentInput): Promise<Experiment> {
    const updateFields: Record<string, unknown> = { updatedAt: new Date() };

    if (input.name !== undefined) updateFields.name = input.name;
    if (input.description !== undefined) updateFields.description = input.description;
    if (input.metadata !== undefined) updateFields.metadata = input.metadata;
    if (input.status !== undefined) updateFields.status = input.status;
    if (input.totalItems !== undefined) updateFields.totalItems = input.totalItems;
    if (input.succeededCount !== undefined) updateFields.succeededCount = input.succeededCount;
    if (input.failedCount !== undefined) updateFields.failedCount = input.failedCount;
    if (input.skippedCount !== undefined) updateFields.skippedCount = input.skippedCount;
    if (input.startedAt !== undefined) updateFields.startedAt = input.startedAt;
    if (input.completedAt !== undefined) updateFields.completedAt = input.completedAt;

    try {
      const collection = await this.getCollection(TABLE_EXPERIMENTS);
      const result = await collection.updateOne({ id: input.id }, { $set: updateFields });

      if (result.matchedCount === 0) {
        throw new MastraError({
          id: createStorageErrorId('MONGODB', 'UPDATE_EXPERIMENT', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { experimentId: input.id },
        });
      }

      const updated = await this.getExperimentById({ id: input.id });
      return updated!;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'UPDATE_EXPERIMENT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { experimentId: input.id },
        },
        error,
      );
    }
  }

  async getExperimentById({ id }: { id: string }): Promise<Experiment | null> {
    try {
      const collection = await this.getCollection(TABLE_EXPERIMENTS);
      const doc = await collection.findOne({ id });
      if (!doc) return null;
      return transformExperimentRow(doc as unknown as Record<string, unknown>);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'GET_EXPERIMENT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id },
        },
        error,
      );
    }
  }

  async listExperiments(args: ListExperimentsInput): Promise<ListExperimentsOutput> {
    try {
      const collection = await this.getCollection(TABLE_EXPERIMENTS);
      const { page, perPage: perPageInput } = args.pagination;

      const filter: Record<string, unknown> = {};
      if (args.datasetId) {
        filter.datasetId = args.datasetId;
      }
      if (args.targetType) {
        filter.targetType = args.targetType;
      }
      if (args.targetId) {
        filter.targetId = args.targetId;
      }
      if (args.agentVersion) {
        filter.agentVersion = args.agentVersion;
      }
      if (args.status) {
        filter.status = args.status;
      }

      const total = await collection.countDocuments(filter);

      if (total === 0) {
        return { experiments: [], pagination: { total: 0, page, perPage: perPageInput, hasMore: false } };
      }

      const normalizedPerPage = normalizePerPage(perPageInput, 100);
      const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, normalizedPerPage);

      // Handle perPage = 0 edge case (MongoDB limit(0) disables limit)
      if (normalizedPerPage === 0) {
        return { experiments: [], pagination: { total, page, perPage: perPageForResponse, hasMore: total > 0 } };
      }

      const limitValue = perPageInput === false ? total : normalizedPerPage;

      const docs = await collection
        .find(filter)
        .sort({ createdAt: -1, id: 1 })
        .skip(offset)
        .limit(limitValue)
        .toArray();

      return {
        experiments: docs.map(d => transformExperimentRow(d as unknown as Record<string, unknown>)),
        pagination: {
          total,
          page,
          perPage: perPageForResponse,
          hasMore: perPageInput === false ? false : offset + normalizedPerPage < total,
        },
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'LIST_EXPERIMENTS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async deleteExperiment({ id }: { id: string }): Promise<void> {
    try {
      // Delete results first (FK semantics)
      const resultsCollection = await this.getCollection(TABLE_EXPERIMENT_RESULTS);
      await resultsCollection.deleteMany({ experimentId: id });

      const experimentsCollection = await this.getCollection(TABLE_EXPERIMENTS);
      await experimentsCollection.deleteOne({ id });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'DELETE_EXPERIMENT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id },
        },
        error,
      );
    }
  }

  // -------------------------------------------------------------------------
  // Experiment Results
  // -------------------------------------------------------------------------

  async addExperimentResult(input: AddExperimentResultInput): Promise<ExperimentResult> {
    const id = input.id ?? randomUUID();
    const now = new Date();

    const doc = {
      id,
      experimentId: input.experimentId,
      itemId: input.itemId,
      itemDatasetVersion: input.itemDatasetVersion ?? null,
      input: input.input,
      output: input.output ?? null,
      groundTruth: input.groundTruth ?? null,
      error: input.error ?? null,
      startedAt: input.startedAt,
      completedAt: input.completedAt,
      retryCount: input.retryCount,
      traceId: input.traceId ?? null,
      status: input.status ?? null,
      tags: input.tags ?? null,
      createdAt: now,
    };

    try {
      const collection = await this.getCollection(TABLE_EXPERIMENT_RESULTS);
      await collection.insertOne(doc);

      return {
        id,
        experimentId: input.experimentId,
        itemId: input.itemId,
        itemDatasetVersion: input.itemDatasetVersion ?? null,
        input: input.input,
        output: input.output ?? null,
        groundTruth: input.groundTruth ?? null,
        error: input.error ?? null,
        startedAt: input.startedAt,
        completedAt: input.completedAt,
        retryCount: input.retryCount,
        traceId: input.traceId ?? null,
        status: input.status ?? null,
        tags: input.tags ?? null,
        createdAt: now,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'ADD_EXPERIMENT_RESULT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { experimentId: input.experimentId },
        },
        error,
      );
    }
  }

  async updateExperimentResult(input: UpdateExperimentResultInput): Promise<ExperimentResult> {
    const updateFields: Record<string, unknown> = {};

    if (input.status !== undefined) updateFields.status = input.status;
    if (input.tags !== undefined) updateFields.tags = input.tags;

    if (Object.keys(updateFields).length === 0) {
      const existing = await this.getExperimentResultById({ id: input.id });
      if (!existing || (input.experimentId && existing.experimentId !== input.experimentId)) {
        throw new MastraError({
          id: createStorageErrorId('MONGODB', 'UPDATE_EXPERIMENT_RESULT', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { resultId: input.id },
        });
      }
      return existing;
    }

    try {
      const collection = await this.getCollection(TABLE_EXPERIMENT_RESULTS);

      const filter: Record<string, unknown> = { id: input.id };
      if (input.experimentId) {
        filter.experimentId = input.experimentId;
      }

      const result = await collection.findOneAndUpdate(filter, { $set: updateFields }, { returnDocument: 'after' });

      if (!result) {
        throw new MastraError({
          id: createStorageErrorId('MONGODB', 'UPDATE_EXPERIMENT_RESULT', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { resultId: input.id },
        });
      }

      return transformExperimentResultRow(result as unknown as Record<string, unknown>);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'UPDATE_EXPERIMENT_RESULT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { resultId: input.id },
        },
        error,
      );
    }
  }

  async getExperimentResultById({ id }: { id: string }): Promise<ExperimentResult | null> {
    try {
      const collection = await this.getCollection(TABLE_EXPERIMENT_RESULTS);
      const doc = await collection.findOne({ id });
      if (!doc) return null;
      return transformExperimentResultRow(doc as unknown as Record<string, unknown>);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'GET_EXPERIMENT_RESULT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id },
        },
        error,
      );
    }
  }

  async listExperimentResults(args: ListExperimentResultsInput): Promise<ListExperimentResultsOutput> {
    try {
      const collection = await this.getCollection(TABLE_EXPERIMENT_RESULTS);
      const { page, perPage: perPageInput } = args.pagination;

      const filter: Record<string, unknown> = { experimentId: args.experimentId };
      if (args.traceId) {
        filter.traceId = args.traceId;
      }
      if (args.status) {
        filter.status = args.status;
      }

      const total = await collection.countDocuments(filter);

      if (total === 0) {
        return { results: [], pagination: { total: 0, page, perPage: perPageInput, hasMore: false } };
      }

      const normalizedPerPage = normalizePerPage(perPageInput, 100);
      const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, normalizedPerPage);

      // Handle perPage = 0 edge case (MongoDB limit(0) disables limit)
      if (normalizedPerPage === 0) {
        return { results: [], pagination: { total, page, perPage: perPageForResponse, hasMore: total > 0 } };
      }

      const limitValue = perPageInput === false ? total : normalizedPerPage;

      const docs = await collection.find(filter).sort({ startedAt: 1, id: 1 }).skip(offset).limit(limitValue).toArray();

      return {
        results: docs.map(d => transformExperimentResultRow(d as unknown as Record<string, unknown>)),
        pagination: {
          total,
          page,
          perPage: perPageForResponse,
          hasMore: perPageInput === false ? false : offset + normalizedPerPage < total,
        },
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'LIST_EXPERIMENT_RESULTS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { experimentId: args.experimentId },
        },
        error,
      );
    }
  }

  async deleteExperimentResults({ experimentId }: { experimentId: string }): Promise<void> {
    try {
      const collection = await this.getCollection(TABLE_EXPERIMENT_RESULTS);
      await collection.deleteMany({ experimentId });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'DELETE_EXPERIMENT_RESULTS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { experimentId },
        },
        error,
      );
    }
  }

  // -------------------------------------------------------------------------
  // Aggregation
  // -------------------------------------------------------------------------

  async getReviewSummary(): Promise<ExperimentReviewCounts[]> {
    try {
      const collection = await this.getCollection(TABLE_EXPERIMENT_RESULTS);
      const pipeline = [
        {
          $group: {
            _id: '$experimentId',
            total: { $sum: 1 },
            needsReview: { $sum: { $cond: [{ $eq: ['$status', 'needs-review'] }, 1, 0] } },
            reviewed: { $sum: { $cond: [{ $eq: ['$status', 'reviewed'] }, 1, 0] } },
            complete: { $sum: { $cond: [{ $eq: ['$status', 'complete'] }, 1, 0] } },
          },
        },
      ];
      const results = await collection.aggregate(pipeline).toArray();
      return results.map(row => ({
        experimentId: row._id as string,
        total: Number(row.total ?? 0),
        needsReview: Number(row.needsReview ?? 0),
        reviewed: Number(row.reviewed ?? 0),
        complete: Number(row.complete ?? 0),
      }));
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'GET_REVIEW_SUMMARY', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------

  async dangerouslyClearAll(): Promise<void> {
    for (const collectionName of MongoDBExperimentsStorage.MANAGED_COLLECTIONS) {
      try {
        const collection = await this.getCollection(collectionName);
        await collection.deleteMany({});
      } catch {
        // Collection may not exist yet
      }
    }
  }
}
