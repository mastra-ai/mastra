import { randomUUID } from 'node:crypto';

import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  DatasetsStorage,
  TABLE_DATASETS,
  TABLE_DATASET_ITEMS,
  TABLE_DATASET_VERSIONS,
  TABLE_EXPERIMENTS,
  TABLE_EXPERIMENT_RESULTS,
  createStorageErrorId,
  normalizePerPage,
  calculatePagination,
  safelyParseJSON,
  ensureDate,
  hasErrorCode,
} from '@mastra/core/storage';
import type {
  DatasetRecord,
  DatasetItem,
  DatasetItemRow,
  DatasetVersion,
  CreateDatasetInput,
  UpdateDatasetInput,
  AddDatasetItemInput,
  UpdateDatasetItemInput,
  DeleteDatasetItemInput,
  ListDatasetsInput,
  ListDatasetsOutput,
  ListDatasetItemsInput,
  ListDatasetItemsOutput,
  ListDatasetVersionsInput,
  ListDatasetVersionsOutput,
  BatchInsertItemsInput,
  BatchDeleteItemsInput,
  DatasetTenancyFilters,
} from '@mastra/core/storage';

import type { Collection } from 'mongodb';

import type { MongoDBConnector } from '../../connectors/MongoDBConnector';
import { resolveMongoDBConfig } from '../../db';
import type { MongoDBDomainConfig, MongoDBIndexConfig } from '../../types';
import { applyTenancyFilter } from '../utils';

const MANAGED_COLLECTIONS = [TABLE_DATASETS, TABLE_DATASET_ITEMS, TABLE_DATASET_VERSIONS] as const;

export class MongoDBDatasetsStorage extends DatasetsStorage {
  #connector: MongoDBConnector;
  #skipDefaultIndexes: boolean;
  #indexes: MongoDBIndexConfig[];

  constructor(config: MongoDBDomainConfig) {
    super();
    this.#connector = resolveMongoDBConfig(config);
    this.#skipDefaultIndexes = config.skipDefaultIndexes ?? false;
    this.#indexes = (config.indexes ?? []).filter(i =>
      (MANAGED_COLLECTIONS as readonly string[]).includes(i.collection),
    );
  }

  private getCollection(name: string): Promise<Collection> {
    return this.#connector.getCollection(name);
  }

  // --- Index management ---

  getDefaultIndexDefinitions(): MongoDBIndexConfig[] {
    return [
      { collection: TABLE_DATASETS, keys: { id: 1 }, options: { name: 'idx_datasets_id', unique: true } },
      { collection: TABLE_DATASETS, keys: { createdAt: -1, id: 1 }, options: { name: 'idx_datasets_createdat_id' } },
      {
        collection: TABLE_DATASETS,
        keys: { organizationId: 1, projectId: 1, createdAt: -1, id: 1 },
        options: { name: 'idx_datasets_tenancy_createdat_id' },
      },
      {
        collection: TABLE_DATASETS,
        keys: { organizationId: 1, projectId: 1, candidateKey: 1, candidateId: 1 },
        options: { name: 'idx_datasets_tenancy_candidate' },
      },
      { collection: TABLE_DATASET_ITEMS, keys: { datasetId: 1 }, options: { name: 'idx_dataset_items_datasetid' } },
      {
        collection: TABLE_DATASET_ITEMS,
        keys: { organizationId: 1, projectId: 1, datasetId: 1, validTo: 1, isDeleted: 1 },
        options: { name: 'idx_dataset_items_tenancy_list' },
      },
      {
        collection: TABLE_DATASET_ITEMS,
        keys: { datasetId: 1, validTo: 1 },
        options: { name: 'idx_dataset_items_datasetid_validto' },
      },
      {
        collection: TABLE_DATASET_ITEMS,
        keys: { datasetId: 1, isDeleted: 1 },
        options: { name: 'idx_dataset_items_datasetid_isdeleted' },
      },
      {
        collection: TABLE_DATASET_ITEMS,
        keys: { id: 1, validTo: 1 },
        options: { name: 'idx_dataset_items_id_validto' },
      },
      {
        collection: TABLE_DATASET_ITEMS,
        keys: { datasetId: 1, datasetVersion: 1 },
        options: { name: 'idx_dataset_items_datasetid_version' },
      },
      {
        collection: TABLE_DATASET_ITEMS,
        keys: { datasetId: 1, externalId: 1, datasetVersion: 1 },
        options: { name: 'idx_dataset_items_datasetid_externalid_version', sparse: true },
      },
      {
        collection: TABLE_DATASET_ITEMS,
        keys: { datasetId: 1, validTo: 1, isDeleted: 1, createdAt: -1, id: 1 },
        options: { name: 'idx_dataset_items_list' },
      },
      {
        collection: TABLE_DATASET_VERSIONS,
        keys: { datasetId: 1 },
        options: { name: 'idx_dataset_versions_datasetid' },
      },
      {
        collection: TABLE_DATASET_VERSIONS,
        keys: { datasetId: 1, version: 1 },
        options: { name: 'idx_dataset_versions_datasetid_version', unique: true },
      },
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

  // --- Row transformations ---

  private transformDatasetRow(row: Record<string, any>): DatasetRecord {
    return {
      id: row.id,
      name: row.name,
      description: row.description ?? undefined,
      metadata: typeof row.metadata === 'string' ? safelyParseJSON(row.metadata) : (row.metadata ?? undefined),
      inputSchema: typeof row.inputSchema === 'string' ? safelyParseJSON(row.inputSchema) : row.inputSchema,
      groundTruthSchema:
        typeof row.groundTruthSchema === 'string' ? safelyParseJSON(row.groundTruthSchema) : row.groundTruthSchema,
      requestContextSchema:
        typeof row.requestContextSchema === 'string'
          ? safelyParseJSON(row.requestContextSchema)
          : row.requestContextSchema,
      tags: typeof row.tags === 'string' ? safelyParseJSON(row.tags) : (row.tags ?? undefined),
      targetType: row.targetType ?? undefined,
      targetIds: typeof row.targetIds === 'string' ? safelyParseJSON(row.targetIds) : (row.targetIds ?? undefined),
      scorerIds: typeof row.scorerIds === 'string' ? safelyParseJSON(row.scorerIds) : (row.scorerIds ?? undefined),
      version: row.version ?? 0,
      organizationId: row.organizationId ?? null,
      projectId: row.projectId ?? null,
      candidateKey: row.candidateKey ?? null,
      candidateId: row.candidateId ?? null,
      createdAt: ensureDate(row.createdAt)!,
      updatedAt: ensureDate(row.updatedAt)!,
    };
  }

  private transformItemRow(row: Record<string, any>): DatasetItem {
    return {
      id: row.id,
      datasetId: row.datasetId,
      datasetVersion: row.datasetVersion,
      externalId: row.externalId ?? null,
      organizationId: row.organizationId ?? null,
      projectId: row.projectId ?? null,
      input: typeof row.input === 'string' ? safelyParseJSON(row.input) : row.input,
      groundTruth: typeof row.groundTruth === 'string' ? safelyParseJSON(row.groundTruth) : row.groundTruth,
      expectedTrajectory:
        typeof row.expectedTrajectory === 'string' ? safelyParseJSON(row.expectedTrajectory) : row.expectedTrajectory,
      toolMocks: (typeof row.toolMocks === 'string' ? safelyParseJSON(row.toolMocks) : row.toolMocks) ?? undefined,
      timeout: row.timeout == null ? undefined : Number(row.timeout),
      requestContext: typeof row.requestContext === 'string' ? safelyParseJSON(row.requestContext) : row.requestContext,
      metadata: typeof row.metadata === 'string' ? safelyParseJSON(row.metadata) : row.metadata,
      source: typeof row.source === 'string' ? safelyParseJSON(row.source) : row.source,
      createdAt: ensureDate(row.createdAt)!,
      updatedAt: ensureDate(row.updatedAt)!,
    };
  }

  private transformItemRowFull(row: Record<string, any>): DatasetItemRow {
    return {
      ...this.transformItemRow(row),
      validTo: row.validTo ?? null,
      isDeleted: row.isDeleted ?? false,
    };
  }

  private transformDatasetVersionRow(row: Record<string, any>): DatasetVersion {
    return {
      id: row.id,
      datasetId: row.datasetId,
      version: row.version,
      createdAt: ensureDate(row.createdAt)!,
    };
  }

  // --- Dataset CRUD ---

  async createDataset(input: CreateDatasetInput): Promise<DatasetRecord> {
    try {
      const id = input.id ?? randomUUID();
      if (input.id !== undefined) this.validateCallerDefinedDatasetId(input.id);
      const now = new Date();
      const collection = await this.getCollection(TABLE_DATASETS);

      const record = {
        id,
        name: input.name,
        description: input.description ?? null,
        metadata: input.metadata ?? null,
        inputSchema: input.inputSchema ?? null,
        groundTruthSchema: input.groundTruthSchema ?? null,
        requestContextSchema: input.requestContextSchema ?? null,
        targetType: input.targetType ?? null,
        targetIds: input.targetIds ?? null,
        scorerIds: input.scorerIds ?? null,
        version: 0,
        organizationId: input.organizationId ?? null,
        projectId: input.projectId ?? null,
        candidateKey: input.candidateKey ?? null,
        candidateId: input.candidateId ?? null,
        createdAt: now,
        updatedAt: now,
      };

      await collection.insertOne(record);

      return this.transformDatasetRow(record);
    } catch (error) {
      if (input.id !== undefined && hasErrorCode(error, new Set([11000]))) {
        const existing = await this.getDatasetById({ id: input.id });
        if (existing) return this.resolveExistingDataset(existing, { ...input, id: input.id });
      }
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'CREATE_DATASET', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getDatasetById({
    id,
    filters,
  }: {
    id: string;
    filters?: DatasetTenancyFilters;
  }): Promise<DatasetRecord | null> {
    try {
      const collection = await this.getCollection(TABLE_DATASETS);
      const query: Record<string, any> = { id };
      applyTenancyFilter(query, filters);
      const row = await collection.findOne(query);
      return row ? this.transformDatasetRow(row) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'GET_DATASET', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  protected async _doUpdateDataset(args: UpdateDatasetInput): Promise<DatasetRecord> {
    try {
      const existing = await this.getDatasetById({ id: args.id, filters: args.filters });
      if (!existing) {
        throw new MastraError({
          id: createStorageErrorId('MONGODB', 'UPDATE_DATASET', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { datasetId: args.id },
        });
      }

      const collection = await this.getCollection(TABLE_DATASETS);
      const now = new Date();
      const updateDoc: Record<string, any> = { updatedAt: now };

      if (args.name !== undefined) updateDoc.name = args.name;
      if (args.description !== undefined) updateDoc.description = args.description;
      if (args.metadata !== undefined) updateDoc.metadata = args.metadata;
      if (args.inputSchema !== undefined) updateDoc.inputSchema = args.inputSchema;
      if (args.groundTruthSchema !== undefined) updateDoc.groundTruthSchema = args.groundTruthSchema;
      if (args.requestContextSchema !== undefined) updateDoc.requestContextSchema = args.requestContextSchema;
      if (args.tags !== undefined) updateDoc.tags = args.tags;
      if (args.targetType !== undefined) updateDoc.targetType = args.targetType;
      if (args.targetIds !== undefined) updateDoc.targetIds = args.targetIds;
      if (args.scorerIds !== undefined) updateDoc.scorerIds = args.scorerIds;

      await collection.updateOne({ id: args.id }, { $set: updateDoc });

      const updated = await this.getDatasetById({ id: args.id });
      return updated!;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'UPDATE_DATASET', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async deleteDataset({ id, filters }: { id: string; filters?: DatasetTenancyFilters }): Promise<void> {
    try {
      // Tenancy predicate is applied on the destructive parent deleteOne (not
      // only the pre-check), so a concurrent delete/recreate under a different
      // tenant cannot let a scoped delete hit another tenant's row. Silent
      // no-op on mismatch.
      const datasetsCollectionForGate = await this.getCollection(TABLE_DATASETS);
      const gateQuery: Record<string, any> = { id };
      applyTenancyFilter(gateQuery, filters);
      const gateHit = await datasetsCollectionForGate.findOne(gateQuery, { projection: { id: 1 } });
      if (!gateHit) return;

      // Detach experiments — tolerate missing collections (NamespaceNotFound)
      // but rethrow real operational failures
      try {
        const experimentsCollection = await this.getCollection(TABLE_EXPERIMENTS);
        const experimentIds = await experimentsCollection.find({ datasetId: id }, { projection: { id: 1 } }).toArray();

        if (experimentIds.length > 0) {
          const resultsCollection = await this.getCollection(TABLE_EXPERIMENT_RESULTS);
          await resultsCollection.deleteMany({
            experimentId: { $in: experimentIds.map(e => e.id) },
          });
        }
        await experimentsCollection.updateMany({ datasetId: id }, { $set: { datasetId: null, datasetVersion: null } });
      } catch (e: unknown) {
        // Only swallow NamespaceNotFound (code 26) — collection doesn't exist yet
        const isNamespaceNotFound = e instanceof Error && 'code' in e && (e as { code: number }).code === 26;
        if (!isNamespaceNotFound) throw e;
      }

      // Cascade delete — best-effort, deliberately NOT transactional: dataset
      // items are unbounded, and a transactional deleteMany is capped by
      // transactionLifetimeLimitSeconds (60s default) plus cache pressure, so a
      // large dataset would abort and become permanently undeletable. A plain
      // deleteMany commits incrementally and always completes. The dataset row is
      // deleted last as the linearization point: a crash mid-cascade leaves the
      // dataset re-deletable (deleteMany is idempotent), with only orphaned
      // version/item rows keyed by a datasetId nothing queries as transient residue.
      const versionsCollection = await this.getCollection(TABLE_DATASET_VERSIONS);
      const itemsCollection = await this.getCollection(TABLE_DATASET_ITEMS);
      const datasetsCollection = await this.getCollection(TABLE_DATASETS);

      await versionsCollection.deleteMany({ datasetId: id });
      await itemsCollection.deleteMany({ datasetId: id });
      const parentDeleteQuery: Record<string, any> = { id };
      applyTenancyFilter(parentDeleteQuery, filters);
      await datasetsCollection.deleteOne(parentDeleteQuery);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'DELETE_DATASET', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async listDatasets(args: ListDatasetsInput): Promise<ListDatasetsOutput> {
    try {
      const { page, perPage: perPageInput } = args.pagination;
      const collection = await this.getCollection(TABLE_DATASETS);

      const filter: Record<string, any> = {};
      if (args.filters?.organizationId !== undefined) filter.organizationId = args.filters.organizationId;
      if (args.filters?.projectId !== undefined) filter.projectId = args.filters.projectId;
      if (args.filters?.candidateKey !== undefined) filter.candidateKey = args.filters.candidateKey;
      if (args.filters?.candidateId !== undefined) filter.candidateId = args.filters.candidateId;
      if (args.filters?.targetType !== undefined) filter.targetType = args.filters.targetType;
      if (args.filters?.targetIds !== undefined && args.filters.targetIds.length > 0) {
        // Match documents whose targetIds array contains any of the supplied IDs.
        filter.targetIds = { $in: args.filters.targetIds };
      }
      if (args.filters?.name !== undefined && args.filters.name.length > 0) {
        const escapedName = args.filters.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        filter.name = { $regex: escapedName, $options: 'i' };
      }

      const total = await collection.countDocuments(filter);

      if (total === 0) {
        return { datasets: [], pagination: { total: 0, page, perPage: perPageInput, hasMore: false } };
      }

      const perPage = normalizePerPage(perPageInput, 100);
      const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

      // Handle perPage = 0 edge case (MongoDB limit(0) disables limit)
      if (perPage === 0) {
        return { datasets: [], pagination: { total, page, perPage: perPageForResponse, hasMore: total > 0 } };
      }

      const limitValue = perPageInput === false ? total : perPage;

      const rows = await collection
        .find(filter)
        .sort({ createdAt: -1, id: 1 })
        .skip(offset)
        .limit(limitValue)
        .toArray();

      return {
        datasets: rows.map(row => this.transformDatasetRow(row)),
        pagination: {
          total,
          page,
          perPage: perPageForResponse,
          hasMore: perPageInput === false ? false : offset + perPage < total,
        },
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'LIST_DATASETS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  // --- Item mutations (SCD-2) ---

  protected async _doAddItem(args: AddDatasetItemInput): Promise<DatasetItem> {
    try {
      const id = randomUUID();
      const versionId = randomUUID();
      const now = new Date();

      const datasetsCollection = await this.getCollection(TABLE_DATASETS);
      const itemsCollection = await this.getCollection(TABLE_DATASET_ITEMS);
      const versionsCollection = await this.getCollection(TABLE_DATASET_VERSIONS);

      // Bump version and insert item + dataset_version row atomically
      let newVersion = 0;
      let organizationId: string | null = null;
      let projectId: string | null = null;
      await this.#connector.withTransaction(async session => {
        const result = await datasetsCollection.findOneAndUpdate(
          { id: args.datasetId },
          { $inc: { version: 1 } },
          { session, returnDocument: 'after' },
        );
        if (!result) {
          throw new MastraError({
            id: createStorageErrorId('MONGODB', 'ADD_ITEM', 'DATASET_NOT_FOUND'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            details: { datasetId: args.datasetId },
          });
        }
        newVersion = result.version as number;
        organizationId = (result.organizationId as string | null | undefined) ?? null;
        projectId = (result.projectId as string | null | undefined) ?? null;

        await itemsCollection.insertOne(
          {
            id,
            datasetId: args.datasetId,
            datasetVersion: newVersion,
            organizationId,
            projectId,
            validTo: null,
            isDeleted: false,
            input: args.input,
            groundTruth: args.groundTruth ?? null,
            expectedTrajectory: args.expectedTrajectory ?? null,
            toolMocks: args.toolMocks ?? null,
            timeout: args.timeout ?? null,
            requestContext: args.requestContext ?? null,
            metadata: args.metadata ?? null,
            source: args.source ?? null,
            createdAt: now,
            updatedAt: now,
          },
          { session },
        );

        await versionsCollection.insertOne(
          {
            id: versionId,
            datasetId: args.datasetId,
            version: newVersion,
            createdAt: now,
          },
          { session },
        );
      });

      return {
        id,
        datasetId: args.datasetId,
        datasetVersion: newVersion,
        organizationId,
        projectId,
        input: args.input,
        groundTruth: args.groundTruth,
        expectedTrajectory: args.expectedTrajectory,
        toolMocks: args.toolMocks,
        timeout: args.timeout,
        requestContext: args.requestContext,
        metadata: args.metadata,
        source: args.source,
        createdAt: now,
        updatedAt: now,
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'ADD_ITEM', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  protected async _doUpdateItem(args: UpdateDatasetItemInput): Promise<DatasetItem> {
    try {
      const existing = await this.getItemById({ id: args.id });
      if (!existing) {
        throw new MastraError({
          id: createStorageErrorId('MONGODB', 'UPDATE_ITEM', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { itemId: args.id },
        });
      }
      if (existing.datasetId !== args.datasetId) {
        throw new MastraError({
          id: createStorageErrorId('MONGODB', 'UPDATE_ITEM', 'DATASET_MISMATCH'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { itemId: args.id, expectedDatasetId: args.datasetId, actualDatasetId: existing.datasetId },
        });
      }

      // Short-circuit if no mutable fields are provided
      const hasChanges =
        args.input !== undefined ||
        args.groundTruth !== undefined ||
        args.expectedTrajectory !== undefined ||
        args.toolMocks !== undefined ||
        args.timeout !== undefined ||
        args.requestContext !== undefined ||
        args.metadata !== undefined ||
        args.source !== undefined;

      if (!hasChanges) {
        return existing;
      }

      const now = new Date();
      const versionId = randomUUID();

      const mergedInput = args.input !== undefined ? args.input : existing.input;
      const mergedGroundTruth = args.groundTruth !== undefined ? args.groundTruth : existing.groundTruth;
      const mergedExpectedTrajectory =
        args.expectedTrajectory !== undefined ? args.expectedTrajectory : existing.expectedTrajectory;
      const mergedToolMocks = args.toolMocks !== undefined ? args.toolMocks : existing.toolMocks;
      const mergedTimeout = args.timeout !== undefined ? args.timeout : existing.timeout;
      const mergedRequestContext = args.requestContext !== undefined ? args.requestContext : existing.requestContext;
      const mergedMetadata = args.metadata !== undefined ? args.metadata : existing.metadata;
      const mergedSource = args.source !== undefined ? args.source : existing.source;

      const datasetsCollection = await this.getCollection(TABLE_DATASETS);
      const itemsCollection = await this.getCollection(TABLE_DATASET_ITEMS);
      const versionsCollection = await this.getCollection(TABLE_DATASET_VERSIONS);

      // Bump version, close old row, insert new row, and insert version row atomically
      let newVersion = 0;
      // Tenancy re-inherited from parent dataset (Option B)
      let parentOrganizationId: string | null = null;
      let parentProjectId: string | null = null;
      await this.#connector.withTransaction(async session => {
        const result = await datasetsCollection.findOneAndUpdate(
          { id: args.datasetId },
          { $inc: { version: 1 } },
          { session, returnDocument: 'after' },
        );
        if (!result) {
          throw new MastraError({
            id: createStorageErrorId('MONGODB', 'UPDATE_ITEM', 'DATASET_NOT_FOUND'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            details: { datasetId: args.datasetId },
          });
        }
        newVersion = result.version as number;
        parentOrganizationId = (result.organizationId as string | null | undefined) ?? null;
        parentProjectId = (result.projectId as string | null | undefined) ?? null;

        await itemsCollection.updateOne(
          { id: args.id, validTo: null, isDeleted: false },
          { $set: { validTo: newVersion } },
          { session },
        );

        // Insert new row with merged fields, preserving original createdAt
        await itemsCollection.insertOne(
          {
            id: args.id,
            datasetId: args.datasetId,
            datasetVersion: newVersion,
            externalId: existing.externalId ?? null,
            organizationId: parentOrganizationId,
            projectId: parentProjectId,
            validTo: null,
            isDeleted: false,
            input: mergedInput,
            groundTruth: mergedGroundTruth,
            expectedTrajectory: mergedExpectedTrajectory ?? null,
            toolMocks: mergedToolMocks ?? null,
            timeout: mergedTimeout ?? null,
            requestContext: mergedRequestContext,
            metadata: mergedMetadata,
            source: mergedSource,
            createdAt: existing.createdAt,
            updatedAt: now,
          },
          { session },
        );

        await versionsCollection.insertOne(
          {
            id: versionId,
            datasetId: args.datasetId,
            version: newVersion,
            createdAt: now,
          },
          { session },
        );
      });

      return {
        ...existing,
        datasetVersion: newVersion,
        organizationId: parentOrganizationId,
        projectId: parentProjectId,
        input: mergedInput,
        groundTruth: mergedGroundTruth,
        expectedTrajectory: mergedExpectedTrajectory,
        toolMocks: mergedToolMocks,
        timeout: mergedTimeout,
        requestContext: mergedRequestContext,
        metadata: mergedMetadata,
        source: mergedSource,
        updatedAt: now,
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'UPDATE_ITEM', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  protected async _doDeleteItem({ id, datasetId }: DeleteDatasetItemInput): Promise<void> {
    try {
      const existing = await this.getItemById({ id });
      if (!existing) return; // no-op if not found
      if (existing.datasetId !== datasetId) {
        throw new MastraError({
          id: createStorageErrorId('MONGODB', 'DELETE_ITEM', 'DATASET_MISMATCH'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { itemId: id, expectedDatasetId: datasetId, actualDatasetId: existing.datasetId },
        });
      }

      const now = new Date();
      const versionId = randomUUID();

      const datasetsCollection = await this.getCollection(TABLE_DATASETS);
      const itemsCollection = await this.getCollection(TABLE_DATASET_ITEMS);
      const versionsCollection = await this.getCollection(TABLE_DATASET_VERSIONS);

      // Bump version, close old row, insert tombstone, and insert version row atomically
      await this.#connector.withTransaction(async session => {
        const result = await datasetsCollection.findOneAndUpdate(
          { id: datasetId },
          { $inc: { version: 1 } },
          { session, returnDocument: 'after' },
        );
        if (!result) {
          throw new MastraError({
            id: createStorageErrorId('MONGODB', 'DELETE_ITEM', 'DATASET_NOT_FOUND'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            details: { datasetId },
          });
        }
        const newVersion = result.version as number;
        // Tenancy re-inherited from parent dataset (Option B)
        const parentOrganizationId = (result.organizationId as string | null | undefined) ?? null;
        const parentProjectId = (result.projectId as string | null | undefined) ?? null;

        // Close old row
        await itemsCollection.updateOne(
          { id, validTo: null, isDeleted: false },
          { $set: { validTo: newVersion } },
          { session },
        );

        // Insert tombstone
        await itemsCollection.insertOne(
          {
            id,
            datasetId,
            datasetVersion: newVersion,
            externalId: existing.externalId ?? null,
            organizationId: parentOrganizationId,
            projectId: parentProjectId,
            validTo: null,
            isDeleted: true,
            input: existing.input,
            groundTruth: existing.groundTruth,
            expectedTrajectory: existing.expectedTrajectory ?? null,
            toolMocks: existing.toolMocks ?? null,
            timeout: existing.timeout ?? null,
            requestContext: existing.requestContext,
            metadata: existing.metadata,
            source: existing.source,
            createdAt: existing.createdAt,
            updatedAt: now,
          },
          { session },
        );

        // Insert dataset_version row
        await versionsCollection.insertOne(
          {
            id: versionId,
            datasetId,
            version: newVersion,
            createdAt: now,
          },
          { session },
        );
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'DELETE_ITEM', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  // --- Batch operations ---

  protected async _doBatchInsertItems(input: BatchInsertItemsInput): Promise<DatasetItem[]> {
    try {
      if (input.items.length === 0) return [];

      const externalIds = [...new Set(input.items.flatMap(item => (item.externalId ? [item.externalId] : [])))];
      if (externalIds.length > 0 && !(await this.#connector.supportsTransactions())) {
        throw new MastraError({
          id: 'DATASET_ITEM_IDENTITY_REQUIRES_TRANSACTIONS',
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { datasetId: input.datasetId },
        });
      }

      const datasetsCollection = await this.getCollection(TABLE_DATASETS);
      const itemsCollection = await this.getCollection(TABLE_DATASET_ITEMS);
      const versionsCollection = await this.getCollection(TABLE_DATASET_VERSIONS);
      let resolvedItems: DatasetItem[] = [];

      await this.#connector.withTransaction(async session => {
        const dataset = await datasetsCollection.findOneAndUpdate(
          { id: input.datasetId },
          { $inc: { identityRevision: 1 } },
          { session, returnDocument: 'after' },
        );
        if (!dataset) {
          throw new MastraError({
            id: createStorageErrorId('MONGODB', 'BULK_ADD_ITEMS', 'DATASET_NOT_FOUND'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            details: { datasetId: input.datasetId },
          });
        }

        const historyRows =
          externalIds.length === 0
            ? []
            : await itemsCollection
                .find({ datasetId: input.datasetId, externalId: { $in: externalIds } }, { session })
                .sort({ datasetVersion: 1 })
                .toArray();
        const plan = this.planDatasetItemBatch(
          input.items,
          historyRows.map(row => this.transformItemRowFull(row)),
          randomUUID,
        );
        const resolved = new Map<string, DatasetItem>(
          [...plan.existingCurrentItems].map(([id, row]) => [id, this.datasetItemFromRow(row)]),
        );

        if (plan.inserts.length > 0) {
          const now = new Date();
          const newVersion = Number(dataset.version) + 1;
          await datasetsCollection.updateOne(
            { id: input.datasetId },
            { $set: { version: newVersion, updatedAt: now } },
            { session },
          );
          for (const insert of plan.inserts) {
            const item: DatasetItem = {
              id: insert.id,
              datasetId: input.datasetId,
              datasetVersion: newVersion,
              externalId: insert.item.externalId ?? null,
              organizationId: dataset.organizationId ?? null,
              projectId: dataset.projectId ?? null,
              input: insert.item.input,
              groundTruth: insert.item.groundTruth,
              expectedTrajectory: insert.item.expectedTrajectory,
              toolMocks: insert.item.toolMocks,
              timeout: insert.item.timeout,
              requestContext: insert.item.requestContext,
              metadata: insert.item.metadata,
              source: insert.item.source,
              createdAt: now,
              updatedAt: now,
            };
            await itemsCollection.insertOne({ ...item, validTo: null, isDeleted: false }, { session });
            resolved.set(item.id, item);
          }
          await versionsCollection.insertOne(
            { id: randomUUID(), datasetId: input.datasetId, version: newVersion, createdAt: now },
            { session },
          );
        }

        resolvedItems = plan.resolvedIds.map(id => resolved.get(id)!);
      });

      return resolvedItems;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'BULK_ADD_ITEMS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  protected async _doBatchDeleteItems(input: BatchDeleteItemsInput): Promise<void> {
    try {
      const dataset = await this.getDatasetById({ id: input.datasetId });
      if (!dataset) {
        throw new MastraError({
          id: createStorageErrorId('MONGODB', 'BULK_DELETE_ITEMS', 'DATASET_NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { datasetId: input.datasetId },
        });
      }

      const itemsCollection = await this.getCollection(TABLE_DATASET_ITEMS);

      // Fetch current items in one query instead of sequential lookups
      const currentRows = await itemsCollection
        .find({
          id: { $in: input.itemIds },
          datasetId: input.datasetId,
          validTo: null,
          isDeleted: false,
        })
        .toArray();
      const currentItems = currentRows.map(row => this.transformItemRow(row));
      if (currentItems.length === 0) return;

      const now = new Date();
      const versionId = randomUUID();

      const datasetsCollection = await this.getCollection(TABLE_DATASETS);
      const versionsCollection = await this.getCollection(TABLE_DATASET_VERSIONS);

      // Close old rows, insert tombstones, and record version — all atomic including the version bump
      const currentIds = currentItems.map(i => i.id);
      await this.#connector.withTransaction(async session => {
        const result = await datasetsCollection.findOneAndUpdate(
          { id: input.datasetId },
          { $inc: { version: 1 } },
          { session, returnDocument: 'after' },
        );
        if (!result) {
          throw new MastraError({
            id: createStorageErrorId('MONGODB', 'BULK_DELETE_ITEMS', 'DATASET_NOT_FOUND'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            details: { datasetId: input.datasetId },
          });
        }
        const newVersion = result.version as number;
        // Tenancy re-inherited from parent dataset (Option B)
        const parentOrganizationId = (result.organizationId as string | null | undefined) ?? null;
        const parentProjectId = (result.projectId as string | null | undefined) ?? null;

        const tombstones = currentItems.map(item => ({
          id: item.id,
          datasetId: input.datasetId,
          datasetVersion: newVersion,
          externalId: item.externalId ?? null,
          organizationId: parentOrganizationId,
          projectId: parentProjectId,
          validTo: null,
          isDeleted: true,
          input: item.input,
          groundTruth: item.groundTruth,
          expectedTrajectory: item.expectedTrajectory ?? null,
          toolMocks: item.toolMocks ?? null,
          timeout: item.timeout ?? null,
          requestContext: item.requestContext,
          metadata: item.metadata,
          source: item.source,
          createdAt: item.createdAt,
          updatedAt: now,
        }));

        // Close old rows in batch
        await itemsCollection.updateMany(
          { id: { $in: currentIds }, validTo: null, isDeleted: false },
          { $set: { validTo: newVersion } },
          { session },
        );

        // Insert tombstones in batch
        await itemsCollection.insertMany(tombstones, { session });

        // Single dataset_version row
        await versionsCollection.insertOne(
          {
            id: versionId,
            datasetId: input.datasetId,
            version: newVersion,
            createdAt: now,
          },
          { session },
        );
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'BULK_DELETE_ITEMS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  // --- SCD-2 queries ---

  async getItemById(args: { id: string; datasetVersion?: number }): Promise<DatasetItem | null> {
    try {
      const collection = await this.getCollection(TABLE_DATASET_ITEMS);

      let row;
      if (args.datasetVersion !== undefined) {
        // SCD-2 window predicate: find the row whose version range includes the requested version
        row = await collection.findOne(
          {
            id: args.id,
            datasetVersion: { $lte: args.datasetVersion },
            $or: [{ validTo: null }, { validTo: { $gt: args.datasetVersion } }],
            isDeleted: false,
          },
          { sort: { datasetVersion: -1 } },
        );
      } else {
        row = await collection.findOne({
          id: args.id,
          validTo: null,
          isDeleted: false,
        });
      }

      return row ? this.transformItemRow(row) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'GET_ITEM', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getItemsByVersion({ datasetId, version }: { datasetId: string; version: number }): Promise<DatasetItem[]> {
    try {
      const collection = await this.getCollection(TABLE_DATASET_ITEMS);
      const rows = await collection
        .find({
          datasetId,
          datasetVersion: { $lte: version },
          $or: [{ validTo: null }, { validTo: { $gt: version } }],
          isDeleted: false,
        })
        .sort({ createdAt: -1, id: 1 })
        .toArray();

      return rows.map(row => this.transformItemRow(row));
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'GET_ITEMS_BY_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getItemHistory(itemId: string): Promise<DatasetItemRow[]> {
    try {
      const collection = await this.getCollection(TABLE_DATASET_ITEMS);
      const rows = await collection.find({ id: itemId }).sort({ datasetVersion: -1 }).toArray();
      return rows.map(row => this.transformItemRowFull(row));
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'GET_ITEM_HISTORY', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async listItems(args: ListDatasetItemsInput): Promise<ListDatasetItemsOutput> {
    try {
      const { page, perPage: perPageInput } = args.pagination;
      const collection = await this.getCollection(TABLE_DATASET_ITEMS);

      // Build filter
      const filter: Record<string, any> = { datasetId: args.datasetId };
      if (args.filters?.organizationId !== undefined) filter.organizationId = args.filters.organizationId;
      if (args.filters?.projectId !== undefined) filter.projectId = args.filters.projectId;

      if (args.version !== undefined) {
        // SCD-2 time-travel
        filter.datasetVersion = { $lte: args.version };
        filter.$or = [{ validTo: null }, { validTo: { $gt: args.version } }];
        filter.isDeleted = false;
      } else {
        // Current items only
        filter.validTo = null;
        filter.isDeleted = false;
      }

      if (args.search) {
        const escaped = args.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escaped, 'i');
        // Use $convert with onError/onNull to safely handle any BSON type.
        // $toString crashes on objects/arrays; $convert falls back to '' for unsupported types.
        // This means search only matches string-valued input fields; for object inputs,
        // a text index or materialized field would be needed for deeper search.
        const safeStr = (field: string) => ({
          $convert: { input: field, to: 'string', onError: '', onNull: '' },
        });
        const searchCondition = [{ $expr: { $regexMatch: { input: safeStr('$input'), regex } } }];
        if (filter.$or) {
          filter.$and = [{ $or: filter.$or }, { $or: searchCondition }];
          delete filter.$or;
        } else {
          filter.$or = searchCondition;
        }
      }

      const total = await collection.countDocuments(filter);

      if (total === 0) {
        return { items: [], pagination: { total: 0, page, perPage: perPageInput, hasMore: false } };
      }

      const perPage = normalizePerPage(perPageInput, 100);
      const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

      // Handle perPage = 0 edge case (MongoDB limit(0) disables limit)
      if (perPage === 0) {
        return { items: [], pagination: { total, page, perPage: perPageForResponse, hasMore: total > 0 } };
      }

      const limitValue = perPageInput === false ? total : perPage;

      const rows = await collection
        .find(filter)
        .sort({ createdAt: -1, id: 1 })
        .skip(offset)
        .limit(limitValue)
        .toArray();

      return {
        items: rows.map(row => this.transformItemRow(row)),
        pagination: {
          total,
          page,
          perPage: perPageForResponse,
          hasMore: perPageInput === false ? false : offset + perPage < total,
        },
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'LIST_ITEMS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  // --- Dataset versions ---

  async createDatasetVersion(datasetId: string, version: number): Promise<DatasetVersion> {
    try {
      const id = randomUUID();
      const now = new Date();
      const collection = await this.getCollection(TABLE_DATASET_VERSIONS);

      await collection.insertOne({ id, datasetId, version, createdAt: now });

      return { id, datasetId, version, createdAt: now };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'CREATE_DATASET_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async listDatasetVersions(input: ListDatasetVersionsInput): Promise<ListDatasetVersionsOutput> {
    try {
      const { page, perPage: perPageInput } = input.pagination;
      const collection = await this.getCollection(TABLE_DATASET_VERSIONS);
      const filter = { datasetId: input.datasetId };

      const total = await collection.countDocuments(filter);

      if (total === 0) {
        return { versions: [], pagination: { total: 0, page, perPage: perPageInput, hasMore: false } };
      }

      const perPage = normalizePerPage(perPageInput, 100);
      const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

      // Handle perPage = 0 edge case (MongoDB limit(0) disables limit)
      if (perPage === 0) {
        return { versions: [], pagination: { total, page, perPage: perPageForResponse, hasMore: total > 0 } };
      }

      const limitValue = perPageInput === false ? total : perPage;

      const rows = await collection.find(filter).sort({ version: -1 }).skip(offset).limit(limitValue).toArray();

      return {
        versions: rows.map(row => this.transformDatasetVersionRow(row)),
        pagination: {
          total,
          page,
          perPage: perPageForResponse,
          hasMore: perPageInput === false ? false : offset + perPage < total,
        },
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'LIST_DATASET_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  // --- Clear all ---

  async dangerouslyClearAll(): Promise<void> {
    const datasetsCollection = await this.getCollection(TABLE_DATASETS);
    const itemsCollection = await this.getCollection(TABLE_DATASET_ITEMS);
    const versionsCollection = await this.getCollection(TABLE_DATASET_VERSIONS);

    const results = await Promise.allSettled([
      datasetsCollection.deleteMany({}),
      itemsCollection.deleteMany({}),
      versionsCollection.deleteMany({}),
    ]);

    const failures = results.filter(r => r.status === 'rejected');
    if (failures.length > 0) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'CLEAR_ALL', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { failedCollections: failures.length },
        },
        (failures[0] as PromiseRejectedResult).reason,
      );
    }
  }
}
