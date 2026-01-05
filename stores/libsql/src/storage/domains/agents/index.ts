import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  AgentsStorage,
  createStorageErrorId,
  normalizePerPage,
  calculatePagination,
  TABLE_AGENTS,
  AGENTS_SCHEMA,
} from '@mastra/core/storage';
import type {
  StorageAgentType,
  StorageCreateAgentInput,
  StorageUpdateAgentInput,
  StorageListAgentsInput,
  StorageListAgentsOutput,
} from '@mastra/core/storage';
import { LibSQLDB, resolveClient } from '../../db';
import type { LibSQLDomainConfig } from '../../db';

export class AgentsLibSQL extends AgentsStorage {
  #db: LibSQLDB;

  constructor(config: LibSQLDomainConfig) {
    super();
    const client = resolveClient(config);
    this.#db = new LibSQLDB({ client, maxRetries: config.maxRetries, initialBackoffMs: config.initialBackoffMs });
  }

  async init(): Promise<void> {
    await this.#db.createTable({ tableName: TABLE_AGENTS, schema: AGENTS_SCHEMA });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.deleteData({ tableName: TABLE_AGENTS });
  }

  private parseJson(value: any, fieldName?: string): any {
    if (!value) return undefined;
    if (typeof value !== 'string') return value;

    try {
      return JSON.parse(value);
    } catch (error) {
      const details: Record<string, string> = {
        value: value.length > 100 ? value.substring(0, 100) + '...' : value,
      };
      if (fieldName) {
        details.field = fieldName;
      }

      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'PARSE_JSON', 'INVALID_JSON'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.SYSTEM,
          text: `Failed to parse JSON${fieldName ? ` for field "${fieldName}"` : ''}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          details,
        },
        error,
      );
    }
  }

  private parseRow(row: any): StorageAgentType {
    return {
      id: row.id as string,
      name: row.name as string,
      description: row.description as string | undefined,
      instructions: row.instructions as string,
      model: this.parseJson(row.model, 'model'),
      tools: this.parseJson(row.tools, 'tools'),
      defaultOptions: this.parseJson(row.defaultOptions, 'defaultOptions'),
      workflows: this.parseJson(row.workflows, 'workflows'),
      agents: this.parseJson(row.agents, 'agents'),
      inputProcessors: this.parseJson(row.inputProcessors, 'inputProcessors'),
      outputProcessors: this.parseJson(row.outputProcessors, 'outputProcessors'),
      memory: this.parseJson(row.memory, 'memory'),
      scorers: this.parseJson(row.scorers, 'scorers'),
      metadata: this.parseJson(row.metadata, 'metadata'),
      createdAt: new Date(row.createdAt as string),
      updatedAt: new Date(row.updatedAt as string),
    };
  }

  async getAgentById({ id }: { id: string }): Promise<StorageAgentType | null> {
    try {
      const result = await this.#db.select<Record<string, any>>({
        tableName: TABLE_AGENTS,
        keys: { id },
      });

      return result ? this.parseRow(result) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_AGENT_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { agentId: id },
        },
        error,
      );
    }
  }

  async createAgent({ agent }: { agent: StorageCreateAgentInput }): Promise<StorageAgentType> {
    try {
      const now = new Date();

      await this.#db.insert({
        tableName: TABLE_AGENTS,
        record: {
          id: agent.id,
          name: agent.name,
          description: agent.description ?? null,
          instructions: agent.instructions,
          model: agent.model,
          tools: agent.tools ?? null,
          defaultOptions: agent.defaultOptions ?? null,
          workflows: agent.workflows ?? null,
          agents: agent.agents ?? null,
          inputProcessors: agent.inputProcessors ?? null,
          outputProcessors: agent.outputProcessors ?? null,
          memory: agent.memory ?? null,
          scorers: agent.scorers ?? null,
          metadata: agent.metadata ?? null,
          createdAt: now,
          updatedAt: now,
        },
      });

      return {
        ...agent,
        createdAt: now,
        updatedAt: now,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'CREATE_AGENT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { agentId: agent.id },
        },
        error,
      );
    }
  }

  async updateAgent({ id, ...updates }: StorageUpdateAgentInput): Promise<StorageAgentType> {
    try {
      // First, get the existing agent
      const existingAgent = await this.getAgentById({ id });
      if (!existingAgent) {
        throw new MastraError({
          id: createStorageErrorId('LIBSQL', 'UPDATE_AGENT', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: `Agent ${id} not found`,
          details: { agentId: id },
        });
      }

      // Build the data object with only the fields that are being updated
      const data: Record<string, any> = {
        updatedAt: new Date(),
      };

      if (updates.name !== undefined) data.name = updates.name;
      if (updates.description !== undefined) data.description = updates.description;
      if (updates.instructions !== undefined) data.instructions = updates.instructions;
      if (updates.model !== undefined) data.model = updates.model;
      if (updates.tools !== undefined) data.tools = updates.tools;
      if (updates.defaultOptions !== undefined) data.defaultOptions = updates.defaultOptions;
      if (updates.workflows !== undefined) data.workflows = updates.workflows;
      if (updates.agents !== undefined) data.agents = updates.agents;
      if (updates.inputProcessors !== undefined) data.inputProcessors = updates.inputProcessors;
      if (updates.outputProcessors !== undefined) data.outputProcessors = updates.outputProcessors;
      if (updates.memory !== undefined) data.memory = updates.memory;
      if (updates.scorers !== undefined) data.scorers = updates.scorers;
      if (updates.metadata !== undefined) {
        // Merge metadata
        data.metadata = { ...existingAgent.metadata, ...updates.metadata };
      }

      // Only update if there's more than just updatedAt
      if (Object.keys(data).length > 1) {
        await this.#db.update({
          tableName: TABLE_AGENTS,
          keys: { id },
          data,
        });
      }

      // Return the updated agent
      const updatedAgent = await this.getAgentById({ id });
      if (!updatedAgent) {
        throw new MastraError({
          id: createStorageErrorId('LIBSQL', 'UPDATE_AGENT', 'NOT_FOUND_AFTER_UPDATE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.SYSTEM,
          text: `Agent ${id} not found after update`,
          details: { agentId: id },
        });
      }

      return updatedAgent;
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'UPDATE_AGENT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { agentId: id },
        },
        error,
      );
    }
  }

  async deleteAgent({ id }: { id: string }): Promise<void> {
    try {
      await this.#db.delete({
        tableName: TABLE_AGENTS,
        keys: { id },
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'DELETE_AGENT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { agentId: id },
        },
        error,
      );
    }
  }

  async listAgents(args?: StorageListAgentsInput): Promise<StorageListAgentsOutput> {
    const { page = 0, perPage: perPageInput, orderBy } = args || {};
    const { field, direction } = this.parseOrderBy(orderBy);

    if (page < 0) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'LIST_AGENTS', 'INVALID_PAGE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { page },
        },
        new Error('page must be >= 0'),
      );
    }

    const perPage = normalizePerPage(perPageInput, 100);
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    try {
      // Get total count
      const total = await this.#db.selectTotalCount({ tableName: TABLE_AGENTS });

      if (total === 0) {
        return {
          agents: [],
          total: 0,
          page,
          perPage: perPageForResponse,
          hasMore: false,
        };
      }

      // Get paginated results
      const limitValue = perPageInput === false ? total : perPage;
      const rows = await this.#db.selectMany<Record<string, any>>({
        tableName: TABLE_AGENTS,
        orderBy: `"${field}" ${direction}`,
        limit: limitValue,
        offset,
      });

      const agents = rows.map(row => this.parseRow(row));

      return {
        agents,
        total,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : offset + perPage < total,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'LIST_AGENTS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }
}
