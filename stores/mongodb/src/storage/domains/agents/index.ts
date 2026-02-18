import { randomUUID } from 'node:crypto';

import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  AgentsStorage,
  createStorageErrorId,
  TABLE_AGENTS,
  TABLE_AGENT_VERSIONS,
  normalizePerPage,
  calculatePagination,
} from '@mastra/core/storage';
import type {
  StorageAgentType,
  StorageCreateAgentInput,
  StorageUpdateAgentInput,
  StorageListAgentsInput,
  StorageListAgentsOutput,
} from '@mastra/core/storage';
import type {
  AgentVersion,
  CreateVersionInput,
  ListVersionsInput,
  ListVersionsOutput,
} from '@mastra/core/storage/domains/agents';
import type { MongoDBConnector } from '../../connectors/MongoDBConnector';
import { resolveMongoDBConfig } from '../../db';
import type { MongoDBDomainConfig, MongoDBIndexConfig } from '../../types';

/**
 * The set of fields from StorageAgentSnapshotType that live on version rows.
 * Used to strip snapshot config from version documents when transforming.
 */
const SNAPSHOT_FIELDS = [
  'name',
  'description',
  'instructions',
  'model',
  'tools',
  'defaultOptions',
  'workflows',
  'agents',
  'integrationTools',
  'inputProcessors',
  'outputProcessors',
  'memory',
  'scorers',
  'mcpClients',
  'requestContextSchema',
] as const;

export class MongoDBAgentsStorage extends AgentsStorage {
  #connector: MongoDBConnector;
  #skipDefaultIndexes?: boolean;
  #indexes?: MongoDBIndexConfig[];

  /** Collections managed by this domain */
  static readonly MANAGED_COLLECTIONS = [TABLE_AGENTS, TABLE_AGENT_VERSIONS] as const;

  constructor(config: MongoDBDomainConfig) {
    super();
    this.#connector = resolveMongoDBConfig(config);
    this.#skipDefaultIndexes = config.skipDefaultIndexes;
    // Filter indexes to only those for collections managed by this domain
    this.#indexes = config.indexes?.filter(idx =>
      (MongoDBAgentsStorage.MANAGED_COLLECTIONS as readonly string[]).includes(idx.collection),
    );
  }

  private async getCollection(name: string) {
    return this.#connector.getCollection(name);
  }

  /**
   * Returns default index definitions for the agents domain collections.
   * These indexes optimize common query patterns for agent lookups.
   */
  getDefaultIndexDefinitions(): MongoDBIndexConfig[] {
    return [
      { collection: TABLE_AGENTS, keys: { id: 1 }, options: { unique: true } },
      { collection: TABLE_AGENTS, keys: { createdAt: -1 } },
      { collection: TABLE_AGENTS, keys: { updatedAt: -1 } },
      { collection: TABLE_AGENT_VERSIONS, keys: { id: 1 }, options: { unique: true } },
      { collection: TABLE_AGENT_VERSIONS, keys: { agentId: 1, versionNumber: -1 }, options: { unique: true } },
      { collection: TABLE_AGENT_VERSIONS, keys: { agentId: 1, createdAt: -1 } },
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

  /**
   * Creates custom user-defined indexes for this domain's collections.
   */
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
    await this.#migrateToolsToJsonbFormat();
  }

  /**
   * Migrates the tools field from string[] format to object format { "tool-key": { "description": "..." } }.
   * This handles the transition from the old format where tools were stored as an array of string keys
   * to the new format where tools can have per-agent description overrides.
   */
  async #migrateToolsToJsonbFormat(): Promise<void> {
    try {
      const versionsCollection = await this.getCollection(TABLE_AGENT_VERSIONS);

      // Find all documents where tools is an array
      const cursor = versionsCollection.find({ tools: { $type: 'array' } });

      const updates: { id: string; tools: Record<string, { description?: string }> }[] = [];

      for await (const doc of cursor) {
        if (Array.isArray(doc.tools)) {
          const toolsObject: Record<string, { description?: string }> = {};

          // Convert each tool string to an object key with empty config
          for (const toolKey of doc.tools) {
            if (typeof toolKey === 'string') {
              toolsObject[toolKey] = {};
            }
          }

          updates.push({ id: doc.id, tools: toolsObject });
        }
      }

      // Batch update all documents
      if (updates.length > 0) {
        const bulkOps = updates.map(update => ({
          updateOne: {
            filter: { id: update.id },
            update: { $set: { tools: update.tools } },
          },
        }));

        await versionsCollection.bulkWrite(bulkOps);
        this.logger?.info?.(`Migrated ${updates.length} agent version tools from array to object format`);
      }
    } catch (error) {
      // Log but don't fail - this is a non-breaking migration
      this.logger?.warn?.('Failed to migrate tools to object format:', error);
    }
  }

  async dangerouslyClearAll(): Promise<void> {
    const versionsCollection = await this.getCollection(TABLE_AGENT_VERSIONS);
    await versionsCollection.deleteMany({});
    const agentsCollection = await this.getCollection(TABLE_AGENTS);
    await agentsCollection.deleteMany({});
  }

  async getById(id: string): Promise<StorageAgentType | null> {
    try {
      const collection = await this.getCollection(TABLE_AGENTS);
      const result = await collection.findOne<any>({ id });

      if (!result) {
        return null;
      }

      return this.transformAgent(result);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'GET_AGENT_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id },
        },
        error,
      );
    }
  }

  async create(input: { agent: StorageCreateAgentInput }): Promise<StorageAgentType> {
    const { agent } = input;
    try {
      const collection = await this.getCollection(TABLE_AGENTS);

      // Check if agent already exists
      const existing = await collection.findOne({ id: agent.id });
      if (existing) {
        throw new MastraError({
          id: createStorageErrorId('MONGODB', 'CREATE_AGENT', 'ALREADY_EXISTS'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { id: agent.id },
          text: `Agent with id ${agent.id} already exists`,
        });
      }

      const now = new Date();

      // Create the thin agent record with status='draft'
      const newAgent: StorageAgentType = {
        id: agent.id,
        status: 'draft',
        activeVersionId: undefined,
        authorId: agent.authorId,
        metadata: agent.metadata,
        createdAt: now,
        updatedAt: now,
      };

      await collection.insertOne(this.serializeAgent(newAgent));

      // Extract config fields from the flat input
      const { id: _id, authorId: _authorId, metadata: _metadata, ...snapshotConfig } = agent;

      // Create version 1 from the config
      const versionId = randomUUID();
      await this.createVersion({
        id: versionId,
        agentId: agent.id,
        versionNumber: 1,
        ...snapshotConfig,
        changedFields: Object.keys(snapshotConfig),
        changeMessage: 'Initial version',
      });

      // Return the thin agent record (activeVersionId remains undefined, status remains 'draft')
      return newAgent;
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'CREATE_AGENT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id: agent.id },
        },
        error,
      );
    }
  }

  async update(input: StorageUpdateAgentInput): Promise<StorageAgentType> {
    const { id, ...updates } = input;
    try {
      const collection = await this.getCollection(TABLE_AGENTS);

      const existingAgent = await collection.findOne<any>({ id });
      if (!existingAgent) {
        throw new MastraError({
          id: createStorageErrorId('MONGODB', 'UPDATE_AGENT', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { id },
          text: `Agent with id ${id} not found`,
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
        const existingMetadata = existingAgent.metadata || {};
        updateDoc.metadata = { ...existingMetadata, ...metadataFields.metadata };
      }

      await collection.updateOne({ id }, { $set: updateDoc });

      const updatedAgent = await collection.findOne<any>({ id });
      if (!updatedAgent) {
        throw new MastraError({
          id: createStorageErrorId('MONGODB', 'UPDATE_AGENT', 'NOT_FOUND_AFTER_UPDATE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.SYSTEM,
          text: `Agent with id ${id} was deleted during update`,
          details: { id },
        });
      }
      return this.transformAgent(updatedAgent);
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'UPDATE_AGENT', 'FAILED'),
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
      // Delete all versions for this agent first
      await this.deleteVersionsByParentId(id);

      // Then delete the agent
      const collection = await this.getCollection(TABLE_AGENTS);
      // Idempotent delete - no-op if agent doesn't exist
      await collection.deleteOne({ id });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'DELETE_AGENT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { id },
        },
        error,
      );
    }
  }

  async list(args?: StorageListAgentsInput): Promise<StorageListAgentsOutput> {
    try {
      const { page = 0, perPage: perPageInput, orderBy, authorId, metadata, status } = args || {};
      const { field, direction } = this.parseOrderBy(orderBy);

      if (page < 0) {
        throw new MastraError(
          {
            id: createStorageErrorId('MONGODB', 'LIST_AGENTS', 'INVALID_PAGE'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            details: { page },
          },
          new Error('page must be >= 0'),
        );
      }

      const perPage = normalizePerPage(perPageInput, 100);
      const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

      const collection = await this.getCollection(TABLE_AGENTS);

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
          agents: [],
          total,
          page,
          perPage: perPageForResponse,
          hasMore: false,
        };
      }

      // MongoDB sort: 1 = ASC, -1 = DESC
      const sortOrder = direction === 'ASC' ? 1 : -1;

      let cursor = collection
        .find(filter)
        .sort({ [field]: sortOrder })
        .skip(offset);

      if (perPageInput !== false) {
        cursor = cursor.limit(perPage);
      }

      const results = await cursor.toArray();
      const agents = results.map((doc: any) => this.transformAgent(doc));

      return {
        agents,
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
          id: createStorageErrorId('MONGODB', 'LIST_AGENTS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  /**
   * Transforms a raw MongoDB document into a thin StorageAgentType record.
   * Only returns metadata-level fields (no config/snapshot fields).
   */
  private transformAgent(doc: any): StorageAgentType {
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

  /**
   * Serializes a thin StorageAgentType record for MongoDB insertion.
   * Only persists metadata-level fields.
   */
  private serializeAgent(agent: StorageAgentType): Record<string, any> {
    return {
      id: agent.id,
      status: agent.status,
      activeVersionId: agent.activeVersionId,
      authorId: agent.authorId,
      metadata: agent.metadata,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
    };
  }

  // ==========================================================================
  // Agent Version Methods
  // ==========================================================================

  async createVersion(input: CreateVersionInput): Promise<AgentVersion> {
    try {
      const collection = await this.getCollection(TABLE_AGENT_VERSIONS);
      const now = new Date();

      // Store all config fields directly on the version document (no nested snapshot)
      const versionDoc: Record<string, any> = {
        id: input.id,
        agentId: input.agentId,
        versionNumber: input.versionNumber,
        changedFields: input.changedFields ?? undefined,
        changeMessage: input.changeMessage ?? undefined,
        createdAt: now,
      };

      // Copy all snapshot config fields directly onto the document
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
          id: createStorageErrorId('MONGODB', 'CREATE_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { versionId: input.id, agentId: input.agentId },
        },
        error,
      );
    }
  }

  async getVersion(id: string): Promise<AgentVersion | null> {
    try {
      const collection = await this.getCollection(TABLE_AGENT_VERSIONS);
      const result = await collection.findOne<any>({ id });

      if (!result) {
        return null;
      }

      return this.transformVersion(result);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'GET_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { versionId: id },
        },
        error,
      );
    }
  }

  async getVersionByNumber(agentId: string, versionNumber: number): Promise<AgentVersion | null> {
    try {
      const collection = await this.getCollection(TABLE_AGENT_VERSIONS);
      const result = await collection.findOne<any>({ agentId, versionNumber });

      if (!result) {
        return null;
      }

      return this.transformVersion(result);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'GET_VERSION_BY_NUMBER', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { agentId, versionNumber },
        },
        error,
      );
    }
  }

  async getLatestVersion(agentId: string): Promise<AgentVersion | null> {
    try {
      const collection = await this.getCollection(TABLE_AGENT_VERSIONS);
      const result = await collection.find<any>({ agentId }).sort({ versionNumber: -1 }).limit(1).toArray();

      if (!result || result.length === 0) {
        return null;
      }

      return this.transformVersion(result[0]);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'GET_LATEST_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { agentId },
        },
        error,
      );
    }
  }

  async listVersions(input: ListVersionsInput): Promise<ListVersionsOutput> {
    const { agentId, page = 0, perPage: perPageInput, orderBy } = input;

    if (page < 0) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'LIST_VERSIONS', 'INVALID_PAGE'),
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
      const collection = await this.getCollection(TABLE_AGENT_VERSIONS);

      // Get total count
      const total = await collection.countDocuments({ agentId });

      if (total === 0 || perPage === 0) {
        return {
          versions: [],
          total,
          page,
          perPage: perPageForResponse,
          hasMore: false,
        };
      }

      // MongoDB sort: 1 = ASC, -1 = DESC
      const sortOrder = direction === 'ASC' ? 1 : -1;

      let cursor = collection
        .find({ agentId })
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
          id: createStorageErrorId('MONGODB', 'LIST_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { agentId },
        },
        error,
      );
    }
  }

  async deleteVersion(id: string): Promise<void> {
    try {
      const collection = await this.getCollection(TABLE_AGENT_VERSIONS);
      await collection.deleteOne({ id });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'DELETE_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { versionId: id },
        },
        error,
      );
    }
  }

  async deleteVersionsByParentId(agentId: string): Promise<void> {
    try {
      const collection = await this.getCollection(TABLE_AGENT_VERSIONS);
      await collection.deleteMany({ agentId });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'DELETE_VERSIONS_BY_AGENT_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { agentId },
        },
        error,
      );
    }
  }

  async countVersions(agentId: string): Promise<number> {
    try {
      const collection = await this.getCollection(TABLE_AGENT_VERSIONS);
      return await collection.countDocuments({ agentId });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'COUNT_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { agentId },
        },
        error,
      );
    }
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  /**
   * Extracts just the snapshot config fields from a version.
   */
  /**
   * Transforms a raw MongoDB version document into an AgentVersion.
   * Config fields are returned directly (no nested snapshot object).
   */
  private transformVersion(doc: any): AgentVersion {
    const { _id, ...version } = doc;

    const result: any = {
      id: version.id,
      agentId: version.agentId,
      versionNumber: version.versionNumber,
      changedFields: version.changedFields,
      changeMessage: version.changeMessage,
      createdAt: version.createdAt instanceof Date ? version.createdAt : new Date(version.createdAt),
    };

    // Copy all snapshot config fields directly onto the result
    for (const field of SNAPSHOT_FIELDS) {
      if (version[field] !== undefined) {
        result[field] = version[field];
      }
    }

    return result as AgentVersion;
  }
}
