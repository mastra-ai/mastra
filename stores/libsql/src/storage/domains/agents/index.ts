import type { Client } from '@libsql/client';
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
  #client: Client;

  constructor(config: LibSQLDomainConfig) {
    super();
    const client = resolveClient(config);
    this.#client = client;
    this.#db = new LibSQLDB({ client, maxRetries: config.maxRetries, initialBackoffMs: config.initialBackoffMs });
  }

  async init(): Promise<void> {
    // Migrate from legacy schemas before creating tables
    await this.#migrateFromLegacySchema();
    await this.#migrateVersionsSchema();

    await this.#db.createTable({ tableName: TABLE_AGENTS, schema: AGENTS_SCHEMA });
    await this.#db.createTable({ tableName: TABLE_AGENT_VERSIONS, schema: AGENT_VERSIONS_SCHEMA });
    // Add new columns for backwards compatibility with intermediate schema versions
    await this.#db.alterTable({
      tableName: TABLE_AGENTS,
      schema: AGENTS_SCHEMA,
      ifNotExists: ['status', 'authorId'],
    });

    // Clean up any stale draft records from previously failed createAgent calls
    await this.#cleanupStaleDrafts();
  }

  /**
   * Migrates from the legacy flat agent schema (where config fields like name, instructions, model
   * were stored directly on mastra_agents) to the new versioned schema (thin agent record + versions table).
   * SQLite cannot drop columns or alter NOT NULL constraints, so we must recreate the table.
   */
  async #migrateFromLegacySchema(): Promise<void> {
    const hasLegacyColumns = await this.#db.hasColumn(TABLE_AGENTS, 'name');
    if (!hasLegacyColumns) return;

    // Read all existing agents from the old flat schema
    const result = await this.#client.execute({
      sql: `SELECT * FROM "${TABLE_AGENTS}"`,
    });
    const oldAgents = result.rows || [];

    // Rename old table, create new one, migrate data
    await this.#client.execute({
      sql: `ALTER TABLE "${TABLE_AGENTS}" RENAME TO "${TABLE_AGENTS}_legacy"`,
    });

    // Drop old versions table if it exists (may have incompatible schema with snapshot column)
    await this.#client.execute({
      sql: `DROP TABLE IF EXISTS "${TABLE_AGENT_VERSIONS}"`,
    });

    await this.#db.createTable({ tableName: TABLE_AGENTS, schema: AGENTS_SCHEMA });
    await this.#db.createTable({ tableName: TABLE_AGENT_VERSIONS, schema: AGENT_VERSIONS_SCHEMA });

    for (const row of oldAgents) {
      const agentId = row.id as string;
      if (!agentId) continue;

      const versionId = crypto.randomUUID();
      const now = new Date();

      await this.#db.insert({
        tableName: TABLE_AGENTS,
        record: {
          id: agentId,
          status: 'published',
          activeVersionId: versionId,
          authorId: (row.ownerId as string) ?? (row.authorId as string) ?? null,
          metadata: row.metadata ?? null,
          createdAt: row.createdAt ?? now,
          updatedAt: row.updatedAt ?? now,
        },
      });

      await this.#db.insert({
        tableName: TABLE_AGENT_VERSIONS,
        record: {
          id: versionId,
          agentId,
          versionNumber: 1,
          name: (row.name as string) ?? agentId,
          description: row.description ?? null,
          instructions: (row.instructions as string) ?? '',
          model: row.model ?? '{}',
          tools: row.tools ?? null,
          defaultOptions: row.defaultOptions ?? null,
          workflows: row.workflows ?? null,
          agents: row.agents ?? null,
          integrationTools: row.integrationTools ?? null,
          inputProcessors: row.inputProcessors ?? null,
          outputProcessors: row.outputProcessors ?? null,
          memory: row.memory ?? null,
          scorers: row.scorers ?? null,
          changedFields: null,
          changeMessage: 'Migrated from legacy schema',
          createdAt: row.createdAt ?? now,
        },
      });
    }

    await this.#client.execute({
      sql: `DROP TABLE IF EXISTS "${TABLE_AGENTS}_legacy"`,
    });
  }

  /**
   * Migrates the agent_versions table from the old snapshot-based schema (single `snapshot` JSON column)
   * to the new flat schema (individual config columns). This handles the case where the agents table
   * was already migrated but the versions table still has the old schema.
   */
  async #migrateVersionsSchema(): Promise<void> {
    const hasSnapshotColumn = await this.#db.hasColumn(TABLE_AGENT_VERSIONS, 'snapshot');
    if (!hasSnapshotColumn) return;

    // Drop the old versions table - the new schema will be created by init()
    // Any existing version data in snapshot format is not preserved since
    // the snapshot schema predates the stable versioning system
    await this.#client.execute({
      sql: `DROP TABLE IF EXISTS "${TABLE_AGENT_VERSIONS}"`,
    });

    // Also clean up any lingering legacy table from a partial migration
    await this.#client.execute({
      sql: `DROP TABLE IF EXISTS "${TABLE_AGENTS}_legacy"`,
    });
  }

  /**
   * Removes stale draft agent records that have no activeVersionId.
   * These are left behind when createAgent partially fails (inserts thin record
   * but fails to create the version due to schema mismatch).
   */
  async #cleanupStaleDrafts(): Promise<void> {
    try {
      await this.#client.execute({
        sql: `DELETE FROM "${TABLE_AGENTS}" WHERE status = 'draft' AND activeVersionId IS NULL`,
      });
    } catch {
      // Non-critical cleanup, ignore errors
    }
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
      status: row.status as string,
      activeVersionId: row.activeVersionId as string | undefined,
      authorId: row.authorId as string | undefined,
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

      // 1. Create thin agent record with status='draft'
      await this.#db.insert({
        tableName: TABLE_AGENTS,
        record: {
          id: agent.id,
          status: 'draft',
          activeVersionId: null,
          authorId: agent.authorId ?? null,
          metadata: agent.metadata ?? null,
          createdAt: now,
          updatedAt: now,
        },
      });

      // 2. Extract config fields from the flat input
      const { id: _id, authorId: _authorId, metadata: _metadata, ...snapshotConfig } = agent;

      // Create version 1 from the config
      const versionId = crypto.randomUUID();
      await this.createVersion({
        id: versionId,
        agentId: agent.id,
        versionNumber: 1,
        ...snapshotConfig,
        changedFields: Object.keys(snapshotConfig),
        changeMessage: 'Initial version',
      });

      // 3. Set activeVersionId and status='published'
      await this.#db.update({
        tableName: TABLE_AGENTS,
        keys: { id: agent.id },
        data: {
          activeVersionId: versionId,
          status: 'published',
          updatedAt: new Date(),
        },
      });

      const created = await this.getAgentById({ id: agent.id });
      if (!created) {
        throw new MastraError({
          id: createStorageErrorId('LIBSQL', 'CREATE_AGENT', 'NOT_FOUND_AFTER_CREATE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.SYSTEM,
          text: `Agent ${agent.id} not found after creation`,
          details: { agentId: agent.id },
        });
      }

      return created;
    } catch (error) {
      if (error instanceof MastraError) {
        throw error;
      }
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

      // Build the data object with only metadata-level fields
      const data: Record<string, any> = {
        updatedAt: new Date(),
      };

      if (updates.authorId !== undefined) data.authorId = updates.authorId;
      if (updates.activeVersionId !== undefined) {
        data.activeVersionId = updates.activeVersionId;
        data.status = 'published';
      }
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
          description: input.description ?? null,
          instructions: input.instructions,
          model: input.model,
          tools: input.tools ?? null,
          defaultOptions: input.defaultOptions ?? null,
          workflows: input.workflows ?? null,
          agents: input.agents ?? null,
          integrationTools: input.integrationTools ?? null,
          inputProcessors: input.inputProcessors ?? null,
          outputProcessors: input.outputProcessors ?? null,
          memory: input.memory ?? null,
          scorers: input.scorers ?? null,
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
      name: row.name as string,
      description: row.description as string | undefined,
      instructions: row.instructions as string,
      model: this.parseJson(row.model, 'model'),
      tools: this.parseJson(row.tools, 'tools'),
      defaultOptions: this.parseJson(row.defaultOptions, 'defaultOptions'),
      workflows: this.parseJson(row.workflows, 'workflows'),
      agents: this.parseJson(row.agents, 'agents'),
      integrationTools: this.parseJson(row.integrationTools, 'integrationTools'),
      inputProcessors: this.parseJson(row.inputProcessors, 'inputProcessors'),
      outputProcessors: this.parseJson(row.outputProcessors, 'outputProcessors'),
      memory: this.parseJson(row.memory, 'memory'),
      scorers: this.parseJson(row.scorers, 'scorers'),
      changedFields: this.parseJson(row.changedFields, 'changedFields'),
      changeMessage: row.changeMessage as string | undefined,
      createdAt: new Date(row.createdAt as string),
    };
  }
}
