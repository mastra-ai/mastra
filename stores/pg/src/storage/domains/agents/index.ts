import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  AgentsStorage,
  createStorageErrorId,
  normalizePerPage,
  calculatePagination,
  TABLE_AGENTS,
  TABLE_AGENT_VERSIONS,
  TABLE_SCHEMAS,
} from '@mastra/core/storage';
import type {
  StorageAgentType,
  StorageCreateAgentInput,
  StorageUpdateAgentInput,
  StorageListAgentsInput,
  StorageListAgentsOutput,
  CreateIndexOptions,
  AgentInstructionBlock,
} from '@mastra/core/storage';
import type {
  AgentVersion,
  CreateVersionInput,
  ListVersionsInput,
  ListVersionsOutput,
} from '@mastra/core/storage/domains/agents';
import { PgDB, resolvePgConfig, generateTableSQL } from '../../db';
import type { PgDomainConfig } from '../../db';
import { getTableName, getSchemaName } from '../utils';

export class AgentsPG extends AgentsStorage {
  #db: PgDB;
  #schema: string;
  #skipDefaultIndexes?: boolean;
  #indexes?: CreateIndexOptions[];

  /** Tables managed by this domain */
  static readonly MANAGED_TABLES = [TABLE_AGENTS, TABLE_AGENT_VERSIONS] as const;

  constructor(config: PgDomainConfig) {
    super();
    const { client, schemaName, skipDefaultIndexes, indexes } = resolvePgConfig(config);
    this.#db = new PgDB({ client, schemaName, skipDefaultIndexes });
    this.#schema = schemaName || 'public';
    this.#skipDefaultIndexes = skipDefaultIndexes;
    // Filter indexes to only those for tables managed by this domain
    this.#indexes = indexes?.filter(idx => (AgentsPG.MANAGED_TABLES as readonly string[]).includes(idx.table));
  }

  /**
   * Returns all DDL statements for this domain: tables.
   * Used by exportSchemas to produce a complete, reproducible schema export.
   */
  static getExportDDL(schemaName?: string): string[] {
    const statements: string[] = [];

    // Tables
    for (const tableName of AgentsPG.MANAGED_TABLES) {
      statements.push(
        generateTableSQL({
          tableName,
          schema: TABLE_SCHEMAS[tableName],
          schemaName,
          includeAllConstraints: true,
        }),
      );
    }

    return statements;
  }

  /**
   * Returns default index definitions for the agents domain tables.
   * Currently no default indexes are defined for agents.
   */
  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    return [];
  }

  /**
   * Creates default indexes for optimal query performance.
   * Currently no default indexes are defined for agents.
   */
  async createDefaultIndexes(): Promise<void> {
    if (this.#skipDefaultIndexes) {
      return;
    }
    // No default indexes for agents domain
  }

  async init(): Promise<void> {
    // Migrate from legacy schemas before creating tables
    await this.#migrateFromLegacySchema();
    await this.#migrateVersionsSchema();

    await this.#db.createTable({ tableName: TABLE_AGENTS, schema: TABLE_SCHEMAS[TABLE_AGENTS] });
    await this.#db.createTable({ tableName: TABLE_AGENT_VERSIONS, schema: TABLE_SCHEMAS[TABLE_AGENT_VERSIONS] });
    // Add new columns for backwards compatibility with intermediate schema versions
    await this.#db.alterTable({
      tableName: TABLE_AGENTS,
      schema: TABLE_SCHEMAS[TABLE_AGENTS],
      ifNotExists: ['status', 'authorId'],
    });

    // Migrate tools field from string[] to JSONB format
    await this.#migrateToolsToJsonbFormat();

    await this.createDefaultIndexes();
    await this.createCustomIndexes();

    // Clean up any stale draft records from previously failed createAgent calls
    await this.#cleanupStaleDrafts();
  }

  /**
   * Migrates from the legacy flat agent schema (where config fields like name, instructions, model
   * were stored directly on mastra_agents) to the new versioned schema (thin agent record + versions table).
   */
  async #migrateFromLegacySchema(): Promise<void> {
    const fullTableName = getTableName({ indexName: TABLE_AGENTS, schemaName: getSchemaName(this.#schema) });
    const fullVersionsTableName = getTableName({
      indexName: TABLE_AGENT_VERSIONS,
      schemaName: getSchemaName(this.#schema),
    });
    const legacyTableName = getTableName({
      indexName: `${TABLE_AGENTS}_legacy`,
      schemaName: getSchemaName(this.#schema),
    });

    const hasLegacyColumns = await this.#db.hasColumn(TABLE_AGENTS, 'name');

    if (hasLegacyColumns) {
      // Current table has legacy schema — rename it and drop old versions table
      await this.#db.client.none(`ALTER TABLE ${fullTableName} RENAME TO "${TABLE_AGENTS}_legacy"`);
      await this.#db.client.none(`DROP TABLE IF EXISTS ${fullVersionsTableName}`);
    }

    // Check if legacy table exists (either just renamed, or left behind by a previous partial migration)
    const legacyExists = await this.#db.hasColumn(`${TABLE_AGENTS}_legacy`, 'name');
    if (!legacyExists) return;

    // Read all existing agents from the legacy table
    const oldAgents = await this.#db.client.manyOrNone(`SELECT * FROM ${legacyTableName}`);

    // Create new tables (IF NOT EXISTS handles idempotency on resume)
    await this.#db.createTable({ tableName: TABLE_AGENTS, schema: TABLE_SCHEMAS[TABLE_AGENTS] });
    await this.#db.createTable({ tableName: TABLE_AGENT_VERSIONS, schema: TABLE_SCHEMAS[TABLE_AGENT_VERSIONS] });

    // ON CONFLICT DO NOTHING makes inserts safe for resumed partial migrations
    for (const row of oldAgents) {
      const agentId = row.id as string;
      if (!agentId) continue;

      const versionId = crypto.randomUUID();
      const now = new Date();

      await this.#db.client.none(
        `INSERT INTO ${fullTableName} (id, status, "activeVersionId", "authorId", metadata, "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        [
          agentId,
          'published',
          versionId,
          row.ownerId ?? row.authorId ?? null,
          row.metadata ? JSON.stringify(row.metadata) : null,
          row.createdAt ?? now,
          row.updatedAt ?? now,
        ],
      );

      await this.#db.client.none(
        `INSERT INTO ${fullVersionsTableName}
         (id, "agentId", "versionNumber", name, description, instructions, model, tools,
          "defaultOptions", workflows, agents, "integrationTools", "inputProcessors",
          "outputProcessors", memory, scorers, "changedFields", "changeMessage", "createdAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
         ON CONFLICT (id) DO NOTHING`,
        [
          versionId,
          agentId,
          1,
          row.name ?? agentId,
          row.description ?? null,
          this.serializeInstructions(row.instructions ?? ''),
          row.model ? JSON.stringify(row.model) : '{}',
          row.tools ? JSON.stringify(row.tools) : null,
          row.defaultOptions ? JSON.stringify(row.defaultOptions) : null,
          row.workflows ? JSON.stringify(row.workflows) : null,
          row.agents ? JSON.stringify(row.agents) : null,
          row.integrationTools ? JSON.stringify(row.integrationTools) : null,
          row.inputProcessors ? JSON.stringify(row.inputProcessors) : null,
          row.outputProcessors ? JSON.stringify(row.outputProcessors) : null,
          row.memory ? JSON.stringify(row.memory) : null,
          row.scorers ? JSON.stringify(row.scorers) : null,
          null,
          'Migrated from legacy schema',
          row.createdAt ?? now,
        ],
      );
    }

    // Drop legacy table only after all inserts succeed
    await this.#db.client.none(`DROP TABLE IF EXISTS ${legacyTableName}`);
  }

  /**
   * Migrates the agent_versions table from the old snapshot-based schema (single `snapshot` JSON column)
   * to the new flat schema (individual config columns). This handles the case where the agents table
   * was already migrated but the versions table still has the old schema.
   */
  async #migrateVersionsSchema(): Promise<void> {
    const hasSnapshotColumn = await this.#db.hasColumn(TABLE_AGENT_VERSIONS, 'snapshot');
    if (!hasSnapshotColumn) return;

    const fullVersionsTableName = getTableName({
      indexName: TABLE_AGENT_VERSIONS,
      schemaName: getSchemaName(this.#schema),
    });
    const legacyTableName = getTableName({
      indexName: `${TABLE_AGENTS}_legacy`,
      schemaName: getSchemaName(this.#schema),
    });

    // Drop the old versions table - the new schema will be created by init()
    await this.#db.client.none(`DROP TABLE IF EXISTS ${fullVersionsTableName}`);

    // Also clean up any lingering legacy table from a partial migration
    await this.#db.client.none(`DROP TABLE IF EXISTS ${legacyTableName}`);
  }

  /**
   * Migrates the tools field from string[] format to JSONB format { "tool-key": { "description": "..." } }.
   * This handles the transition from the old format where tools were stored as an array of string keys
   * to the new format where tools can have per-agent description overrides.
   */
  async #migrateToolsToJsonbFormat(): Promise<void> {
    const fullVersionsTableName = getTableName({
      indexName: TABLE_AGENT_VERSIONS,
      schemaName: getSchemaName(this.#schema),
    });

    try {
      // Check if any records have tools stored as a JSON array
      const recordsWithArrayTools = await this.#db.client.any(
        `SELECT id, tools FROM ${fullVersionsTableName} 
         WHERE tools IS NOT NULL 
         AND jsonb_typeof(tools) = 'array'`,
      );

      if (recordsWithArrayTools.length === 0) {
        return; // No migration needed
      }

      // Convert each record's tools from array to object format
      for (const record of recordsWithArrayTools) {
        const toolsArray = record.tools as string[];
        const toolsObject: Record<string, { description?: string }> = {};

        // Convert each tool string to an object key with empty config
        for (const toolKey of toolsArray) {
          toolsObject[toolKey] = {};
        }

        // Update the record with the new format
        await this.#db.client.none(
          `UPDATE ${fullVersionsTableName} 
           SET tools = $1::jsonb 
           WHERE id = $2`,
          [JSON.stringify(toolsObject), record.id],
        );
      }

      this.logger?.info?.(
        `Migrated ${recordsWithArrayTools.length} agent version(s) tools from array to object format`,
      );
    } catch (error) {
      // Log but don't fail - this is a non-breaking migration
      this.logger?.warn?.('Failed to migrate tools to JSONB format:', error);
    }
  }

  /**
   * Removes stale draft agent records that have no activeVersionId.
   * These are left behind when createAgent partially fails (inserts thin record
   * but fails to create the version due to schema mismatch).
   */
  async #cleanupStaleDrafts(): Promise<void> {
    try {
      const fullTableName = getTableName({ indexName: TABLE_AGENTS, schemaName: getSchemaName(this.#schema) });
      await this.#db.client.none(`DELETE FROM ${fullTableName} WHERE status = 'draft' AND \"activeVersionId\" IS NULL`);
    } catch {
      // Non-critical cleanup, ignore errors
    }
  }

  /**
   * Creates custom user-defined indexes for this domain's tables.
   */
  async createCustomIndexes(): Promise<void> {
    if (!this.#indexes || this.#indexes.length === 0) {
      return;
    }

    for (const indexDef of this.#indexes) {
      try {
        await this.#db.createIndex(indexDef);
      } catch (error) {
        // Log but continue - indexes are performance optimizations
        this.logger?.warn?.(`Failed to create custom index ${indexDef.name}:`, error);
      }
    }
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.clearTable({ tableName: TABLE_AGENT_VERSIONS });
    await this.#db.clearTable({ tableName: TABLE_AGENTS });
  }

  private parseJson(value: any, fieldName?: string): any {
    if (!value) return undefined;
    if (typeof value !== 'string') return value;

    try {
      return JSON.parse(value);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      const details: Record<string, string> = {
        value: value.length > 100 ? value.substring(0, 100) + '...' : value,
      };
      if (fieldName) {
        details.field = fieldName;
      }

      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'PARSE_JSON', 'INVALID_JSON'),
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
      createdAt: row.createdAtZ || row.createdAt,
      updatedAt: row.updatedAtZ || row.updatedAt,
    };
  }

  async getById(id: string): Promise<StorageAgentType | null> {
    try {
      const tableName = getTableName({ indexName: TABLE_AGENTS, schemaName: getSchemaName(this.#schema) });

      const result = await this.#db.client.oneOrNone(`SELECT * FROM ${tableName} WHERE id = $1`, [id]);

      if (!result) {
        return null;
      }

      return this.parseRow(result);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'GET_AGENT_BY_ID', 'FAILED'),
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
      const agentsTable = getTableName({ indexName: TABLE_AGENTS, schemaName: getSchemaName(this.#schema) });
      const now = new Date();
      const nowIso = now.toISOString();

      // 1. Create the thin agent record with status='draft' and activeVersionId=null
      await this.#db.client.none(
        `INSERT INTO ${agentsTable} (
          id, status, "authorId", metadata,
          "activeVersionId",
          "createdAt", "createdAtZ", "updatedAt", "updatedAtZ"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          agent.id,
          'draft',
          agent.authorId ?? null,
          agent.metadata ? JSON.stringify(agent.metadata) : null,
          null, // activeVersionId starts as null
          nowIso,
          nowIso,
          nowIso,
          nowIso,
        ],
      );

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

      // 3. Return the thin agent record (activeVersionId remains null)
      return {
        id: agent.id,
        status: 'draft',
        activeVersionId: undefined,
        authorId: agent.authorId,
        metadata: agent.metadata,
        createdAt: now,
        updatedAt: now,
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      // Best-effort cleanup to prevent orphaned draft records
      try {
        const agentsTable = getTableName({ indexName: TABLE_AGENTS, schemaName: getSchemaName(this.#schema) });
        await this.#db.client.none(
          `DELETE FROM ${agentsTable} WHERE id = $1 AND status = 'draft' AND "activeVersionId" IS NULL`,
          [agent.id],
        );
      } catch {
        // Ignore cleanup errors
      }

      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'CREATE_AGENT', 'FAILED'),
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
      const tableName = getTableName({ indexName: TABLE_AGENTS, schemaName: getSchemaName(this.#schema) });

      // First, get the existing agent
      const existingAgent = await this.getById(id);
      if (!existingAgent) {
        throw new MastraError({
          id: createStorageErrorId('PG', 'UPDATE_AGENT', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: `Agent ${id} not found`,
          details: { agentId: id },
        });
      }

      const { authorId, activeVersionId, metadata, status } = updates;

      // Update metadata fields on the agent record
      const setClauses: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (authorId !== undefined) {
        setClauses.push(`"authorId" = $${paramIndex++}`);
        values.push(authorId);
      }

      if (activeVersionId !== undefined) {
        setClauses.push(`"activeVersionId" = $${paramIndex++}`);
        values.push(activeVersionId);
        // Do NOT automatically set status='published' when activeVersionId is updated
      }

      if (status !== undefined) {
        setClauses.push(`status = $${paramIndex++}`);
        values.push(status);
      }

      if (metadata !== undefined) {
        // REPLACE metadata (not merge) - this is standard DB behavior
        setClauses.push(`metadata = $${paramIndex++}`);
        values.push(JSON.stringify(metadata));
      }

      // Always update the updatedAt timestamp
      const now = new Date().toISOString();
      setClauses.push(`"updatedAt" = $${paramIndex++}`);
      values.push(now);
      setClauses.push(`"updatedAtZ" = $${paramIndex++}`);
      values.push(now);

      // Add the ID for the WHERE clause
      values.push(id);

      // Always update the record (at minimum updatedAt/updatedAtZ are set)
      await this.#db.client.none(`UPDATE ${tableName} SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`, values);

      // Return the updated agent
      const updatedAgent = await this.getById(id);
      if (!updatedAgent) {
        throw new MastraError({
          id: createStorageErrorId('PG', 'UPDATE_AGENT', 'NOT_FOUND_AFTER_UPDATE'),
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
          id: createStorageErrorId('PG', 'UPDATE_AGENT', 'FAILED'),
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
      const tableName = getTableName({ indexName: TABLE_AGENTS, schemaName: getSchemaName(this.#schema) });

      // Delete all versions for this agent first
      await this.deleteVersionsByParentId(id);

      // Then delete the agent
      await this.#db.client.none(`DELETE FROM ${tableName} WHERE id = $1`, [id]);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'DELETE_AGENT', 'FAILED'),
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
          id: createStorageErrorId('PG', 'LIST_AGENTS', 'INVALID_PAGE'),
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
      const tableName = getTableName({ indexName: TABLE_AGENTS, schemaName: getSchemaName(this.#schema) });

      // Build WHERE conditions
      const conditions: string[] = [];
      const queryParams: any[] = [];
      let paramIdx = 1;

      if (status) {
        conditions.push(`status = $${paramIdx++}`);
        queryParams.push(status);
      }

      if (authorId !== undefined) {
        conditions.push(`"authorId" = $${paramIdx++}`);
        queryParams.push(authorId);
      }

      if (metadata && Object.keys(metadata).length > 0) {
        conditions.push(`metadata @> $${paramIdx++}::jsonb`);
        queryParams.push(JSON.stringify(metadata));
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countResult = await this.#db.client.one(
        `SELECT COUNT(*) as count FROM ${tableName} ${whereClause}`,
        queryParams,
      );
      const total = parseInt(countResult.count, 10);

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
      const dataResult = await this.#db.client.manyOrNone(
        `SELECT * FROM ${tableName} ${whereClause} ORDER BY "${field}" ${direction} LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
        [...queryParams, limitValue, offset],
      );

      const agents = (dataResult || []).map(row => this.parseRow(row));

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
          id: createStorageErrorId('PG', 'LIST_AGENTS', 'FAILED'),
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
      const tableName = getTableName({ indexName: TABLE_AGENT_VERSIONS, schemaName: getSchemaName(this.#schema) });
      const now = new Date();
      const nowIso = now.toISOString();

      await this.#db.client.none(
        `INSERT INTO ${tableName} (
          id, "agentId", "versionNumber",
          name, description, instructions, model, tools,
          "defaultOptions", workflows, agents, "integrationTools",
          "inputProcessors", "outputProcessors", memory, scorers,
          "mcpClients", "requestContextSchema", "changedFields", "changeMessage",
          "createdAt", "createdAtZ"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)`,
        [
          input.id,
          input.agentId,
          input.versionNumber,
          input.name,
          input.description ?? null,
          this.serializeInstructions(input.instructions),
          JSON.stringify(input.model),
          input.tools ? JSON.stringify(input.tools) : null,
          input.defaultOptions ? JSON.stringify(input.defaultOptions) : null,
          input.workflows ? JSON.stringify(input.workflows) : null,
          input.agents ? JSON.stringify(input.agents) : null,
          input.integrationTools ? JSON.stringify(input.integrationTools) : null,
          input.inputProcessors ? JSON.stringify(input.inputProcessors) : null,
          input.outputProcessors ? JSON.stringify(input.outputProcessors) : null,
          input.memory ? JSON.stringify(input.memory) : null,
          input.scorers ? JSON.stringify(input.scorers) : null,
          input.mcpClients ? JSON.stringify(input.mcpClients) : null,
          input.requestContextSchema ? JSON.stringify(input.requestContextSchema) : null,
          input.changedFields ? JSON.stringify(input.changedFields) : null,
          input.changeMessage ?? null,
          nowIso,
          nowIso,
        ],
      );

      return {
        ...input,
        createdAt: now,
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'CREATE_VERSION', 'FAILED'),
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
      const tableName = getTableName({ indexName: TABLE_AGENT_VERSIONS, schemaName: getSchemaName(this.#schema) });
      const result = await this.#db.client.oneOrNone(`SELECT * FROM ${tableName} WHERE id = $1`, [id]);

      if (!result) {
        return null;
      }

      return this.parseVersionRow(result);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'GET_VERSION', 'FAILED'),
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
      const tableName = getTableName({ indexName: TABLE_AGENT_VERSIONS, schemaName: getSchemaName(this.#schema) });
      const result = await this.#db.client.oneOrNone(
        `SELECT * FROM ${tableName} WHERE "agentId" = $1 AND "versionNumber" = $2`,
        [agentId, versionNumber],
      );

      if (!result) {
        return null;
      }

      return this.parseVersionRow(result);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'GET_VERSION_BY_NUMBER', 'FAILED'),
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
      const tableName = getTableName({ indexName: TABLE_AGENT_VERSIONS, schemaName: getSchemaName(this.#schema) });
      const result = await this.#db.client.oneOrNone(
        `SELECT * FROM ${tableName} WHERE "agentId" = $1 ORDER BY "versionNumber" DESC LIMIT 1`,
        [agentId],
      );

      if (!result) {
        return null;
      }

      return this.parseVersionRow(result);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'GET_LATEST_VERSION', 'FAILED'),
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
          id: createStorageErrorId('PG', 'LIST_VERSIONS', 'INVALID_PAGE'),
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
      const tableName = getTableName({ indexName: TABLE_AGENT_VERSIONS, schemaName: getSchemaName(this.#schema) });

      // Get total count
      const countResult = await this.#db.client.one(`SELECT COUNT(*) as count FROM ${tableName} WHERE "agentId" = $1`, [
        agentId,
      ]);
      const total = parseInt(countResult.count, 10);

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
      const dataResult = await this.#db.client.manyOrNone(
        `SELECT * FROM ${tableName} WHERE "agentId" = $1 ORDER BY "${field}" ${direction} LIMIT $2 OFFSET $3`,
        [agentId, limitValue, offset],
      );

      const versions = (dataResult || []).map(row => this.parseVersionRow(row));

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
          id: createStorageErrorId('PG', 'LIST_VERSIONS', 'FAILED'),
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
      const tableName = getTableName({ indexName: TABLE_AGENT_VERSIONS, schemaName: getSchemaName(this.#schema) });
      await this.#db.client.none(`DELETE FROM ${tableName} WHERE id = $1`, [id]);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'DELETE_VERSION', 'FAILED'),
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
      const tableName = getTableName({ indexName: TABLE_AGENT_VERSIONS, schemaName: getSchemaName(this.#schema) });
      await this.#db.client.none(`DELETE FROM ${tableName} WHERE "agentId" = $1`, [entityId]);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'DELETE_VERSIONS_BY_AGENT_ID', 'FAILED'),
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
      const tableName = getTableName({ indexName: TABLE_AGENT_VERSIONS, schemaName: getSchemaName(this.#schema) });
      const result = await this.#db.client.one(`SELECT COUNT(*) as count FROM ${tableName} WHERE "agentId" = $1`, [
        agentId,
      ]);
      return parseInt(result.count, 10);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'COUNT_VERSIONS', 'FAILED'),
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

  private serializeInstructions(instructions: string | AgentInstructionBlock[] | undefined | null): string | undefined {
    if (instructions == null) return undefined;
    return Array.isArray(instructions) ? JSON.stringify(instructions) : instructions;
  }

  private deserializeInstructions(raw: string | null | undefined): string | AgentInstructionBlock[] {
    if (!raw) return '';
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
      createdAt: row.createdAtZ || row.createdAt,
    };
  }
}
