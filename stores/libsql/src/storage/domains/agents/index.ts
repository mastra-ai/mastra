import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  AgentsStorage,
  createStorageErrorId,
  normalizePerPage,
  calculatePagination,
  TABLE_AGENTS,
  TABLE_AGENT_VERSIONS,
  AGENTS_SCHEMA,
  AGENT_VERSIONS_SCHEMA,
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
    await this.#db.createTable({ tableName: TABLE_AGENT_VERSIONS, schema: AGENT_VERSIONS_SCHEMA });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.deleteData({ tableName: TABLE_AGENT_VERSIONS });
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
      integrations: this.parseJson(row.integrations, 'integrations'),
      integrationTools: this.parseJson(row.integrationTools, 'integrationTools'),
      ownerId: row.ownerId as string | undefined,
      activeVersionId: row.activeVersionId as string | undefined,
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
          integrations: agent.integrations ?? null,
          integrationTools: agent.integrationTools ?? null,
          ownerId: agent.ownerId ?? null,
          activeVersionId: agent.activeVersionId ?? null,
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
      if (updates.integrations !== undefined) data.integrations = updates.integrations;
      if (updates.integrationTools !== undefined) data.integrationTools = updates.integrationTools;
      if (updates.ownerId !== undefined) data.ownerId = updates.ownerId;
      if (updates.activeVersionId !== undefined) data.activeVersionId = updates.activeVersionId;
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
      // Delete all versions for this agent first
      await this.deleteVersionsByAgentId(id);

      // Then delete the agent
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

  // ==========================================================================
  // Agent Version Methods
  // ==========================================================================

  async createVersion(input: CreateVersionInput): Promise<AgentVersion> {
    try {
      const now = new Date();

      await this.#db.insert({
        tableName: TABLE_AGENT_VERSIONS,
        record: {
          id: input.id,
          agentId: input.agentId,
          versionNumber: input.versionNumber,
          name: input.name ?? null,
          snapshot: input.snapshot,
          changedFields: input.changedFields ?? null,
          changeMessage: input.changeMessage ?? null,
          createdAt: now,
        },
      });

      return {
        ...input,
        createdAt: now,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'CREATE_VERSION', 'FAILED'),
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
      const result = await this.#db.select<Record<string, any>>({
        tableName: TABLE_AGENT_VERSIONS,
        keys: { id },
      });

      if (!result) {
        return null;
      }

      return this.parseVersionRow(result);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_VERSION', 'FAILED'),
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
      const rows = await this.#db.selectMany<Record<string, any>>({
        tableName: TABLE_AGENT_VERSIONS,
        whereClause: {
          sql: 'WHERE agentId = ? AND versionNumber = ?',
          args: [agentId, versionNumber],
        },
        limit: 1,
      });

      if (!rows || rows.length === 0) {
        return null;
      }

      return this.parseVersionRow(rows[0]);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_VERSION_BY_NUMBER', 'FAILED'),
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
      const rows = await this.#db.selectMany<Record<string, any>>({
        tableName: TABLE_AGENT_VERSIONS,
        whereClause: {
          sql: 'WHERE agentId = ?',
          args: [agentId],
        },
        orderBy: 'versionNumber DESC',
        limit: 1,
      });

      if (!rows || rows.length === 0) {
        return null;
      }

      return this.parseVersionRow(rows[0]);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_LATEST_VERSION', 'FAILED'),
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
          id: createStorageErrorId('LIBSQL', 'LIST_VERSIONS', 'INVALID_PAGE'),
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

      // Get total count
      const total = await this.#db.selectTotalCount({
        tableName: TABLE_AGENT_VERSIONS,
        whereClause: {
          sql: 'WHERE agentId = ?',
          args: [agentId],
        },
      });

      if (total === 0) {
        return {
          versions: [],
          total: 0,
          page,
          perPage: perPageForResponse,
          hasMore: false,
        };
      }

      // Get paginated results
      const limitValue = perPageInput === false ? total : perPage;
      const rows = await this.#db.selectMany<Record<string, any>>({
        tableName: TABLE_AGENT_VERSIONS,
        whereClause: {
          sql: 'WHERE agentId = ?',
          args: [agentId],
        },
        orderBy: `"${field}" ${direction}`,
        limit: limitValue,
        offset,
      });

      const versions = rows.map(row => this.parseVersionRow(row));

      return {
        versions,
        total,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : offset + perPage < total,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'LIST_VERSIONS', 'FAILED'),
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
      await this.#db.delete({
        tableName: TABLE_AGENT_VERSIONS,
        keys: { id },
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'DELETE_VERSION', 'FAILED'),
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
      // Get all version IDs for this agent
      const versions = await this.#db.selectMany<{ id: string }>({
        tableName: TABLE_AGENT_VERSIONS,
        whereClause: {
          sql: 'WHERE agentId = ?',
          args: [agentId],
        },
      });

      // Delete each version individually
      for (const version of versions) {
        await this.#db.delete({
          tableName: TABLE_AGENT_VERSIONS,
          keys: { id: version.id },
        });
      }
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'DELETE_VERSIONS_BY_AGENT_ID', 'FAILED'),
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
      const count = await this.#db.selectTotalCount({
        tableName: TABLE_AGENT_VERSIONS,
        whereClause: {
          sql: 'WHERE agentId = ?',
          args: [agentId],
        },
      });
      return count;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'COUNT_VERSIONS', 'FAILED'),
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

  private parseVersionRow(row: any): AgentVersion {
    return {
      id: row.id as string,
      agentId: row.agentId as string,
      versionNumber: row.versionNumber as number,
      name: row.name as string | undefined,
      snapshot: this.parseJson(row.snapshot, 'snapshot'),
      changedFields: this.parseJson(row.changedFields, 'changedFields'),
      changeMessage: row.changeMessage as string | undefined,
      createdAt: new Date(row.createdAt as string),
    };
  }
}
