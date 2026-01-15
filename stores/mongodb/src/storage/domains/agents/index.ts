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
  AgentVersion,
  CreateVersionInput,
  ListVersionsInput,
  ListVersionsOutput,
} from '@mastra/core/storage';
import type { MongoDBConnector } from '../../connectors/MongoDBConnector';
import { resolveMongoDBConfig } from '../../db';
import type { MongoDBDomainConfig, MongoDBIndexConfig } from '../../types';

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
      { collection: TABLE_AGENTS, keys: { ownerId: 1 } },
      // Agent versions indexes
      { collection: TABLE_AGENT_VERSIONS, keys: { id: 1 }, options: { unique: true } },
      { collection: TABLE_AGENT_VERSIONS, keys: { agentId: 1 } },
      { collection: TABLE_AGENT_VERSIONS, keys: { agentId: 1, versionNumber: 1 }, options: { unique: true } },
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
  }

  async dangerouslyClearAll(): Promise<void> {
    const agentsCollection = await this.getCollection(TABLE_AGENTS);
    await agentsCollection.deleteMany({});
    const versionsCollection = await this.getCollection(TABLE_AGENT_VERSIONS);
    await versionsCollection.deleteMany({});
  }

  async getAgentById({ id }: { id: string }): Promise<StorageAgentType | null> {
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

  async createAgent({ agent }: { agent: StorageCreateAgentInput }): Promise<StorageAgentType> {
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
      const newAgent: StorageAgentType = {
        ...agent,
        createdAt: now,
        updatedAt: now,
      };

      await collection.insertOne(this.serializeAgent(newAgent));

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

  async updateAgent({ id, ...updates }: StorageUpdateAgentInput): Promise<StorageAgentType> {
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

      if (updates.name !== undefined) updateDoc.name = updates.name;
      if (updates.description !== undefined) updateDoc.description = updates.description;
      if (updates.instructions !== undefined) updateDoc.instructions = updates.instructions;
      if (updates.model !== undefined) updateDoc.model = updates.model;
      if (updates.tools !== undefined) updateDoc.tools = updates.tools;
      if (updates.defaultOptions !== undefined) updateDoc.defaultOptions = updates.defaultOptions;
      if (updates.workflows !== undefined) updateDoc.workflows = updates.workflows;
      if (updates.agents !== undefined) updateDoc.agents = updates.agents;
      if (updates.integrations !== undefined) updateDoc.integrations = updates.integrations;
      if (updates.integrationTools !== undefined) updateDoc.integrationTools = updates.integrationTools;
      if (updates.inputProcessors !== undefined) updateDoc.inputProcessors = updates.inputProcessors;
      if (updates.outputProcessors !== undefined) updateDoc.outputProcessors = updates.outputProcessors;
      if (updates.memory !== undefined) updateDoc.memory = updates.memory;
      if (updates.scorers !== undefined) updateDoc.scorers = updates.scorers;

      // Merge metadata if provided
      if (updates.metadata !== undefined) {
        const existingMetadata = existingAgent.metadata || {};
        updateDoc.metadata = { ...existingMetadata, ...updates.metadata };
      }

      if (updates.ownerId !== undefined) updateDoc.ownerId = updates.ownerId;
      if (updates.activeVersionId !== undefined) updateDoc.activeVersionId = updates.activeVersionId;

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

  async deleteAgent({ id }: { id: string }): Promise<void> {
    try {
      // First delete all versions for this agent
      await this.deleteVersionsByAgentId(id);

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

  async listAgents(args?: StorageListAgentsInput): Promise<StorageListAgentsOutput> {
    try {
      const { page = 0, perPage: perPageInput, orderBy, ownerId, metadata } = args || {};
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

      // Build filter query
      const filter: Record<string, any> = {};

      if (ownerId !== undefined) {
        filter.ownerId = ownerId;
      }

      // Filter by metadata (AND logic - all key-value pairs must match)
      if (metadata && Object.keys(metadata).length > 0) {
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

  private transformAgent(doc: any): StorageAgentType {
    const { _id, ...agent } = doc;
    return {
      ...agent,
      createdAt: agent.createdAt instanceof Date ? agent.createdAt : new Date(agent.createdAt),
      updatedAt: agent.updatedAt instanceof Date ? agent.updatedAt : new Date(agent.updatedAt),
    };
  }

  private serializeAgent(agent: StorageAgentType): Record<string, any> {
    return {
      ...agent,
    };
  }

  // ==========================================================================
  // Agent Version Methods
  // ==========================================================================

  private transformVersion(doc: any): AgentVersion {
    const { _id, ...version } = doc;
    return {
      ...version,
      createdAt: version.createdAt instanceof Date ? version.createdAt : new Date(version.createdAt),
    };
  }

  async createVersion(input: CreateVersionInput): Promise<AgentVersion> {
    try {
      const collection = await this.getCollection(TABLE_AGENT_VERSIONS);
      const now = new Date();

      const newVersion: AgentVersion = {
        ...input,
        createdAt: now,
      };

      await collection.insertOne(newVersion);
      return newVersion;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'CREATE_AGENT_VERSION', 'FAILED'),
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

      return result ? this.transformVersion(result) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'GET_AGENT_VERSION', 'FAILED'),
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

      return result ? this.transformVersion(result) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'GET_AGENT_VERSION_BY_NUMBER', 'FAILED'),
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
      const result = await collection.findOne<any>({ agentId }, { sort: { versionNumber: -1 } });

      return result ? this.transformVersion(result) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'GET_LATEST_AGENT_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { agentId },
        },
        error,
      );
    }
  }

  async listVersions(input: ListVersionsInput): Promise<ListVersionsOutput> {
    try {
      const { agentId, page = 0, perPage: perPageInput, orderBy } = input;
      const { field, direction } = this.parseVersionOrderBy(orderBy);

      if (page < 0) {
        throw new MastraError(
          {
            id: createStorageErrorId('MONGODB', 'LIST_AGENT_VERSIONS', 'INVALID_PAGE'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            details: { page },
          },
          new Error('page must be >= 0'),
        );
      }

      const perPage = normalizePerPage(perPageInput, 20);
      const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

      const collection = await this.getCollection(TABLE_AGENT_VERSIONS);

      const filter = { agentId };
      const total = await collection.countDocuments(filter);

      if (total === 0 || perPage === 0) {
        return {
          versions: [],
          total,
          page,
          perPage: perPageForResponse === false ? 0 : perPageForResponse,
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
      const versions = results.map((doc: any) => this.transformVersion(doc));

      return {
        versions,
        total,
        page,
        perPage: perPageForResponse === false ? total : perPageForResponse,
        hasMore: perPageInput !== false && offset + perPage < total,
      };
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'LIST_AGENT_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { agentId: input.agentId },
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
          id: createStorageErrorId('MONGODB', 'DELETE_AGENT_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { versionId: id },
        },
        error,
      );
    }
  }

  async deleteVersionsByAgentId(agentId: string): Promise<void> {
    try {
      const collection = await this.getCollection(TABLE_AGENT_VERSIONS);
      await collection.deleteMany({ agentId });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('MONGODB', 'DELETE_AGENT_VERSIONS_BY_AGENT', 'FAILED'),
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
          id: createStorageErrorId('MONGODB', 'COUNT_AGENT_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { agentId },
        },
        error,
      );
    }
  }
}
