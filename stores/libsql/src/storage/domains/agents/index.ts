import type { Client, InValue } from '@libsql/client';
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
  AgentInstructionBlock,
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

    // Migrate tools field from string[] to JSONB format
    await this.#migrateToolsToJsonbFormat();

    // Clean up any stale draft records from previously failed createAgent calls
    await this.#cleanupStaleDrafts();
  }

  /**
   * Migrates from the legacy flat agent schema (where config fields like name, instructions, model
   * were stored directly on mastra_agents) to the new versioned schema (thin agent record + versions table).
   * SQLite cannot drop columns or alter NOT NULL constraints, so we must recreate the table.
   */
  async #migrateFromLegacySchema(): Promise<void> {
    const legacyTable = `${TABLE_AGENTS}_legacy`;
    const hasLegacyColumns = await this.#db.hasColumn(TABLE_AGENTS, 'name');

    if (hasLegacyColumns) {
      // Current table has legacy schema — rename it and drop old versions table
      await this.#client.execute({
        sql: `ALTER TABLE "${TABLE_AGENTS}" RENAME TO "${legacyTable}"`,
      });
      await this.#client.execute({
        sql: `DROP TABLE IF EXISTS "${TABLE_AGENT_VERSIONS}"`,
      });
    }

    // Check if legacy table exists (either just renamed, or left behind by a previous partial migration)
    const legacyExists = await this.#db.hasColumn(legacyTable, 'name');
    if (!legacyExists) return;

    // Read all existing agents from the legacy table
    const result = await this.#client.execute({
      sql: `SELECT * FROM "${legacyTable}"`,
    });
    const oldAgents = result.rows || [];

    // Create new tables (CREATE TABLE IF NOT EXISTS handles idempotency on resume)
    await this.#db.createTable({ tableName: TABLE_AGENTS, schema: AGENTS_SCHEMA });
    await this.#db.createTable({ tableName: TABLE_AGENT_VERSIONS, schema: AGENT_VERSIONS_SCHEMA });

    // INSERT OR REPLACE (used by #db.insert) is safe for resumed partial migrations
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
          instructions: this.serializeInstructions((row.instructions as string) ?? ''),
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

    // Drop legacy table only after all inserts succeed
    await this.#client.execute({
      sql: `DROP TABLE IF EXISTS "${legacyTable}"`,
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

  /**
   * Migrates the tools field from string[] format to JSONB format { "tool-key": { "description": "..." } }.
   * This handles the transition from the old format where tools were stored as an array of string keys
   * to the new format where tools can have per-agent description overrides.
   */
  async #migrateToolsToJsonbFormat(): Promise<void> {
    try {
      // Check if any records have tools stored as a JSON array
      const result = await this.#client.execute({
        sql: `SELECT id, tools FROM "${TABLE_AGENT_VERSIONS}" WHERE tools IS NOT NULL`,
      });

      if (!result.rows || result.rows.length === 0) {
        return; // No records to migrate
      }

      for (const row of result.rows) {
        const toolsValue = row.tools;

        // Parse the JSON value
        let parsedTools: any;
        try {
          if (typeof toolsValue === 'string') {
            parsedTools = JSON.parse(toolsValue);
          } else if (toolsValue instanceof ArrayBuffer) {
            const decoder = new TextDecoder();
            parsedTools = JSON.parse(decoder.decode(toolsValue));
          } else {
            parsedTools = toolsValue;
          }
        } catch {
          continue; // Skip invalid JSON
        }

        // Check if tools is an array (needs migration)
        if (Array.isArray(parsedTools)) {
          const toolsObject: Record<string, { description?: string }> = {};

          // Convert each tool string to an object key with empty config
          for (const toolKey of parsedTools) {
            if (typeof toolKey === 'string') {
              toolsObject[toolKey] = {};
            }
          }

          // Update the record with the new format
          await this.#client.execute({
            sql: `UPDATE "${TABLE_AGENT_VERSIONS}" SET tools = ? WHERE id = ?`,
            args: [JSON.stringify(toolsObject), row.id as string],
          });
        }
      }

      this.logger?.info?.(`Migrated agent version tools from array to object format`);
    } catch (error) {
      // Log but don't fail - this is a non-breaking migration
      this.logger?.warn?.('Failed to migrate tools to JSONB format:', error);
    }
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.deleteData({ tableName: TABLE_AGENT_VERSIONS });
    await this.#db.deleteData({ tableName: TABLE_AGENTS });
  }

  private parseJson(value: any, fieldName?: string): any {
    if (!value) return undefined;

    // Handle ArrayBuffer case (binary JSONB data from LibSQL)
    if (value instanceof ArrayBuffer || (value && value.constructor && value.constructor.name === 'ArrayBuffer')) {
      try {
        const decoder = new TextDecoder();
        const jsonString = decoder.decode(value);
        return JSON.parse(jsonString);
      } catch (error) {
        console.error(`Failed to parse ArrayBuffer for ${fieldName}:`, error);
        return undefined;
      }
    }

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
      status: row.status as 'draft' | 'published' | 'archived',
      activeVersionId: row.activeVersionId as string | undefined,
      authorId: row.authorId as string | undefined,
      metadata: this.parseJson(row.metadata, 'metadata'),
      createdAt: new Date(row.createdAt as string),
      updatedAt: new Date(row.updatedAt as string),
    };
  }

  async getById(id: string): Promise<StorageAgentType | null> {
    try {
      const result = await this.#db.select<Record<string, any>>({
        tableName: TABLE_AGENTS,
        keys: { id },
      });

      return result ? this.parseRow(result) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
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

  async create(input: { agent: StorageCreateAgentInput }): Promise<StorageAgentType> {
    const { agent } = input;
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

      // 3. Return the thin agent record (activeVersionId remains null, status remains 'draft')
      const created = await this.getById(agent.id);
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

  async update(input: StorageUpdateAgentInput): Promise<StorageAgentType> {
    const { id, ...updates } = input;
    try {
      const existing = await this.getById(id);
      if (!existing) {
        throw new MastraError({
          id: createStorageErrorId('LIBSQL', 'UPDATE_AGENT', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: `Agent ${id} not found`,
          details: { agentId: id },
        });
      }

      const { authorId, activeVersionId, metadata, status } = updates;

      // Build update data for the agent record
      const updateData: Record<string, unknown> = {
        updatedAt: new Date().toISOString(),
      };

      if (authorId !== undefined) updateData.authorId = authorId;
      if (activeVersionId !== undefined) updateData.activeVersionId = activeVersionId;
      if (status !== undefined) updateData.status = status;
      if (metadata !== undefined) {
        updateData.metadata = { ...existing.metadata, ...metadata };
      }

      await this.#db.update({
        tableName: TABLE_AGENTS,
        keys: { id },
        data: updateData,
      });

      // Fetch and return updated agent
      const updatedAgent = await this.getById(id);
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

  async delete(id: string): Promise<void> {
    try {
      // Delete all versions for this agent first
      await this.deleteVersionsByParentId(id);

      // Then delete the agent
      await this.#db.delete({
        tableName: TABLE_AGENTS,
        keys: { id },
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
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

  async list(args?: StorageListAgentsInput): Promise<StorageListAgentsOutput> {
    const { page = 0, perPage: perPageInput, orderBy, authorId, metadata, status } = args || {};
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
      // Build WHERE conditions
      const conditions: string[] = [];
      const queryParams: InValue[] = [];

      if (status) {
        conditions.push('status = ?');
        queryParams.push(status);
      }

      if (authorId !== undefined) {
        conditions.push('authorId = ?');
        queryParams.push(authorId);
      }

      if (metadata && Object.keys(metadata).length > 0) {
        for (const [key, value] of Object.entries(metadata)) {
          if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
            throw new MastraError({
              id: createStorageErrorId('LIBSQL', 'LIST_AGENTS', 'INVALID_METADATA_KEY'),
              domain: ErrorDomain.STORAGE,
              category: ErrorCategory.USER,
              text: `Invalid metadata key: ${key}. Keys must be alphanumeric with underscores.`,
              details: { key },
            });
          }
          conditions.push(`json_extract(metadata, '$.${key}') = ?`);
          queryParams.push(typeof value === 'string' ? value : JSON.stringify(value));
        }
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countResult = await this.#client.execute({
        sql: `SELECT COUNT(*) as count FROM "${TABLE_AGENTS}" ${whereClause}`,
        args: queryParams,
      });
      const total = Number(countResult.rows?.[0]?.count ?? 0);

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
      const result = await this.#client.execute({
        sql: `SELECT * FROM "${TABLE_AGENTS}" ${whereClause} ORDER BY "${field}" ${direction} LIMIT ? OFFSET ?`,
        args: [...queryParams, limitValue, offset],
      });

      const rows = result.rows ?? [];

      const agents = rows.map(row => this.parseRow(row));

      return {
        agents,
        total,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : offset + perPage < total,
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
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
          instructions: this.serializeInstructions(input.instructions),
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
          mcpClients: input.mcpClients ?? null,
          requestContextSchema: input.requestContextSchema ?? null,
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
      if (error instanceof MastraError) throw error;
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
      if (error instanceof MastraError) throw error;
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
      if (error instanceof MastraError) throw error;
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
      if (error instanceof MastraError) throw error;
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
      if (error instanceof MastraError) throw error;
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
      if (error instanceof MastraError) throw error;
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

  async deleteVersionsByParentId(entityId: string): Promise<void> {
    try {
      // Get all version IDs for this agent
      const versions = await this.#db.selectMany<{ id: string }>({
        tableName: TABLE_AGENT_VERSIONS,
        whereClause: {
          sql: 'WHERE agentId = ?',
          args: [entityId],
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
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'DELETE_VERSIONS_BY_AGENT_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { agentId: entityId },
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
      if (error instanceof MastraError) throw error;
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

  private serializeInstructions(instructions: string | AgentInstructionBlock[]): string {
    return Array.isArray(instructions) ? JSON.stringify(instructions) : instructions;
  }

  private deserializeInstructions(raw: string): string | AgentInstructionBlock[] {
    if (!raw) return raw;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as AgentInstructionBlock[];
    } catch {
      // Not JSON — plain string
    }
    return raw;
  }

  private parseVersionRow(row: any): AgentVersion {
    return {
      id: row.id as string,
      agentId: row.agentId as string,
      versionNumber: row.versionNumber as number,
      name: row.name as string,
      description: row.description as string | undefined,
      instructions: this.deserializeInstructions(row.instructions as string),
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
      mcpClients: this.parseJson(row.mcpClients, 'mcpClients'),
      requestContextSchema: this.parseJson(row.requestContextSchema, 'requestContextSchema'),
      changedFields: this.parseJson(row.changedFields, 'changedFields'),
      changeMessage: row.changeMessage as string | undefined,
      createdAt: new Date(row.createdAt as string),
    };
  }
}
