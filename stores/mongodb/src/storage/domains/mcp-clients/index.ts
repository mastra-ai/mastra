import { randomUUID } from 'node:crypto';

import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  MCPClientsStorage,
  createStorageErrorId,
  TABLE_MCP_CLIENTS,
  TABLE_MCP_CLIENT_VERSIONS,
  normalizePerPage,
  calculatePagination,
} from '@mastra/core/storage';
import type {
  StorageMCPClientType,
  StorageCreateMCPClientInput,
  StorageUpdateMCPClientInput,
  StorageListMCPClientsInput,
  StorageListMCPClientsOutput,
} from '@mastra/core/storage';
import type {
  MCPClientVersion,
  CreateMCPClientVersionInput,
  ListMCPClientVersionsInput,
  ListMCPClientVersionsOutput,
} from '@mastra/core/storage/domains/mcp-clients';
import type { MongoDBConnector } from '../../connectors/MongoDBConnector';
import { resolveMongoDBConfig } from '../../db';
import type { MongoDBDomainConfig, MongoDBIndexConfig } from '../../types';

/**
 * Snapshot config fields that live on MCP client version documents.
 */
const SNAPSHOT_FIELDS = ['name', 'description', 'servers'] as const;

export class MongoDBMCPClientsStorage extends MCPClientsStorage {
  #connector: MongoDBConnector;
  #skipDefaultIndexes?: boolean;
  #indexes?: MongoDBIndexConfig[];

  static readonly MANAGED_COLLECTIONS = [TABLE_MCP_CLIENTS, TABLE_MCP_CLIENT_VERSIONS] as const;

  constructor(config: MongoDBDomainConfig) {
    super();
    this.#connector = resolveMongoDBConfig(config);
    this.#skipDefaultIndexes = config.skipDefaultIndexes;
    this.#indexes = config.indexes?.filter(idx =>
      (MongoDBMCPClientsStorage.MANAGED_COLLECTIONS as readonly string[]).includes(idx.collection),
    );
  }

  private async getCollection(name: string) {
    return this.#connector.getCollection(name);
  }

  getDefaultIndexDefinitions(): MongoDBIndexConfig[] {
    return [
      { collection: TABLE_MCP_CLIENTS, keys: { id: 1 }, options: { unique: true } },
      { collection: TABLE_MCP_CLIENTS, keys: { createdAt: -1 } },
      { collection: TABLE_MCP_CLIENTS, keys: { updatedAt: -1 } },
      { collection: TABLE_MCP_CLIENTS, keys: { authorId: 1 } },
      { collection: TABLE_MCP_CLIENT_VERSIONS, keys: { id: 1 }, options: { unique: true } },
      {
        collection: TABLE_MCP_CLIENT_VERSIONS,
        keys: { mcpClientId: 1, versionNumber: -1 },
        options: { unique: true },
      },
      { collection: TABLE_MCP_CLIENT_VERSIONS, keys: { mcpClientId: 1, createdAt: -1 } },
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
    const versionsCollection = await this.getCollection(TABLE_MCP_CLIENT_VERSIONS);
    await versionsCollection.deleteMany({});
    const mcpClientsCollection = await this.getCollection(TABLE_MCP_CLIENTS);
    await mcpClientsCollection.deleteMany({});
  }

  // ==========================================================================
  // MCP Client CRUD
  // ==========================================================================

  async getById(id: string): Promise<StorageMCPClientType | null> {
    try {
      const collection = await this.getCollection(TABLE_MCP_CLIENTS);
      const result = await collection.findOne<any>({ id });

      if (!result) {
        return null;
      }

      return this.transformMCPClient(result);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'GET_MCP_CLIENT_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id },
        },
        error,
      );
    }
  }

  async create(input: { mcpClient: StorageCreateMCPClientInput }): Promise<StorageMCPClientType> {
    const { mcpClient } = input;
    try {
      const collection = await this.getCollection(TABLE_MCP_CLIENTS);

      // Check if MCP client already exists
      const existing = await collection.findOne({ id: mcpClient.id });
      if (existing) {
        throw new MastraError({
          id: createStorageErrorId('MONGODB', 'CREATE_MCP_CLIENT', 'ALREADY_EXISTS'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { id: mcpClient.id },
          text: `MCP client with id ${mcpClient.id} already exists`,
        });
      }

      const now = new Date();

      // Create thin MCP client record
      const newMCPClient: StorageMCPClientType = {
        id: mcpClient.id,
        status: 'draft',
        activeVersionId: undefined,
        authorId: mcpClient.authorId,
        metadata: mcpClient.metadata,
        createdAt: now,
        updatedAt: now,
      };

      await collection.insertOne(this.serializeMCPClient(newMCPClient));

      // Extract snapshot config from flat input
      const snapshotConfig: Record<string, any> = {};
      for (const field of SNAPSHOT_FIELDS) {
        if ((mcpClient as any)[field] !== undefined) {
          snapshotConfig[field] = (mcpClient as any)[field];
        }
      }

      // Create version 1
      const versionId = randomUUID();
      try {
        await this.createVersion({
          id: versionId,
          mcpClientId: mcpClient.id,
          versionNumber: 1,
          ...snapshotConfig,
          changedFields: Object.keys(snapshotConfig),
          changeMessage: 'Initial version',
        } as CreateMCPClientVersionInput);
      } catch (versionError) {
        // Clean up the orphaned client record
        await collection.deleteOne({ id: mcpClient.id });
        throw versionError;
      }

      return newMCPClient;
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'CREATE_MCP_CLIENT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id: mcpClient.id },
        },
        error,
      );
    }
  }

  async update(input: StorageUpdateMCPClientInput): Promise<StorageMCPClientType> {
    const { id, ...updates } = input;
    try {
      const collection = await this.getCollection(TABLE_MCP_CLIENTS);

      const existingMCPClient = await collection.findOne<any>({ id });
      if (!existingMCPClient) {
        throw new MastraError({
          id: createStorageErrorId('MONGODB', 'UPDATE_MCP_CLIENT', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { id },
          text: `MCP client with id ${id} not found`,
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
        const existingMetadata = existingMCPClient.metadata || {};
        updateDoc.metadata = { ...existingMetadata, ...metadataFields.metadata };
      }

      await collection.updateOne({ id }, { $set: updateDoc });

      const updatedMCPClient = await collection.findOne<any>({ id });
      if (!updatedMCPClient) {
        throw new MastraError({
          id: createStorageErrorId('MONGODB', 'UPDATE_MCP_CLIENT', 'NOT_FOUND_AFTER_UPDATE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.SYSTEM,
          text: `MCP client with id ${id} was deleted during update`,
          details: { id },
        });
      }
      return this.transformMCPClient(updatedMCPClient);
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'UPDATE_MCP_CLIENT', 'FAILED'),
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

      // Then delete the MCP client
      const collection = await this.getCollection(TABLE_MCP_CLIENTS);
      await collection.deleteOne({ id });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'DELETE_MCP_CLIENT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id },
        },
        error,
      );
    }
  }

  async list(args?: StorageListMCPClientsInput): Promise<StorageListMCPClientsOutput> {
    try {
      const { page = 0, perPage: perPageInput, orderBy, authorId, metadata, status = 'published' } = args || {};
      const { field, direction } = this.parseOrderBy(orderBy);

      if (page < 0) {
        throw new MastraError(
          {
            id: createStorageErrorId('MONGODB', 'LIST_MCP_CLIENTS', 'INVALID_PAGE'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            details: { page },
          },
          new Error('page must be >= 0'),
        );
      }

      const perPage = normalizePerPage(perPageInput, 100);
      const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

      const collection = await this.getCollection(TABLE_MCP_CLIENTS);

      // Build filter
      const filter: Record<string, any> = {};
      filter.status = status;
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
          mcpClients: [],
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
      const mcpClients = results.map((doc: any) => this.transformMCPClient(doc));

      return {
        mcpClients,
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
          id: createStorageErrorId('MONGODB', 'LIST_MCP_CLIENTS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  // ==========================================================================
  // MCP Client Version Methods
  // ==========================================================================

  async createVersion(input: CreateMCPClientVersionInput): Promise<MCPClientVersion> {
    try {
      const collection = await this.getCollection(TABLE_MCP_CLIENT_VERSIONS);
      const now = new Date();

      const versionDoc: Record<string, any> = {
        id: input.id,
        mcpClientId: input.mcpClientId,
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
          id: createStorageErrorId('MONGODB', 'CREATE_MCP_CLIENT_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { versionId: input.id, mcpClientId: input.mcpClientId },
        },
        error,
      );
    }
  }

  async getVersion(id: string): Promise<MCPClientVersion | null> {
    try {
      const collection = await this.getCollection(TABLE_MCP_CLIENT_VERSIONS);
      const result = await collection.findOne<any>({ id });

      if (!result) {
        return null;
      }

      return this.transformVersion(result);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'GET_MCP_CLIENT_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { versionId: id },
        },
        error,
      );
    }
  }

  async getVersionByNumber(mcpClientId: string, versionNumber: number): Promise<MCPClientVersion | null> {
    try {
      const collection = await this.getCollection(TABLE_MCP_CLIENT_VERSIONS);
      const result = await collection.findOne<any>({ mcpClientId, versionNumber });

      if (!result) {
        return null;
      }

      return this.transformVersion(result);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'GET_MCP_CLIENT_VERSION_BY_NUMBER', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { mcpClientId, versionNumber },
        },
        error,
      );
    }
  }

  async getLatestVersion(mcpClientId: string): Promise<MCPClientVersion | null> {
    try {
      const collection = await this.getCollection(TABLE_MCP_CLIENT_VERSIONS);
      const result = await collection.find<any>({ mcpClientId }).sort({ versionNumber: -1 }).limit(1).toArray();

      if (!result || result.length === 0) {
        return null;
      }

      return this.transformVersion(result[0]);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'GET_LATEST_MCP_CLIENT_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { mcpClientId },
        },
        error,
      );
    }
  }

  async listVersions(input: ListMCPClientVersionsInput): Promise<ListMCPClientVersionsOutput> {
    const { mcpClientId, page = 0, perPage: perPageInput, orderBy } = input;

    if (page < 0) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'LIST_MCP_CLIENT_VERSIONS', 'INVALID_PAGE'),
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
      const collection = await this.getCollection(TABLE_MCP_CLIENT_VERSIONS);

      const total = await collection.countDocuments({ mcpClientId });

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
        .find({ mcpClientId })
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
          id: createStorageErrorId('MONGODB', 'LIST_MCP_CLIENT_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { mcpClientId },
        },
        error,
      );
    }
  }

  async deleteVersion(id: string): Promise<void> {
    try {
      const collection = await this.getCollection(TABLE_MCP_CLIENT_VERSIONS);
      await collection.deleteOne({ id });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'DELETE_MCP_CLIENT_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { versionId: id },
        },
        error,
      );
    }
  }

  async deleteVersionsByParentId(mcpClientId: string): Promise<void> {
    try {
      const collection = await this.getCollection(TABLE_MCP_CLIENT_VERSIONS);
      await collection.deleteMany({ mcpClientId });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'DELETE_VERSIONS_BY_MCP_CLIENT_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { mcpClientId },
        },
        error,
      );
    }
  }

  async countVersions(mcpClientId: string): Promise<number> {
    try {
      const collection = await this.getCollection(TABLE_MCP_CLIENT_VERSIONS);
      return await collection.countDocuments({ mcpClientId });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'COUNT_MCP_CLIENT_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { mcpClientId },
        },
        error,
      );
    }
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  private transformMCPClient(doc: any): StorageMCPClientType {
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

  private serializeMCPClient(mcpClient: StorageMCPClientType): Record<string, any> {
    return {
      id: mcpClient.id,
      status: mcpClient.status,
      activeVersionId: mcpClient.activeVersionId,
      authorId: mcpClient.authorId,
      metadata: mcpClient.metadata,
      createdAt: mcpClient.createdAt,
      updatedAt: mcpClient.updatedAt,
    };
  }

  private transformVersion(doc: any): MCPClientVersion {
    const { _id, ...version } = doc;

    const result: any = {
      id: version.id,
      mcpClientId: version.mcpClientId,
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

    return result as MCPClientVersion;
  }
}
