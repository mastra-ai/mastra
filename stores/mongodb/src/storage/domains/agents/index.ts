import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  AgentsStorage,
  createStorageErrorId,
  TABLE_AGENTS,
  normalizePerPage,
  calculatePagination,
} from '@mastra/core/storage';
import type {
  StorageAgentType,
  StorageCreateAgentInput,
  StorageUpdateAgentInput,
  StorageListAgentsInput,
  StorageListAgentsOutput,
  ThreadOrderBy,
  ThreadSortDirection,
} from '@mastra/core/storage';
import type { MongoDBConnector } from '../../connectors/MongoDBConnector';

export class MongoDBAgentsStorage extends AgentsStorage {
  private connector: MongoDBConnector;

  constructor({ connector }: { connector: MongoDBConnector }) {
    super();
    this.connector = connector;
  }

  async init(): Promise<void> {
    const collection = await this.connector.getCollection(TABLE_AGENTS);

    // Create indexes for efficient querying
    await collection.createIndex({ id: 1 }, { unique: true });
    await collection.createIndex({ createdAt: -1 });
    await collection.createIndex({ updatedAt: -1 });
  }

  async dangerouslyClearAll(): Promise<void> {
    const collection = await this.connector.getCollection(TABLE_AGENTS);
    await collection.deleteMany({});
  }

  async getAgentById({ id }: { id: string }): Promise<StorageAgentType | null> {
    try {
      const collection = await this.connector.getCollection(TABLE_AGENTS);
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
      const collection = await this.connector.getCollection(TABLE_AGENTS);

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
      const collection = await this.connector.getCollection(TABLE_AGENTS);

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
      if (updates.inputProcessors !== undefined) updateDoc.inputProcessors = updates.inputProcessors;
      if (updates.outputProcessors !== undefined) updateDoc.outputProcessors = updates.outputProcessors;
      if (updates.memory !== undefined) updateDoc.memory = updates.memory;
      if (updates.scorers !== undefined) updateDoc.scorers = updates.scorers;

      // Merge metadata if provided
      if (updates.metadata !== undefined) {
        const existingMetadata = existingAgent.metadata || {};
        updateDoc.metadata = { ...existingMetadata, ...updates.metadata };
      }

      await collection.updateOne({ id }, { $set: updateDoc });

      const updatedAgent = await collection.findOne<any>({ id });
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
      const collection = await this.connector.getCollection(TABLE_AGENTS);
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
      const { page = 0, perPage: perPageInput, orderBy } = args || {};
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

      const collection = await this.connector.getCollection(TABLE_AGENTS);
      const total = await collection.countDocuments({});

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
        .find({})
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
}
