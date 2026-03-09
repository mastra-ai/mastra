import { randomUUID } from 'node:crypto';

import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  PromptBlocksStorage,
  createStorageErrorId,
  TABLE_PROMPT_BLOCKS,
  TABLE_PROMPT_BLOCK_VERSIONS,
  normalizePerPage,
  calculatePagination,
} from '@mastra/core/storage';
import type {
  StoragePromptBlockType,
  StorageCreatePromptBlockInput,
  StorageUpdatePromptBlockInput,
  StorageListPromptBlocksInput,
  StorageListPromptBlocksOutput,
} from '@mastra/core/storage';
import type {
  PromptBlockVersion,
  CreatePromptBlockVersionInput,
  ListPromptBlockVersionsInput,
  ListPromptBlockVersionsOutput,
} from '@mastra/core/storage/domains/prompt-blocks';
import type { MongoDBConnector } from '../../connectors/MongoDBConnector';
import { resolveMongoDBConfig } from '../../db';
import type { MongoDBDomainConfig, MongoDBIndexConfig } from '../../types';

/**
 * Snapshot config fields that live on prompt block version documents.
 */
const SNAPSHOT_FIELDS = ['name', 'description', 'content', 'rules', 'requestContextSchema'] as const;

export class MongoDBPromptBlocksStorage extends PromptBlocksStorage {
  #connector: MongoDBConnector;
  #skipDefaultIndexes?: boolean;
  #indexes?: MongoDBIndexConfig[];

  static readonly MANAGED_COLLECTIONS = [TABLE_PROMPT_BLOCKS, TABLE_PROMPT_BLOCK_VERSIONS] as const;

  constructor(config: MongoDBDomainConfig) {
    super();
    this.#connector = resolveMongoDBConfig(config);
    this.#skipDefaultIndexes = config.skipDefaultIndexes;
    this.#indexes = config.indexes?.filter(idx =>
      (MongoDBPromptBlocksStorage.MANAGED_COLLECTIONS as readonly string[]).includes(idx.collection),
    );
  }

  private async getCollection(name: string) {
    return this.#connector.getCollection(name);
  }

  getDefaultIndexDefinitions(): MongoDBIndexConfig[] {
    return [
      { collection: TABLE_PROMPT_BLOCKS, keys: { id: 1 }, options: { unique: true } },
      { collection: TABLE_PROMPT_BLOCKS, keys: { createdAt: -1 } },
      { collection: TABLE_PROMPT_BLOCKS, keys: { updatedAt: -1 } },
      { collection: TABLE_PROMPT_BLOCKS, keys: { authorId: 1 } },
      { collection: TABLE_PROMPT_BLOCK_VERSIONS, keys: { id: 1 }, options: { unique: true } },
      {
        collection: TABLE_PROMPT_BLOCK_VERSIONS,
        keys: { blockId: 1, versionNumber: -1 },
        options: { unique: true },
      },
      { collection: TABLE_PROMPT_BLOCK_VERSIONS, keys: { blockId: 1, createdAt: -1 } },
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
    const versionsCollection = await this.getCollection(TABLE_PROMPT_BLOCK_VERSIONS);
    await versionsCollection.deleteMany({});
    const blocksCollection = await this.getCollection(TABLE_PROMPT_BLOCKS);
    await blocksCollection.deleteMany({});
  }

  // ==========================================================================
  // Prompt Block CRUD
  // ==========================================================================

  async getById(id: string): Promise<StoragePromptBlockType | null> {
    try {
      const collection = await this.getCollection(TABLE_PROMPT_BLOCKS);
      const result = await collection.findOne<any>({ id });

      if (!result) {
        return null;
      }

      return this.transformBlock(result);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'GET_PROMPT_BLOCK_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id },
        },
        error,
      );
    }
  }

  async create(input: { promptBlock: StorageCreatePromptBlockInput }): Promise<StoragePromptBlockType> {
    const { promptBlock } = input;
    try {
      const collection = await this.getCollection(TABLE_PROMPT_BLOCKS);

      // Check if block already exists
      const existing = await collection.findOne({ id: promptBlock.id });
      if (existing) {
        throw new MastraError({
          id: createStorageErrorId('MONGODB', 'CREATE_PROMPT_BLOCK', 'ALREADY_EXISTS'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { id: promptBlock.id },
          text: `Prompt block with id ${promptBlock.id} already exists`,
        });
      }

      const now = new Date();

      // Create thin block record
      const newBlock: StoragePromptBlockType = {
        id: promptBlock.id,
        status: 'draft',
        activeVersionId: undefined,
        authorId: promptBlock.authorId,
        metadata: promptBlock.metadata,
        createdAt: now,
        updatedAt: now,
      };

      await collection.insertOne(this.serializeBlock(newBlock));

      // Extract snapshot config from flat input
      const snapshotConfig: Record<string, any> = {};
      for (const field of SNAPSHOT_FIELDS) {
        if ((promptBlock as any)[field] !== undefined) {
          snapshotConfig[field] = (promptBlock as any)[field];
        }
      }

      // Create version 1
      const versionId = randomUUID();
      await this.createVersion({
        id: versionId,
        blockId: promptBlock.id,
        versionNumber: 1,
        ...snapshotConfig,
        changedFields: Object.keys(snapshotConfig),
        changeMessage: 'Initial version',
      } as CreatePromptBlockVersionInput);

      return newBlock;
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'CREATE_PROMPT_BLOCK', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id: promptBlock.id },
        },
        error,
      );
    }
  }

  async update(input: StorageUpdatePromptBlockInput): Promise<StoragePromptBlockType> {
    const { id, ...updates } = input;
    try {
      const collection = await this.getCollection(TABLE_PROMPT_BLOCKS);

      const existingBlock = await collection.findOne<any>({ id });
      if (!existingBlock) {
        throw new MastraError({
          id: createStorageErrorId('MONGODB', 'UPDATE_PROMPT_BLOCK', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { id },
          text: `Prompt block with id ${id} not found`,
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
        const existingMetadata = existingBlock.metadata || {};
        updateDoc.metadata = { ...existingMetadata, ...metadataFields.metadata };
      }

      await collection.updateOne({ id }, { $set: updateDoc });

      const updatedBlock = await collection.findOne<any>({ id });
      if (!updatedBlock) {
        throw new MastraError({
          id: createStorageErrorId('MONGODB', 'UPDATE_PROMPT_BLOCK', 'NOT_FOUND_AFTER_UPDATE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.SYSTEM,
          text: `Prompt block with id ${id} was deleted during update`,
          details: { id },
        });
      }
      return this.transformBlock(updatedBlock);
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'UPDATE_PROMPT_BLOCK', 'FAILED'),
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

      // Then delete the block
      const collection = await this.getCollection(TABLE_PROMPT_BLOCKS);
      await collection.deleteOne({ id });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'DELETE_PROMPT_BLOCK', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id },
        },
        error,
      );
    }
  }

  async list(args?: StorageListPromptBlocksInput): Promise<StorageListPromptBlocksOutput> {
    try {
      const { page = 0, perPage: perPageInput, orderBy, authorId, metadata, status } = args || {};
      const { field, direction } = this.parseOrderBy(orderBy);

      if (page < 0) {
        throw new MastraError(
          {
            id: createStorageErrorId('MONGODB', 'LIST_PROMPT_BLOCKS', 'INVALID_PAGE'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            details: { page },
          },
          new Error('page must be >= 0'),
        );
      }

      const perPage = normalizePerPage(perPageInput, 100);
      const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

      const collection = await this.getCollection(TABLE_PROMPT_BLOCKS);

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
          promptBlocks: [],
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
      const promptBlocks = results.map((doc: any) => this.transformBlock(doc));

      return {
        promptBlocks,
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
          id: createStorageErrorId('MONGODB', 'LIST_PROMPT_BLOCKS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  // ==========================================================================
  // Prompt Block Version Methods
  // ==========================================================================

  async createVersion(input: CreatePromptBlockVersionInput): Promise<PromptBlockVersion> {
    try {
      const collection = await this.getCollection(TABLE_PROMPT_BLOCK_VERSIONS);
      const now = new Date();

      const versionDoc: Record<string, any> = {
        id: input.id,
        blockId: input.blockId,
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
          id: createStorageErrorId('MONGODB', 'CREATE_PROMPT_BLOCK_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { versionId: input.id, blockId: input.blockId },
        },
        error,
      );
    }
  }

  async getVersion(id: string): Promise<PromptBlockVersion | null> {
    try {
      const collection = await this.getCollection(TABLE_PROMPT_BLOCK_VERSIONS);
      const result = await collection.findOne<any>({ id });

      if (!result) {
        return null;
      }

      return this.transformVersion(result);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'GET_PROMPT_BLOCK_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { versionId: id },
        },
        error,
      );
    }
  }

  async getVersionByNumber(blockId: string, versionNumber: number): Promise<PromptBlockVersion | null> {
    try {
      const collection = await this.getCollection(TABLE_PROMPT_BLOCK_VERSIONS);
      const result = await collection.findOne<any>({ blockId, versionNumber });

      if (!result) {
        return null;
      }

      return this.transformVersion(result);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'GET_PROMPT_BLOCK_VERSION_BY_NUMBER', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { blockId, versionNumber },
        },
        error,
      );
    }
  }

  async getLatestVersion(blockId: string): Promise<PromptBlockVersion | null> {
    try {
      const collection = await this.getCollection(TABLE_PROMPT_BLOCK_VERSIONS);
      const result = await collection.find<any>({ blockId }).sort({ versionNumber: -1 }).limit(1).toArray();

      if (!result || result.length === 0) {
        return null;
      }

      return this.transformVersion(result[0]);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'GET_LATEST_PROMPT_BLOCK_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { blockId },
        },
        error,
      );
    }
  }

  async listVersions(input: ListPromptBlockVersionsInput): Promise<ListPromptBlockVersionsOutput> {
    const { blockId, page = 0, perPage: perPageInput, orderBy } = input;

    if (page < 0) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'LIST_PROMPT_BLOCK_VERSIONS', 'INVALID_PAGE'),
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
      const collection = await this.getCollection(TABLE_PROMPT_BLOCK_VERSIONS);

      const total = await collection.countDocuments({ blockId });

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
        .find({ blockId })
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
          id: createStorageErrorId('MONGODB', 'LIST_PROMPT_BLOCK_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { blockId },
        },
        error,
      );
    }
  }

  async deleteVersion(id: string): Promise<void> {
    try {
      const collection = await this.getCollection(TABLE_PROMPT_BLOCK_VERSIONS);
      await collection.deleteOne({ id });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'DELETE_PROMPT_BLOCK_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { versionId: id },
        },
        error,
      );
    }
  }

  async deleteVersionsByParentId(blockId: string): Promise<void> {
    try {
      const collection = await this.getCollection(TABLE_PROMPT_BLOCK_VERSIONS);
      await collection.deleteMany({ blockId });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'DELETE_VERSIONS_BY_BLOCK_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { blockId },
        },
        error,
      );
    }
  }

  async countVersions(blockId: string): Promise<number> {
    try {
      const collection = await this.getCollection(TABLE_PROMPT_BLOCK_VERSIONS);
      return await collection.countDocuments({ blockId });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'COUNT_PROMPT_BLOCK_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { blockId },
        },
        error,
      );
    }
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  private transformBlock(doc: any): StoragePromptBlockType {
    const { _id, ...rest } = doc;
    return {
      id: rest.id,
      status: rest.status,
      activeVersionId: rest.activeVersionId,
      authorId: rest.authorId,
      metadata: rest.metadata,
      createdAt: rest.createdAt instanceof Date ? rest.createdAt : new Date(rest.createdAt),
      updatedAt: rest.updatedAt instanceof Date ? rest.updatedAt : new Date(rest.updatedAt),
    };
  }

  private serializeBlock(block: StoragePromptBlockType): Record<string, any> {
    return {
      id: block.id,
      status: block.status,
      activeVersionId: block.activeVersionId,
      authorId: block.authorId,
      metadata: block.metadata,
      createdAt: block.createdAt,
      updatedAt: block.updatedAt,
    };
  }

  private transformVersion(doc: any): PromptBlockVersion {
    const { _id, ...version } = doc;

    const result: any = {
      id: version.id,
      blockId: version.blockId,
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

    return result as PromptBlockVersion;
  }
}
