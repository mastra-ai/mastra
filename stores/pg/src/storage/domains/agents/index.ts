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
  StorageListAgentsResolvedOutput,
  StorageResolvedAgentType,
  CreateIndexOptions,
} from '@mastra/core/storage';
import type {
  AgentVersion,
  CreateVersionInput,
  ListVersionsInput,
  ListVersionsOutput,
} from '@mastra/core/storage/domains/agents';
import { PgDB, resolvePgConfig } from '../../db';
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
          row.instructions ?? '',
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
   * Removes stale draft agent records that have no activeVersionId.
   * These are left behind when createAgent partially fails (inserts thin record
   * but fails to create the version due to schema mismatch).
   */
  async #cleanupStaleDrafts(): Promise<void> {
    try {
      const fullTableName = getTableName({ indexName: TABLE_AGENTS, schemaName: getSchemaName(this.#schema) });
      await this.#db.client.none(`DELETE FROM ${fullTableName} WHERE status = 'draft' AND "activeVersionId" IS NULL`);
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
      status: row.status as string,
      activeVersionId: row.activeVersionId as string | undefined,
      authorId: row.authorId as string | undefined,
      metadata: this.parseJson(row.metadata, 'metadata'),
      createdAt: row.createdAtZ || row.createdAt,
      updatedAt: row.updatedAtZ || row.updatedAt,
    };
  }

  async getAgentById({ id }: { id: string }): Promise<StorageAgentType | null> {
    try {
      const tableName = getTableName({ indexName: TABLE_AGENTS, schemaName: getSchemaName(this.#schema) });

      const result = await this.#db.client.oneOrNone(`SELECT * FROM ${tableName} WHERE id = $1`, [id]);

      if (!result) {
        return null;
      }

      return this.parseRow(result);
    } catch (error) {
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

  async createAgent({ agent }: { agent: StorageCreateAgentInput }): Promise<StorageAgentType> {
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

  async updateAgent({ id, ...updates }: StorageUpdateAgentInput): Promise<StorageAgentType> {
    try {
      const tableName = getTableName({ indexName: TABLE_AGENTS, schemaName: getSchemaName(this.#schema) });

      // First, get the existing agent
      const existingAgent = await this.getAgentById({ id });
      if (!existingAgent) {
        throw new MastraError({
          id: createStorageErrorId('PG', 'UPDATE_AGENT', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: `Agent ${id} not found`,
          details: { agentId: id },
        });
      }

      // Separate metadata fields from config fields
      const { authorId, activeVersionId, metadata, ...configFields } = updates;

      // Extract just the config field names from StorageAgentSnapshotType
      const configFieldNames = [
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
      ];

      // Check if any config fields are present in the update
      const hasConfigUpdate = configFieldNames.some(field => field in configFields);

      // Handle config updates by creating a new version
      if (hasConfigUpdate) {
        // Get the latest version to use as base
        const latestVersion = await this.getLatestVersion(id);
        if (!latestVersion) {
          throw new MastraError({
            id: createStorageErrorId('PG', 'UPDATE_AGENT', 'NO_VERSIONS'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.SYSTEM,
            text: `No versions found for agent ${id}`,
            details: { agentId: id },
          });
        }

        // Extract config from latest version
        const {
          id: _versionId,
          agentId: _agentId,
          versionNumber: _versionNumber,
          changedFields: _changedFields,
          changeMessage: _changeMessage,
          createdAt: _createdAt,
          ...latestConfig
        } = latestVersion;

        // Merge updates into latest config
        const newConfig = {
          ...latestConfig,
          ...configFields,
        };

        // Identify which fields changed
        const changedFields = configFieldNames.filter(
          field =>
            field in configFields &&
            configFields[field as keyof typeof configFields] !== latestConfig[field as keyof typeof latestConfig],
        );

        // Create new version
        const newVersionId = crypto.randomUUID();
        const newVersionNumber = latestVersion.versionNumber + 1;

        await this.createVersion({
          id: newVersionId,
          agentId: id,
          versionNumber: newVersionNumber,
          ...newConfig,
          changedFields,
          changeMessage: `Updated ${changedFields.join(', ')}`,
        });
      }

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

      if (setClauses.length > 2) {
        // More than just updatedAt and updatedAtZ
        await this.#db.client.none(
          `UPDATE ${tableName} SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
          values,
        );
      }

      // Return the updated agent
      const updatedAgent = await this.getAgentById({ id });
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

  async deleteAgent({ id }: { id: string }): Promise<void> {
    try {
      const tableName = getTableName({ indexName: TABLE_AGENTS, schemaName: getSchemaName(this.#schema) });

      // Delete all versions for this agent first
      await this.deleteVersionsByAgentId(id);

      // Then delete the agent
      await this.#db.client.none(`DELETE FROM ${tableName} WHERE id = $1`, [id]);
    } catch (error) {
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

  async listAgents(args?: StorageListAgentsInput): Promise<StorageListAgentsOutput> {
    const { page = 0, perPage: perPageInput, orderBy } = args || {};
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

      // Get total count
      const countResult = await this.#db.client.one(`SELECT COUNT(*) as count FROM ${tableName}`);
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
        `SELECT * FROM ${tableName} ORDER BY "${field}" ${direction} LIMIT $1 OFFSET $2`,
        [limitValue, offset],
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

  async listAgentsResolved(args?: StorageListAgentsInput): Promise<StorageListAgentsResolvedOutput> {
    const { page = 0, perPage: perPageInput, orderBy } = args || {};
    const { field, direction } = this.parseOrderBy(orderBy);

    if (page < 0) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'LIST_AGENTS_RESOLVED', 'INVALID_PAGE'),
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
      const agentsTableName = getTableName({ indexName: TABLE_AGENTS, schemaName: getSchemaName(this.#schema) });
      const versionsTableName = getTableName({
        indexName: TABLE_AGENT_VERSIONS,
        schemaName: getSchemaName(this.#schema),
      });

      // Get total count
      const countResult = await this.#db.client.one(`SELECT COUNT(*) as count FROM ${agentsTableName}`);
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

      // Get paginated results with a JOIN to get active version or latest version
      const limitValue = perPageInput === false ? total : perPage;
      const query = `
        WITH latest_versions AS (
          SELECT v.*
          FROM ${versionsTableName} v
          INNER JOIN (
            SELECT "agentId", MAX("versionNumber") as max_version
            FROM ${versionsTableName}
            GROUP BY "agentId"
          ) lv ON v."agentId" = lv."agentId" AND v."versionNumber" = lv.max_version
        )
        SELECT 
          a.*,
          COALESCE(av.id, lv.id) as version_id,
          COALESCE(av."versionNumber", lv."versionNumber") as version_number,
          COALESCE(av.name, lv.name) as version_name,
          COALESCE(av.description, lv.description) as version_description,
          COALESCE(av.instructions, lv.instructions) as version_instructions,
          COALESCE(av.model, lv.model) as version_model,
          COALESCE(av.tools, lv.tools) as version_tools,
          COALESCE(av."defaultOptions", lv."defaultOptions") as version_defaultOptions,
          COALESCE(av.workflows, lv.workflows) as version_workflows,
          COALESCE(av.agents, lv.agents) as version_agents,
          COALESCE(av."integrationTools", lv."integrationTools") as version_integrationTools,
          COALESCE(av."inputProcessors", lv."inputProcessors") as version_inputProcessors,
          COALESCE(av."outputProcessors", lv."outputProcessors") as version_outputProcessors,
          COALESCE(av.memory, lv.memory) as version_memory,
          COALESCE(av.scorers, lv.scorers) as version_scorers
        FROM ${agentsTableName} a
        LEFT JOIN ${versionsTableName} av ON a."activeVersionId" = av.id
        LEFT JOIN latest_versions lv ON a.id = lv."agentId"
        ORDER BY a."${field}" ${direction}
        LIMIT $1 OFFSET $2
      `;

      const dataResult = await this.#db.client.manyOrNone(query, [limitValue, offset]);

      const resolvedAgents = (dataResult || []).map(row => {
        // Parse the agent record
        const agent = this.parseRow({
          id: row.id,
          status: row.status,
          activeVersionId: row.activeVersionId,
          authorId: row.authorId,
          metadata: row.metadata,
          createdAt: row.createdAt,
          createdAtZ: row.createdAtZ,
          updatedAt: row.updatedAt,
          updatedAtZ: row.updatedAtZ,
        });

        // If we have version data, merge it with agent
        if (row.version_id) {
          return {
            ...agent,
            name: row.version_name,
            description: row.version_description,
            instructions: row.version_instructions,
            model: this.parseJson(row.version_model, 'model'),
            tools: this.parseJson(row.version_tools, 'tools'),
            defaultOptions: this.parseJson(row.version_defaultOptions, 'defaultOptions'),
            workflows: this.parseJson(row.version_workflows, 'workflows'),
            agents: this.parseJson(row.version_agents, 'agents'),
            integrationTools: this.parseJson(row.version_integrationTools, 'integrationTools'),
            inputProcessors: this.parseJson(row.version_inputProcessors, 'inputProcessors'),
            outputProcessors: this.parseJson(row.version_outputProcessors, 'outputProcessors'),
            memory: this.parseJson(row.version_memory, 'memory'),
            scorers: this.parseJson(row.version_scorers, 'scorers'),
          } as StorageResolvedAgentType;
        }

        // No versions exist - return thin record cast as resolved
        return agent as StorageResolvedAgentType;
      });

      return {
        agents: resolvedAgents,
        total,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : offset + perPage < total,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'LIST_AGENTS_RESOLVED', 'FAILED'),
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
          "changedFields", "changeMessage",
          "createdAt", "createdAtZ"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
        [
          input.id,
          input.agentId,
          input.versionNumber,
          input.name,
          input.description ?? null,
          input.instructions,
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

  async deleteVersionsByAgentId(agentId: string): Promise<void> {
    try {
      const tableName = getTableName({ indexName: TABLE_AGENT_VERSIONS, schemaName: getSchemaName(this.#schema) });
      await this.#db.client.none(`DELETE FROM ${tableName} WHERE "agentId" = $1`, [agentId]);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'DELETE_VERSIONS_BY_AGENT_ID', 'FAILED'),
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
      const tableName = getTableName({ indexName: TABLE_AGENT_VERSIONS, schemaName: getSchemaName(this.#schema) });
      const result = await this.#db.client.one(`SELECT COUNT(*) as count FROM ${tableName} WHERE "agentId" = $1`, [
        agentId,
      ]);
      return parseInt(result.count, 10);
    } catch (error) {
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
      createdAt: row.createdAtZ || row.createdAt,
    };
  }
}
