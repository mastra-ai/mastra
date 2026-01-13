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
    // Create agents table
    await this.#db.createTable({ tableName: TABLE_AGENTS, schema: AGENTS_SCHEMA });
    // Add any new columns that may not exist in older tables
    await this.#db.alterTable({
      tableName: TABLE_AGENTS,
      schema: AGENTS_SCHEMA,
      ifNotExists: ['ownerId', 'activeVersionId'],
    });

    // Create agent versions table
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
      metadata: this.parseJson(row.metadata, 'metadata'),
      ownerId: row.ownerId as string | undefined,
      activeVersionId: row.activeVersionId as string | undefined,
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
          ownerId: agent.ownerId ?? null,
          activeVersionId: agent.activeVersionId ?? null,
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
      if (updates.ownerId !== undefined) data.ownerId = updates.ownerId;
      if (updates.activeVersionId !== undefined) data.activeVersionId = updates.activeVersionId;

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
      // First delete all versions for this agent
      await this.deleteVersionsByAgentId(id);

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
    const { page = 0, perPage: perPageInput, orderBy, ownerId, metadata } = args || {};
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
      // Build WHERE clause for filtering
      const whereClauses: string[] = [];
      const whereValues: any[] = [];

      if (ownerId !== undefined) {
        whereClauses.push(`"ownerId" = ?`);
        whereValues.push(ownerId);
      }

      // Filter by metadata using JSON extraction (SQLite/LibSQL syntax)
      if (metadata && Object.keys(metadata).length > 0) {
        for (const [key, value] of Object.entries(metadata)) {
          whereClauses.push(`json_extract(metadata, '$.${key}') = ?`);
          whereValues.push(typeof value === 'string' ? value : JSON.stringify(value));
        }
      }

      const whereClause =
        whereClauses.length > 0 ? { sql: `WHERE ${whereClauses.join(' AND ')}`, args: whereValues } : undefined;

      // Get total count with filters
      const total = await this.#db.selectTotalCount({
        tableName: TABLE_AGENTS,
        whereClause,
      });

      if (total === 0) {
        return {
          agents: [],
          total: 0,
          page,
          perPage: perPageForResponse,
          hasMore: false,
        };
      }

      // Get paginated results with filters
      const limitValue = perPageInput === false ? total : perPage;
      const rows = await this.#db.selectMany<Record<string, any>>({
        tableName: TABLE_AGENTS,
        orderBy: `"${field}" ${direction}`,
        limit: limitValue,
        offset,
        whereClause,
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

  private parseVersionRow(row: Record<string, unknown>): AgentVersion {
    return {
      id: row.id as string,
      agentId: row.agentId as string,
      versionNumber: row.versionNumber as number,
      name: (row.name as string) || undefined,
      snapshot: this.parseJson(row.snapshot, 'snapshot') as AgentVersion['snapshot'],
      changedFields: row.changedFields ? (this.parseJson(row.changedFields, 'changedFields') as string[]) : undefined,
      changeMessage: (row.changeMessage as string) || undefined,
      createdAt: new Date(row.createdAt as string),
    };
  }

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
          id: createStorageErrorId('LIBSQL', 'CREATE_AGENT_VERSION', 'FAILED'),
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
      const result = await this.#db.select<Record<string, unknown>>({
        tableName: TABLE_AGENT_VERSIONS,
        keys: { id },
      });

      return result ? this.parseVersionRow(result) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_AGENT_VERSION', 'FAILED'),
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
      const rows = await this.#db.selectMany<Record<string, unknown>>({
        tableName: TABLE_AGENT_VERSIONS,
        whereClause: {
          sql: 'WHERE "agentId" = ? AND "versionNumber" = ?',
          args: [agentId, versionNumber],
        },
        limit: 1,
      });

      return rows.length > 0 ? this.parseVersionRow(rows[0]!) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_AGENT_VERSION_BY_NUMBER', 'FAILED'),
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
      const rows = await this.#db.selectMany<Record<string, unknown>>({
        tableName: TABLE_AGENT_VERSIONS,
        whereClause: {
          sql: 'WHERE "agentId" = ?',
          args: [agentId],
        },
        orderBy: '"versionNumber" DESC',
        limit: 1,
      });

      return rows.length > 0 ? this.parseVersionRow(rows[0]!) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_LATEST_AGENT_VERSION', 'FAILED'),
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
    const { field, direction } = this.parseVersionOrderBy(orderBy);

    if (page < 0) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'LIST_AGENT_VERSIONS', 'INVALID_PAGE'),
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
      const whereClause = {
        sql: 'WHERE "agentId" = ?',
        args: [agentId],
      };

      // Get total count
      const total = await this.#db.selectTotalCount({
        tableName: TABLE_AGENT_VERSIONS,
        whereClause,
      });

      if (total === 0) {
        return {
          versions: [],
          total: 0,
          page,
          perPage: perPageForResponse === false ? 0 : perPageForResponse,
          hasMore: false,
        };
      }

      // Get paginated results
      const fieldColumn = field === 'createdAt' ? '"createdAt"' : '"versionNumber"';
      const rows = await this.#db.selectMany<Record<string, unknown>>({
        tableName: TABLE_AGENT_VERSIONS,
        whereClause,
        orderBy: `${fieldColumn} ${direction}`,
        limit: perPage,
        offset,
      });

      const versions = rows.map(row => this.parseVersionRow(row));

      return {
        versions,
        total,
        page,
        perPage: perPageForResponse === false ? total : perPageForResponse,
        hasMore: offset + perPage < total,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'LIST_AGENT_VERSIONS', 'FAILED'),
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
          id: createStorageErrorId('LIBSQL', 'DELETE_AGENT_VERSION', 'FAILED'),
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
      // Get all versions for this agent and delete them one by one
      const versions = await this.#db.selectMany<Record<string, unknown>>({
        tableName: TABLE_AGENT_VERSIONS,
        whereClause: {
          sql: 'WHERE "agentId" = ?',
          args: [agentId],
        },
      });

      for (const version of versions) {
        await this.#db.delete({
          tableName: TABLE_AGENT_VERSIONS,
          keys: { id: version.id as string },
        });
      }
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'DELETE_AGENT_VERSIONS_BY_AGENT', 'FAILED'),
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
      const total = await this.#db.selectTotalCount({
        tableName: TABLE_AGENT_VERSIONS,
        whereClause: {
          sql: 'WHERE "agentId" = ?',
          args: [agentId],
        },
      });

      return total;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'COUNT_AGENT_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { agentId },
        },
        error,
      );
    }
  }
}
