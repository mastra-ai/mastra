import { randomUUID } from 'node:crypto';

import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  ScorerDefinitionsStorage,
  createStorageErrorId,
  TABLE_SCORER_DEFINITIONS,
  TABLE_SCORER_DEFINITION_VERSIONS,
  normalizePerPage,
  calculatePagination,
} from '@mastra/core/storage';
import type {
  StorageScorerDefinitionType,
  StorageCreateScorerDefinitionInput,
  StorageUpdateScorerDefinitionInput,
  StorageListScorerDefinitionsInput,
  StorageListScorerDefinitionsOutput,
} from '@mastra/core/storage';
import type {
  ScorerDefinitionVersion,
  CreateScorerDefinitionVersionInput,
  ListScorerDefinitionVersionsInput,
  ListScorerDefinitionVersionsOutput,
} from '@mastra/core/storage/domains/scorer-definitions';
import type { MongoDBConnector } from '../../connectors/MongoDBConnector';
import { resolveMongoDBConfig } from '../../db';
import type { MongoDBDomainConfig, MongoDBIndexConfig } from '../../types';

/**
 * Snapshot config fields that live on scorer definition version documents.
 */
const SNAPSHOT_FIELDS = [
  'name',
  'description',
  'type',
  'model',
  'instructions',
  'scoreRange',
  'presetConfig',
  'defaultSampling',
] as const;

export class MongoDBScorerDefinitionsStorage extends ScorerDefinitionsStorage {
  #connector: MongoDBConnector;
  #skipDefaultIndexes?: boolean;
  #indexes?: MongoDBIndexConfig[];

  static readonly MANAGED_COLLECTIONS = [TABLE_SCORER_DEFINITIONS, TABLE_SCORER_DEFINITION_VERSIONS] as const;

  constructor(config: MongoDBDomainConfig) {
    super();
    this.#connector = resolveMongoDBConfig(config);
    this.#skipDefaultIndexes = config.skipDefaultIndexes;
    this.#indexes = config.indexes?.filter(idx =>
      (MongoDBScorerDefinitionsStorage.MANAGED_COLLECTIONS as readonly string[]).includes(idx.collection),
    );
  }

  private async getCollection(name: string) {
    return this.#connector.getCollection(name);
  }

  getDefaultIndexDefinitions(): MongoDBIndexConfig[] {
    return [
      { collection: TABLE_SCORER_DEFINITIONS, keys: { id: 1 }, options: { unique: true } },
      { collection: TABLE_SCORER_DEFINITIONS, keys: { createdAt: -1 } },
      { collection: TABLE_SCORER_DEFINITIONS, keys: { updatedAt: -1 } },
      { collection: TABLE_SCORER_DEFINITIONS, keys: { authorId: 1 } },
      { collection: TABLE_SCORER_DEFINITION_VERSIONS, keys: { id: 1 }, options: { unique: true } },
      {
        collection: TABLE_SCORER_DEFINITION_VERSIONS,
        keys: { scorerDefinitionId: 1, versionNumber: -1 },
        options: { unique: true },
      },
      { collection: TABLE_SCORER_DEFINITION_VERSIONS, keys: { scorerDefinitionId: 1, createdAt: -1 } },
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
        this.logger?.warn?.(`Failed to create index on ${indexDef.collection}:`, error);
      }
    }
  }

  async createCustomIndexes(): Promise<void> {
    if (!this.#indexes || this.#indexes.length === 0) {
      return;
    }

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

  async dangerouslyClearAll(): Promise<void> {
    const versionsCollection = await this.getCollection(TABLE_SCORER_DEFINITION_VERSIONS);
    await versionsCollection.deleteMany({});
    const scorerDefinitionsCollection = await this.getCollection(TABLE_SCORER_DEFINITIONS);
    await scorerDefinitionsCollection.deleteMany({});
  }

  // ==========================================================================
  // Scorer Definition CRUD
  // ==========================================================================

  async getById(id: string): Promise<StorageScorerDefinitionType | null> {
    try {
      const collection = await this.getCollection(TABLE_SCORER_DEFINITIONS);
      const result = await collection.findOne<any>({ id });

      if (!result) {
        return null;
      }

      return this.transformScorerDefinition(result);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'GET_SCORER_DEFINITION_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id },
        },
        error,
      );
    }
  }

  async create(input: { scorerDefinition: StorageCreateScorerDefinitionInput }): Promise<StorageScorerDefinitionType> {
    const { scorerDefinition } = input;
    try {
      const collection = await this.getCollection(TABLE_SCORER_DEFINITIONS);

      // Check if scorer definition already exists
      const existing = await collection.findOne({ id: scorerDefinition.id });
      if (existing) {
        throw new MastraError({
          id: createStorageErrorId('MONGODB', 'CREATE_SCORER_DEFINITION', 'ALREADY_EXISTS'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { id: scorerDefinition.id },
          text: `Scorer definition with id ${scorerDefinition.id} already exists`,
        });
      }

      const now = new Date();

      // Create thin scorer definition record
      const newScorerDefinition: StorageScorerDefinitionType = {
        id: scorerDefinition.id,
        status: 'draft',
        activeVersionId: undefined,
        authorId: scorerDefinition.authorId,
        metadata: scorerDefinition.metadata,
        createdAt: now,
        updatedAt: now,
      };

      await collection.insertOne(this.serializeScorerDefinition(newScorerDefinition));

      // Extract snapshot config from flat input
      const snapshotConfig: Record<string, any> = {};
      for (const field of SNAPSHOT_FIELDS) {
        if ((scorerDefinition as any)[field] !== undefined) {
          snapshotConfig[field] = (scorerDefinition as any)[field];
        }
      }

      // Create version 1
      const versionId = randomUUID();
      await this.createVersion({
        id: versionId,
        scorerDefinitionId: scorerDefinition.id,
        versionNumber: 1,
        ...snapshotConfig,
        changedFields: Object.keys(snapshotConfig),
        changeMessage: 'Initial version',
      } as CreateScorerDefinitionVersionInput);

      return newScorerDefinition;
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'CREATE_SCORER_DEFINITION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id: scorerDefinition.id },
        },
        error,
      );
    }
  }

  async update(input: StorageUpdateScorerDefinitionInput): Promise<StorageScorerDefinitionType> {
    const { id, ...updates } = input;
    try {
      const collection = await this.getCollection(TABLE_SCORER_DEFINITIONS);

      const existingScorerDefinition = await collection.findOne<any>({ id });
      if (!existingScorerDefinition) {
        throw new MastraError({
          id: createStorageErrorId('MONGODB', 'UPDATE_SCORER_DEFINITION', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { id },
          text: `Scorer definition with id ${id} not found`,
        });
      }

      const updateDoc: Record<string, any> = {
        updatedAt: new Date(),
      };

      // Metadata-level fields
      const metadataFields = {
        authorId: updates.authorId,
        activeVersionId: updates.activeVersionId,
        metadata: updates.metadata,
        status: updates.status,
      };

      // Handle metadata-level updates
      if (metadataFields.authorId !== undefined) updateDoc.authorId = metadataFields.authorId;
      if (metadataFields.activeVersionId !== undefined) {
        updateDoc.activeVersionId = metadataFields.activeVersionId;
      }
      if (metadataFields.status !== undefined) {
        updateDoc.status = metadataFields.status;
      }

      // Merge metadata
      if (metadataFields.metadata !== undefined) {
        const existingMetadata = existingScorerDefinition.metadata || {};
        updateDoc.metadata = { ...existingMetadata, ...metadataFields.metadata };
      }

      await collection.updateOne({ id }, { $set: updateDoc });

      const updatedScorerDefinition = await collection.findOne<any>({ id });
      if (!updatedScorerDefinition) {
        throw new MastraError({
          id: createStorageErrorId('MONGODB', 'UPDATE_SCORER_DEFINITION', 'NOT_FOUND_AFTER_UPDATE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.SYSTEM,
          text: `Scorer definition with id ${id} was deleted during update`,
          details: { id },
        });
      }
      return this.transformScorerDefinition(updatedScorerDefinition);
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'UPDATE_SCORER_DEFINITION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id },
        },
        error,
      );
    }
  }

  async delete(id: string): Promise<void> {
    try {
      // Delete all versions first
      await this.deleteVersionsByParentId(id);

      // Then delete the scorer definition
      const collection = await this.getCollection(TABLE_SCORER_DEFINITIONS);
      await collection.deleteOne({ id });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'DELETE_SCORER_DEFINITION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id },
        },
        error,
      );
    }
  }

  async list(args?: StorageListScorerDefinitionsInput): Promise<StorageListScorerDefinitionsOutput> {
    try {
      const { page = 0, perPage: perPageInput, orderBy, authorId, metadata, status } = args || {};
      const { field, direction } = this.parseOrderBy(orderBy);

      if (page < 0) {
        throw new MastraError(
          {
            id: createStorageErrorId('MONGODB', 'LIST_SCORER_DEFINITIONS', 'INVALID_PAGE'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            details: { page },
          },
          new Error('page must be >= 0'),
        );
      }

      const perPage = normalizePerPage(perPageInput, 100);
      const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

      const collection = await this.getCollection(TABLE_SCORER_DEFINITIONS);

      // Build filter
      const filter: Record<string, any> = {};
      if (status) {
        filter.status = status;
      }
      if (authorId) {
        filter.authorId = authorId;
      }
      if (metadata) {
        for (const [key, value] of Object.entries(metadata)) {
          filter[`metadata.${key}`] = value;
        }
      }

      const total = await collection.countDocuments(filter);

      if (total === 0 || perPage === 0) {
        return {
          scorerDefinitions: [],
          total,
          page,
          perPage: perPageForResponse,
          hasMore: false,
        };
      }

      const sortOrder = direction === 'ASC' ? 1 : -1;

      let cursor = collection
        .find(filter)
        .sort({ [field]: sortOrder })
        .skip(offset);

      if (perPageInput !== false) {
        cursor = cursor.limit(perPage);
      }

      const results = await cursor.toArray();
      const scorerDefinitions = results.map((doc: any) => this.transformScorerDefinition(doc));

      return {
        scorerDefinitions,
        total,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput !== false && offset + perPage < total,
      };
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'LIST_SCORER_DEFINITIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  // ==========================================================================
  // Scorer Definition Version Methods
  // ==========================================================================

  async createVersion(input: CreateScorerDefinitionVersionInput): Promise<ScorerDefinitionVersion> {
    try {
      const collection = await this.getCollection(TABLE_SCORER_DEFINITION_VERSIONS);
      const now = new Date();

      const versionDoc: Record<string, any> = {
        id: input.id,
        scorerDefinitionId: input.scorerDefinitionId,
        versionNumber: input.versionNumber,
        changedFields: input.changedFields ?? undefined,
        changeMessage: input.changeMessage ?? undefined,
        createdAt: now,
      };

      // Copy snapshot fields
      for (const field of SNAPSHOT_FIELDS) {
        if ((input as any)[field] !== undefined) {
          versionDoc[field] = (input as any)[field];
        }
      }

      await collection.insertOne(versionDoc);

      return {
        ...input,
        createdAt: now,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'CREATE_SCORER_DEFINITION_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { versionId: input.id, scorerDefinitionId: input.scorerDefinitionId },
        },
        error,
      );
    }
  }

  async getVersion(id: string): Promise<ScorerDefinitionVersion | null> {
    try {
      const collection = await this.getCollection(TABLE_SCORER_DEFINITION_VERSIONS);
      const result = await collection.findOne<any>({ id });

      if (!result) {
        return null;
      }

      return this.transformVersion(result);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'GET_SCORER_DEFINITION_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { versionId: id },
        },
        error,
      );
    }
  }

  async getVersionByNumber(scorerDefinitionId: string, versionNumber: number): Promise<ScorerDefinitionVersion | null> {
    try {
      const collection = await this.getCollection(TABLE_SCORER_DEFINITION_VERSIONS);
      const result = await collection.findOne<any>({ scorerDefinitionId, versionNumber });

      if (!result) {
        return null;
      }

      return this.transformVersion(result);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'GET_SCORER_DEFINITION_VERSION_BY_NUMBER', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { scorerDefinitionId, versionNumber },
        },
        error,
      );
    }
  }

  async getLatestVersion(scorerDefinitionId: string): Promise<ScorerDefinitionVersion | null> {
    try {
      const collection = await this.getCollection(TABLE_SCORER_DEFINITION_VERSIONS);
      const result = await collection.find<any>({ scorerDefinitionId }).sort({ versionNumber: -1 }).limit(1).toArray();

      if (!result || result.length === 0) {
        return null;
      }

      return this.transformVersion(result[0]);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'GET_LATEST_SCORER_DEFINITION_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { scorerDefinitionId },
        },
        error,
      );
    }
  }

  async listVersions(input: ListScorerDefinitionVersionsInput): Promise<ListScorerDefinitionVersionsOutput> {
    const { scorerDefinitionId, page = 0, perPage: perPageInput, orderBy } = input;

    if (page < 0) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'LIST_SCORER_DEFINITION_VERSIONS', 'INVALID_PAGE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { page },
        },
        new Error('page must be >= 0'),
      );
    }

    const perPage = normalizePerPage(perPageInput, 20);
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    try {
      const { field, direction } = this.parseVersionOrderBy(orderBy);
      const collection = await this.getCollection(TABLE_SCORER_DEFINITION_VERSIONS);

      const total = await collection.countDocuments({ scorerDefinitionId });

      if (total === 0 || perPage === 0) {
        return {
          versions: [],
          total,
          page,
          perPage: perPageForResponse,
          hasMore: false,
        };
      }

      const sortOrder = direction === 'ASC' ? 1 : -1;

      let cursor = collection
        .find({ scorerDefinitionId })
        .sort({ [field]: sortOrder })
        .skip(offset);

      if (perPageInput !== false) {
        cursor = cursor.limit(perPage);
      }

      const results = await cursor.toArray();
      const versions = results.map((doc: any) => this.transformVersion(doc));

      return {
        versions,
        total,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput !== false && offset + perPage < total,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'LIST_SCORER_DEFINITION_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { scorerDefinitionId },
        },
        error,
      );
    }
  }

  async deleteVersion(id: string): Promise<void> {
    try {
      const collection = await this.getCollection(TABLE_SCORER_DEFINITION_VERSIONS);
      await collection.deleteOne({ id });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'DELETE_SCORER_DEFINITION_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { versionId: id },
        },
        error,
      );
    }
  }

  async deleteVersionsByParentId(scorerDefinitionId: string): Promise<void> {
    try {
      const collection = await this.getCollection(TABLE_SCORER_DEFINITION_VERSIONS);
      await collection.deleteMany({ scorerDefinitionId });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'DELETE_VERSIONS_BY_SCORER_DEFINITION_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { scorerDefinitionId },
        },
        error,
      );
    }
  }

  async countVersions(scorerDefinitionId: string): Promise<number> {
    try {
      const collection = await this.getCollection(TABLE_SCORER_DEFINITION_VERSIONS);
      return await collection.countDocuments({ scorerDefinitionId });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'COUNT_SCORER_DEFINITION_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { scorerDefinitionId },
        },
        error,
      );
    }
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  private transformScorerDefinition(doc: any): StorageScorerDefinitionType {
    const { _id, ...rest } = doc;
    return {
      id: rest.id,
      status: rest.status as 'draft' | 'published' | 'archived',
      activeVersionId: rest.activeVersionId,
      authorId: rest.authorId,
      metadata: rest.metadata,
      createdAt: rest.createdAt instanceof Date ? rest.createdAt : new Date(rest.createdAt),
      updatedAt: rest.updatedAt instanceof Date ? rest.updatedAt : new Date(rest.updatedAt),
    };
  }

  private serializeScorerDefinition(scorerDefinition: StorageScorerDefinitionType): Record<string, any> {
    return {
      id: scorerDefinition.id,
      status: scorerDefinition.status,
      activeVersionId: scorerDefinition.activeVersionId,
      authorId: scorerDefinition.authorId,
      metadata: scorerDefinition.metadata,
      createdAt: scorerDefinition.createdAt,
      updatedAt: scorerDefinition.updatedAt,
    };
  }

  private transformVersion(doc: any): ScorerDefinitionVersion {
    const { _id, ...version } = doc;

    const result: any = {
      id: version.id,
      scorerDefinitionId: version.scorerDefinitionId,
      versionNumber: version.versionNumber,
      changedFields: version.changedFields,
      changeMessage: version.changeMessage,
      createdAt: version.createdAt instanceof Date ? version.createdAt : new Date(version.createdAt),
    };

    // Copy snapshot fields
    for (const field of SNAPSHOT_FIELDS) {
      if (version[field] !== undefined) {
        result[field] = version[field];
      }
    }

    return result as ScorerDefinitionVersion;
  }
}
