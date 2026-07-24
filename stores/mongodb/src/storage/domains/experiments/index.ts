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
  ExperimentTenancyFilters,
  CreateExperimentInput,
  UpdateExperimentInput,
  AddExperimentResultInput,
  UpdateExperimentResultInput,
  ListExperimentsInput,
  ListExperimentsOutput,
  ListExperimentResultsInput,
  ListExperimentResultsOutput,
  ExperimentReviewCounts,
  PruneOptions,
  PruneResult,
  RetentionTablesDescriptor,
  TableRetentionPolicy,
} from '@mastra/core/storage';
import type { MongoDBConnector } from '../../connectors/MongoDBConnector';
import { resolveMongoDBConfig } from '../../db';
import { cutoffFor, DEFAULT_PRUNE_BATCH_SIZE, ensureAnchorIndex, runBatchedDelete } from '../../retention';
import type { MongoDBDomainConfig, MongoDBIndexConfig } from '../../types';
import { applyTenancyFilter } from '../utils';

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
    organizationId: (row.organizationId as string | null) ?? null,
    projectId: (row.projectId as string | null) ?? null,
    targetType: row.targetType as Experiment['targetType'],
    targetId: row.targetId as string,
    status: row.status as Experiment['status'],
    totalItems: Number(row.totalItems ?? 0),
    executionStatusCounts:
      row.executionStatusCounts != null
        ? (parseJsonField(row.executionStatusCounts) as Experiment['executionStatusCounts'])
        : {
            completed: Number(row.succeededCount ?? 0),
            skipped: Number(row.skippedCount ?? 0),
            error: Number(row.failedCount ?? 0),
            cancelled: 0,
          },
    scorerStatusCounts:
      row.scorerStatusCounts != null
        ? (parseJsonField(row.scorerStatusCounts) as Experiment['scorerStatusCounts'])
        : null,
    thresholds: row.thresholds != null ? (parseJsonField(row.thresholds) as Experiment['thresholds']) : null,
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
    organizationId: (row.organizationId as string | null) ?? null,
    projectId: (row.projectId as string | null) ?? null,
    input: parseJsonField(row.input),
    output: parseJsonField(row.output) ?? null,
    groundTruth: parseJsonField(row.groundTruth) ?? null,
    error: parseJsonField(row.error) ?? null,
    executionStatus: (row.executionStatus as ExperimentResult['executionStatus']) ?? null,
    startedAt: toDate(row.startedAt),
    completedAt: toDate(row.completedAt),
    retryCount: Number(row.retryCount ?? 0),
    traceId: (row.traceId as string | null) ?? null,
    status: (row.status as ExperimentResultStatus | null) ?? null,
    tags: Array.isArray(row.tags) ? row.tags : (parseJsonField(row.tags) ?? null),
    toolMockReport: (parseJsonField(row.toolMockReport) as ExperimentResult['toolMockReport']) ?? null,
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

  /**
   * Experiments prune as whole units: an experiment and its results are only
   * deleted together, once the experiment itself is old (anchored on the
   * parent's `completedAt`, a BSON date that stays `null` while running).
   * `results` is intentionally not an independent retention key.
   */
  static override readonly retentionTables: RetentionTablesDescriptor = {
    experiments: { table: TABLE_EXPERIMENTS, column: 'completedAt', indexed: true },
  };

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

  /**
   * Prune whole experiments older than the `experiments` policy's `maxAge`.
   *
   * Each batch collects up to `batchSize` aged experiment ids
   * (`completedAt < cutoff`; BSON type bracketing means `null` — still
   * running — never matches), then deletes their `experiment_results` rows and
   * the experiment rows for exactly that id set inside
   * `connector.withTransaction()` — atomic on replica sets, sequential
   * children-first on standalone — mirroring `deleteExperiment`. Hitting
   * `maxBatches`/`maxRows` or the abort signal between batches therefore never
   * leaves a run hollow (parent kept, results gone). Bounds count whole
   * experiments, not rows.
   */
  async prune(policies: Record<string, TableRetentionPolicy>, options?: PruneOptions): Promise<PruneResult[]> {
    const policy = policies['experiments'];
    if (!policy || options?.signal?.aborted) {
      return policy
        ? [
            { domain: 'experiments', table: TABLE_EXPERIMENT_RESULTS, deleted: 0, done: false },
            { domain: 'experiments', table: TABLE_EXPERIMENTS, deleted: 0, done: false },
          ]
        : [];
    }

    await ensureAnchorIndex(
      this.#connector,
      { table: TABLE_EXPERIMENTS, column: 'completedAt', indexed: true },
      this.logger,
    );

    const cutoff = cutoffFor(policy, 'date');
    const batchSize = policy.batchSize ?? DEFAULT_PRUNE_BATCH_SIZE;

    const experimentsCollection = await this.getCollection(TABLE_EXPERIMENTS);
    const resultsCollection = await this.getCollection(TABLE_EXPERIMENT_RESULTS);

    let childDeleted = 0;
    const parent = await runBatchedDelete({
      deleteBatch: async limit => {
        const docs = await experimentsCollection
          .find({ completedAt: { $lt: cutoff } })
          .project<{ id: string }>({ id: 1 })
          .limit(limit)
          .toArray();
        if (docs.length === 0) return 0;
        const ids = docs.map(doc => doc.id);
        return this.#connector.withTransaction(async session => {
          const children = await resultsCollection.deleteMany({ experimentId: { $in: ids } }, { session });
          childDeleted += children.deletedCount;
          const parents = await experimentsCollection.deleteMany({ id: { $in: ids } }, { session });
          return parents.deletedCount;
        });
      },
      batchSize,
      options,
    });

    return [
      { domain: 'experiments', table: TABLE_EXPERIMENT_RESULTS, deleted: childDeleted, done: parent.done },
      { domain: 'experiments', table: TABLE_EXPERIMENTS, deleted: parent.deleted, done: parent.done },
    ];
  }

  // -------------------------------------------------------------------------
  // Index Management
  // -------------------------------------------------------------------------

  getDefaultIndexDefinitions(): MongoDBIndexConfig[] {
    return [
      { collection: TABLE_EXPERIMENTS, keys: { id: 1 }, options: { unique: true } },
      { collection: TABLE_EXPERIMENTS, keys: { datasetId: 1 } },
      { collection: TABLE_EXPERIMENTS, keys: { createdAt: -1, id: 1 } },
      // Tenancy: leading-tenant indexes for multi-tenant scans (parity with datasets domain).
      { collection: TABLE_EXPERIMENTS, keys: { organizationId: 1, projectId: 1 } },
      { collection: TABLE_EXPERIMENT_RESULTS, keys: { id: 1 }, options: { unique: true } },
      { collection: TABLE_EXPERIMENT_RESULTS, keys: { experimentId: 1 } },
      { collection: TABLE_EXPERIMENT_RESULTS, keys: { experimentId: 1, itemId: 1 }, options: { unique: true } },
      { collection: TABLE_EXPERIMENT_RESULTS, keys: { createdAt: -1 } },
      { collection: TABLE_EXPERIMENT_RESULTS, keys: { experimentId: 1, startedAt: 1, id: 1 } },
      { collection: TABLE_EXPERIMENT_RESULTS, keys: { organizationId: 1, projectId: 1 } },
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
    const thresholds = (input.thresholds ?? []).map(binding => ({
      ...binding,
      threshold: typeof binding.threshold === 'number' ? binding.threshold : { ...binding.threshold },
    }));
    const executionStatusCounts = { completed: 0, skipped: 0, error: 0, cancelled: 0 };
    const scorerStatusCounts = { completed: 0, error: 0 };

    const doc = {
      id,
      name: input.name ?? null,
      description: input.description ?? null,
      metadata: input.metadata ?? null,
      datasetId: input.datasetId ?? null,
      datasetVersion: input.datasetVersion ?? null,
      organizationId: input.organizationId ?? null,
      projectId: input.projectId ?? null,
      targetType: input.targetType,
      targetId: input.targetId,
      status: 'pending' as const,
      totalItems: input.totalItems,
      executionStatusCounts,
      scorerStatusCounts,
      thresholds,
      succeededCount: 0,
      failedCount: 0,
      skippedCount: 0,
      agentVersion: input.agentVersion ?? null,
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
        organizationId: input.organizationId ?? null,
        projectId: input.projectId ?? null,
        targetType: input.targetType,
        targetId: input.targetId,
        status: 'pending',
        totalItems: input.totalItems,
        executionStatusCounts,
        scorerStatusCounts,
        thresholds,
        succeededCount: 0,
        failedCount: 0,
        skippedCount: 0,
        agentVersion: input.agentVersion ?? null,
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
    const existing = await this.getExperimentById({ id: input.id });
    if (!existing) {
      throw new MastraError({
        id: createStorageErrorId('MONGODB', 'UPDATE_EXPERIMENT', 'NOT_FOUND'),
        domain: ErrorDomain.STORAGE,
        category: ErrorCategory.USER,
        details: { experimentId: input.id },
      });
    }
    const hasLegacyCountUpdate =
      input.succeededCount !== undefined || input.failedCount !== undefined || input.skippedCount !== undefined;
    const executionStatusCounts =
      input.executionStatusCounts !== undefined
        ? input.executionStatusCounts
        : hasLegacyCountUpdate
          ? {
              completed: input.succeededCount ?? existing.succeededCount,
              skipped: input.skippedCount ?? existing.skippedCount,
              error: input.failedCount ?? existing.failedCount,
              cancelled: 0,
            }
          : undefined;
    const updateFields: Record<string, unknown> = { updatedAt: new Date() };

    if (input.name !== undefined) updateFields.name = input.name;
    if (input.description !== undefined) updateFields.description = input.description;
    if (input.metadata !== undefined) updateFields.metadata = input.metadata;
    if (input.status !== undefined) updateFields.status = input.status;
    if (input.totalItems !== undefined) updateFields.totalItems = input.totalItems;
    if (input.succeededCount !== undefined) updateFields.succeededCount = input.succeededCount;
    if (input.failedCount !== undefined) updateFields.failedCount = input.failedCount;
    if (input.skippedCount !== undefined) updateFields.skippedCount = input.skippedCount;
    if (executionStatusCounts !== undefined) updateFields.executionStatusCounts = executionStatusCounts;
    if (input.scorerStatusCounts !== undefined) updateFields.scorerStatusCounts = input.scorerStatusCounts;
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

  async getExperimentById({
    id,
    filters,
  }: {
    id: string;
    filters?: ExperimentTenancyFilters;
  }): Promise<Experiment | null> {
    try {
      const collection = await this.getCollection(TABLE_EXPERIMENTS);
      const query: Record<string, any> = { id };
      applyTenancyFilter(query, filters);
      const doc = await collection.findOne(query);
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
      if (args.filters) {
        const { organizationId, projectId } = args.filters;
        if (organizationId !== undefined) {
          filter.organizationId = organizationId;
        }
        if (projectId !== undefined) {
          filter.projectId = projectId;
        }
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

  async deleteExperiment({ id, filters }: { id: string; filters?: ExperimentTenancyFilters }): Promise<void> {
    try {
      // Tenancy predicate applied on every destructive query (not only the
      // pre-check). Silent no-op on mismatch.
      const experimentsCollection = await this.getCollection(TABLE_EXPERIMENTS);
      const gateQuery: Record<string, any> = { id };
      applyTenancyFilter(gateQuery, filters);
      const existing = await experimentsCollection.findOne(gateQuery);
      if (!existing) return;

      // Delete results first (FK semantics). Scope on the results collection too
      // — result rows carry organizationId/projectId of the owning experiment.
      const resultsCollection = await this.getCollection(TABLE_EXPERIMENT_RESULTS);
      const resultsQuery: Record<string, any> = { experimentId: id };
      applyTenancyFilter(resultsQuery, filters);
      await resultsCollection.deleteMany(resultsQuery);

      const parentDeleteQuery: Record<string, any> = { id };
      applyTenancyFilter(parentDeleteQuery, filters);
      await experimentsCollection.deleteOne(parentDeleteQuery);
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
      organizationId: input.organizationId ?? null,
      projectId: input.projectId ?? null,
      input: input.input,
      output: input.output ?? null,
      groundTruth: input.groundTruth ?? null,
      error: input.error ?? null,
      executionStatus: input.executionStatus ?? null,
      startedAt: input.startedAt,
      completedAt: input.completedAt,
      retryCount: input.retryCount,
      traceId: input.traceId ?? null,
      status: input.status ?? null,
      tags: input.tags ?? null,
      toolMockReport: input.toolMockReport ?? null,
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
        organizationId: input.organizationId ?? null,
        projectId: input.projectId ?? null,
        input: input.input,
        output: input.output ?? null,
        groundTruth: input.groundTruth ?? null,
        error: input.error ?? null,
        executionStatus: input.executionStatus ?? null,
        startedAt: input.startedAt,
        completedAt: input.completedAt,
        retryCount: input.retryCount,
        traceId: input.traceId ?? null,
        status: input.status ?? null,
        tags: input.tags ?? null,
        toolMockReport: input.toolMockReport ?? null,
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

  async getExperimentResultById({
    id,
    filters,
  }: {
    id: string;
    filters?: ExperimentTenancyFilters;
  }): Promise<ExperimentResult | null> {
    try {
      const collection = await this.getCollection(TABLE_EXPERIMENT_RESULTS);
      const query: Record<string, any> = { id };
      applyTenancyFilter(query, filters);
      const doc = await collection.findOne(query);
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
      if (args.filters) {
        const { organizationId, projectId } = args.filters;
        if (organizationId !== undefined) {
          filter.organizationId = organizationId;
        }
        if (projectId !== undefined) {
          filter.projectId = projectId;
        }
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

  async deleteExperimentResults({
    experimentId,
    filters,
  }: {
    experimentId: string;
    filters?: ExperimentTenancyFilters;
  }): Promise<void> {
    try {
      // Tenancy predicate applied on the destructive deleteMany itself. Result
      // rows carry organizationId/projectId of the owning experiment. Silent
      // no-op on mismatch.
      if (filters?.organizationId !== undefined || filters?.projectId !== undefined) {
        const experimentsCollection = await this.getCollection(TABLE_EXPERIMENTS);
        const gateQuery: Record<string, any> = { id: experimentId };
        applyTenancyFilter(gateQuery, filters);
        const parent = await experimentsCollection.findOne(gateQuery);
        if (!parent) return;
      }
      const collection = await this.getCollection(TABLE_EXPERIMENT_RESULTS);
      const deleteQuery: Record<string, any> = { experimentId };
      applyTenancyFilter(deleteQuery, filters);
      await collection.deleteMany(deleteQuery);
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
