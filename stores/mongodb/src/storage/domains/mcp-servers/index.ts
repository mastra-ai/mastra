import { randomUUID } from 'node:crypto';

import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  MCPServersStorage,
  createStorageErrorId,
  TABLE_MCP_SERVERS,
  TABLE_MCP_SERVER_VERSIONS,
  normalizePerPage,
  calculatePagination,
} from '@mastra/core/storage';
import type {
  StorageMCPServerType,
  StorageCreateMCPServerInput,
  StorageUpdateMCPServerInput,
  StorageListMCPServersInput,
  StorageListMCPServersOutput,
} from '@mastra/core/storage';
import type {
  MCPServerVersion,
  CreateMCPServerVersionInput,
  ListMCPServerVersionsInput,
  ListMCPServerVersionsOutput,
} from '@mastra/core/storage/domains/mcp-servers';
import type { MongoDBConnector } from '../../connectors/MongoDBConnector';
import { resolveMongoDBConfig } from '../../db';
import type { MongoDBDomainConfig, MongoDBIndexConfig } from '../../types';

/**
 * Snapshot config fields that live on MCP server version documents.
 */
const SNAPSHOT_FIELDS = [
  'name',
  'version',
  'description',
  'instructions',
  'repository',
  'releaseDate',
  'isLatest',
  'packageCanonical',
  'tools',
  'agents',
  'workflows',
] as const;

export class MongoDBMCPServersStorage extends MCPServersStorage {
  #connector: MongoDBConnector;
  #skipDefaultIndexes?: boolean;
  #indexes?: MongoDBIndexConfig[];

  static readonly MANAGED_COLLECTIONS = [TABLE_MCP_SERVERS, TABLE_MCP_SERVER_VERSIONS] as const;

  constructor(config: MongoDBDomainConfig) {
    super();
    this.#connector = resolveMongoDBConfig(config);
    this.#skipDefaultIndexes = config.skipDefaultIndexes;
    this.#indexes = config.indexes?.filter(idx =>
      (MongoDBMCPServersStorage.MANAGED_COLLECTIONS as readonly string[]).includes(idx.collection),
    );
  }

  private async getCollection(name: string) {
    return this.#connector.getCollection(name);
  }

  getDefaultIndexDefinitions(): MongoDBIndexConfig[] {
    return [
      { collection: TABLE_MCP_SERVERS, keys: { id: 1 }, options: { unique: true } },
      { collection: TABLE_MCP_SERVERS, keys: { createdAt: -1 } },
      { collection: TABLE_MCP_SERVERS, keys: { updatedAt: -1 } },
      { collection: TABLE_MCP_SERVERS, keys: { authorId: 1 } },
      { collection: TABLE_MCP_SERVER_VERSIONS, keys: { id: 1 }, options: { unique: true } },
      {
        collection: TABLE_MCP_SERVER_VERSIONS,
        keys: { mcpServerId: 1, versionNumber: -1 },
        options: { unique: true },
      },
      { collection: TABLE_MCP_SERVER_VERSIONS, keys: { mcpServerId: 1, createdAt: -1 } },
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
    const versionsCollection = await this.getCollection(TABLE_MCP_SERVER_VERSIONS);
    await versionsCollection.deleteMany({});
    const mcpServersCollection = await this.getCollection(TABLE_MCP_SERVERS);
    await mcpServersCollection.deleteMany({});
  }

  // ==========================================================================
  // MCP Server CRUD
  // ==========================================================================

  async getById(id: string): Promise<StorageMCPServerType | null> {
    try {
      const collection = await this.getCollection(TABLE_MCP_SERVERS);
      const result = await collection.findOne<any>({ id });

      if (!result) {
        return null;
      }

      return this.transformMCPServer(result);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'GET_MCP_SERVER_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id },
        },
        error,
      );
    }
  }

  async create(input: { mcpServer: StorageCreateMCPServerInput }): Promise<StorageMCPServerType> {
    const { mcpServer } = input;
    try {
      const collection = await this.getCollection(TABLE_MCP_SERVERS);

      // Check if MCP server already exists
      const existing = await collection.findOne({ id: mcpServer.id });
      if (existing) {
        throw new MastraError({
          id: createStorageErrorId('MONGODB', 'CREATE_MCP_SERVER', 'ALREADY_EXISTS'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { id: mcpServer.id },
          text: `MCP server with id ${mcpServer.id} already exists`,
        });
      }

      const now = new Date();

      // Create thin MCP server record
      const newMCPServer: StorageMCPServerType = {
        id: mcpServer.id,
        status: 'draft',
        activeVersionId: undefined,
        authorId: mcpServer.authorId,
        metadata: mcpServer.metadata,
        createdAt: now,
        updatedAt: now,
      };

      await collection.insertOne(this.serializeMCPServer(newMCPServer));

      // Extract snapshot config from flat input
      const snapshotConfig: Record<string, any> = {};
      for (const field of SNAPSHOT_FIELDS) {
        if ((mcpServer as any)[field] !== undefined) {
          snapshotConfig[field] = (mcpServer as any)[field];
        }
      }

      // Create version 1
      const versionId = randomUUID();
      try {
        await this.createVersion({
          id: versionId,
          mcpServerId: mcpServer.id,
          versionNumber: 1,
          ...snapshotConfig,
          changedFields: Object.keys(snapshotConfig),
          changeMessage: 'Initial version',
        } as CreateMCPServerVersionInput);
      } catch (versionError) {
        // Clean up the orphaned server record
        await collection.deleteOne({ id: mcpServer.id });
        throw versionError;
      }

      return newMCPServer;
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'CREATE_MCP_SERVER', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id: mcpServer.id },
        },
        error,
      );
    }
  }

  async update(input: StorageUpdateMCPServerInput): Promise<StorageMCPServerType> {
    const { id, ...updates } = input;
    try {
      const collection = await this.getCollection(TABLE_MCP_SERVERS);

      const existingMCPServer = await collection.findOne<any>({ id });
      if (!existingMCPServer) {
        throw new MastraError({
          id: createStorageErrorId('MONGODB', 'UPDATE_MCP_SERVER', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { id },
          text: `MCP server with id ${id} not found`,
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
        const existingMetadata = existingMCPServer.metadata || {};
        updateDoc.metadata = { ...existingMetadata, ...metadataFields.metadata };
      }

      await collection.updateOne({ id }, { $set: updateDoc });

      const updatedMCPServer = await collection.findOne<any>({ id });
      if (!updatedMCPServer) {
        throw new MastraError({
          id: createStorageErrorId('MONGODB', 'UPDATE_MCP_SERVER', 'NOT_FOUND_AFTER_UPDATE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.SYSTEM,
          text: `MCP server with id ${id} was deleted during update`,
          details: { id },
        });
      }
      return this.transformMCPServer(updatedMCPServer);
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'UPDATE_MCP_SERVER', 'FAILED'),
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

      // Then delete the MCP server
      const collection = await this.getCollection(TABLE_MCP_SERVERS);
      await collection.deleteOne({ id });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'DELETE_MCP_SERVER', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id },
        },
        error,
      );
    }
  }

  async list(args?: StorageListMCPServersInput): Promise<StorageListMCPServersOutput> {
    try {
      const { page = 0, perPage: perPageInput, orderBy, authorId, metadata, status } = args || {};
      const { field, direction } = this.parseOrderBy(orderBy);

      if (page < 0) {
        throw new MastraError(
          {
            id: createStorageErrorId('MONGODB', 'LIST_MCP_SERVERS', 'INVALID_PAGE'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            details: { page },
          },
          new Error('page must be >= 0'),
        );
      }

      const perPage = normalizePerPage(perPageInput, 100);
      const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

      const collection = await this.getCollection(TABLE_MCP_SERVERS);

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
          mcpServers: [],
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
      const mcpServers = results.map((doc: any) => this.transformMCPServer(doc));

      return {
        mcpServers,
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
          id: createStorageErrorId('MONGODB', 'LIST_MCP_SERVERS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  // ==========================================================================
  // MCP Server Version Methods
  // ==========================================================================

  async createVersion(input: CreateMCPServerVersionInput): Promise<MCPServerVersion> {
    try {
      const collection = await this.getCollection(TABLE_MCP_SERVER_VERSIONS);
      const now = new Date();

      const versionDoc: Record<string, any> = {
        id: input.id,
        mcpServerId: input.mcpServerId,
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
          id: createStorageErrorId('MONGODB', 'CREATE_MCP_SERVER_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { versionId: input.id, mcpServerId: input.mcpServerId },
        },
        error,
      );
    }
  }

  async getVersion(id: string): Promise<MCPServerVersion | null> {
    try {
      const collection = await this.getCollection(TABLE_MCP_SERVER_VERSIONS);
      const result = await collection.findOne<any>({ id });

      if (!result) {
        return null;
      }

      return this.transformVersion(result);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'GET_MCP_SERVER_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { versionId: id },
        },
        error,
      );
    }
  }

  async getVersionByNumber(mcpServerId: string, versionNumber: number): Promise<MCPServerVersion | null> {
    try {
      const collection = await this.getCollection(TABLE_MCP_SERVER_VERSIONS);
      const result = await collection.findOne<any>({ mcpServerId, versionNumber });

      if (!result) {
        return null;
      }

      return this.transformVersion(result);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'GET_MCP_SERVER_VERSION_BY_NUMBER', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { mcpServerId, versionNumber },
        },
        error,
      );
    }
  }

  async getLatestVersion(mcpServerId: string): Promise<MCPServerVersion | null> {
    try {
      const collection = await this.getCollection(TABLE_MCP_SERVER_VERSIONS);
      const result = await collection.find<any>({ mcpServerId }).sort({ versionNumber: -1 }).limit(1).toArray();

      if (!result || result.length === 0) {
        return null;
      }

      return this.transformVersion(result[0]);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'GET_LATEST_MCP_SERVER_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { mcpServerId },
        },
        error,
      );
    }
  }

  async listVersions(input: ListMCPServerVersionsInput): Promise<ListMCPServerVersionsOutput> {
    const { mcpServerId, page = 0, perPage: perPageInput, orderBy } = input;

    if (page < 0) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'LIST_MCP_SERVER_VERSIONS', 'INVALID_PAGE'),
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
      const collection = await this.getCollection(TABLE_MCP_SERVER_VERSIONS);

      const total = await collection.countDocuments({ mcpServerId });

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
        .find({ mcpServerId })
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
          id: createStorageErrorId('MONGODB', 'LIST_MCP_SERVER_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { mcpServerId },
        },
        error,
      );
    }
  }

  async deleteVersion(id: string): Promise<void> {
    try {
      const collection = await this.getCollection(TABLE_MCP_SERVER_VERSIONS);
      await collection.deleteOne({ id });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'DELETE_MCP_SERVER_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { versionId: id },
        },
        error,
      );
    }
  }

  async deleteVersionsByParentId(mcpServerId: string): Promise<void> {
    try {
      const collection = await this.getCollection(TABLE_MCP_SERVER_VERSIONS);
      await collection.deleteMany({ mcpServerId });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'DELETE_VERSIONS_BY_MCP_SERVER_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { mcpServerId },
        },
        error,
      );
    }
  }

  async countVersions(mcpServerId: string): Promise<number> {
    try {
      const collection = await this.getCollection(TABLE_MCP_SERVER_VERSIONS);
      return await collection.countDocuments({ mcpServerId });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'COUNT_MCP_SERVER_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { mcpServerId },
        },
        error,
      );
    }
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  private transformMCPServer(doc: any): StorageMCPServerType {
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

  private serializeMCPServer(mcpServer: StorageMCPServerType): Record<string, any> {
    return {
      id: mcpServer.id,
      status: mcpServer.status,
      activeVersionId: mcpServer.activeVersionId,
      authorId: mcpServer.authorId,
      metadata: mcpServer.metadata,
      createdAt: mcpServer.createdAt,
      updatedAt: mcpServer.updatedAt,
    };
  }

  private transformVersion(doc: any): MCPServerVersion {
    const { _id, ...version } = doc;

    const result: any = {
      id: version.id,
      mcpServerId: version.mcpServerId,
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

    return result as MCPServerVersion;
  }
}
