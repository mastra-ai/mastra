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
  AgentVersion,
  CreateVersionInput,
  ListVersionsInput,
  ListVersionsOutput,
} from '@mastra/core/storage';
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
   */
  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    return [
      {
        name: 'idx_agents_owner_id',
        table: TABLE_AGENTS,
        columns: ['ownerId'],
      },
      {
        name: 'idx_agent_versions_agent_id',
        table: TABLE_AGENT_VERSIONS,
        columns: ['agentId'],
      },
      {
        name: 'idx_agent_versions_agent_version',
        table: TABLE_AGENT_VERSIONS,
        columns: ['agentId', 'versionNumber'],
        unique: true,
      },
    ];
  }

  /**
   * Creates default indexes for optimal query performance.
   */
  async createDefaultIndexes(): Promise<void> {
    if (this.#skipDefaultIndexes) {
      return;
    }

    const defaultIndexes = this.getDefaultIndexDefinitions();
    for (const indexDef of defaultIndexes) {
      try {
        await this.#db.createIndex(indexDef);
      } catch (error) {
        // Log but continue - indexes are performance optimizations
        this.logger?.warn?.(`Failed to create default index ${indexDef.name}:`, error);
      }
    }
  }

  async init(): Promise<void> {
    // Create agents table
    await this.#db.createTable({ tableName: TABLE_AGENTS, schema: TABLE_SCHEMAS[TABLE_AGENTS] });
    // Add any new columns that may not exist in older tables
    await this.#db.alterTable({
      tableName: TABLE_AGENTS,
      schema: TABLE_SCHEMAS[TABLE_AGENTS],
      ifNotExists: ['ownerId', 'activeVersionId'],
    });

    // Create agent versions table
    await this.#db.createTable({ tableName: TABLE_AGENT_VERSIONS, schema: TABLE_SCHEMAS[TABLE_AGENT_VERSIONS] });

    await this.createDefaultIndexes();
    await this.createCustomIndexes();
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
      memory: row.memory as string | undefined, // memory is a plain string key, not JSON
      scorers: this.parseJson(row.scorers, 'scorers'),
      metadata: this.parseJson(row.metadata, 'metadata'),
      ownerId: row.ownerId as string | undefined,
      activeVersionId: row.activeVersionId as string | undefined,
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
      const tableName = getTableName({ indexName: TABLE_AGENTS, schemaName: getSchemaName(this.#schema) });
      const now = new Date();
      const nowIso = now.toISOString();

      await this.#db.client.none(
        `INSERT INTO ${tableName} (
          id, name, description, instructions, model, tools, 
          "defaultOptions", workflows, agents, "inputProcessors", "outputProcessors", memory, scorers, metadata, "ownerId", "activeVersionId",
          "createdAt", "createdAtZ", "updatedAt", "updatedAtZ"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)`,
        [
          agent.id,
          agent.name,
          agent.description ?? null,
          agent.instructions,
          JSON.stringify(agent.model),
          agent.tools ? JSON.stringify(agent.tools) : null,
          agent.defaultOptions ? JSON.stringify(agent.defaultOptions) : null,
          agent.workflows ? JSON.stringify(agent.workflows) : null,
          agent.agents ? JSON.stringify(agent.agents) : null,
          agent.inputProcessors ? JSON.stringify(agent.inputProcessors) : null,
          agent.outputProcessors ? JSON.stringify(agent.outputProcessors) : null,
          agent.memory ?? null, // memory is a plain string key, not JSON
          agent.scorers ? JSON.stringify(agent.scorers) : null,
          agent.metadata ? JSON.stringify(agent.metadata) : null,
          agent.ownerId ?? null,
          agent.activeVersionId ?? null,
          nowIso,
          nowIso,
          nowIso,
          nowIso,
        ],
      );

      return {
        ...agent,
        createdAt: now,
        updatedAt: now,
      };
    } catch (error) {
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

      const setClauses: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (updates.name !== undefined) {
        setClauses.push(`name = $${paramIndex++}`);
        values.push(updates.name);
      }

      if (updates.description !== undefined) {
        setClauses.push(`description = $${paramIndex++}`);
        values.push(updates.description);
      }

      if (updates.instructions !== undefined) {
        setClauses.push(`instructions = $${paramIndex++}`);
        values.push(updates.instructions);
      }

      if (updates.model !== undefined) {
        setClauses.push(`model = $${paramIndex++}`);
        values.push(JSON.stringify(updates.model));
      }

      if (updates.tools !== undefined) {
        setClauses.push(`tools = $${paramIndex++}`);
        values.push(JSON.stringify(updates.tools));
      }

      if (updates.defaultOptions !== undefined) {
        setClauses.push(`"defaultOptions" = $${paramIndex++}`);
        values.push(JSON.stringify(updates.defaultOptions));
      }

      if (updates.workflows !== undefined) {
        setClauses.push(`workflows = $${paramIndex++}`);
        values.push(JSON.stringify(updates.workflows));
      }

      if (updates.agents !== undefined) {
        setClauses.push(`agents = $${paramIndex++}`);
        values.push(JSON.stringify(updates.agents));
      }

      if (updates.inputProcessors !== undefined) {
        setClauses.push(`"inputProcessors" = $${paramIndex++}`);
        values.push(JSON.stringify(updates.inputProcessors));
      }

      if (updates.outputProcessors !== undefined) {
        setClauses.push(`"outputProcessors" = $${paramIndex++}`);
        values.push(JSON.stringify(updates.outputProcessors));
      }

      if (updates.memory !== undefined) {
        setClauses.push(`memory = $${paramIndex++}`);
        values.push(updates.memory); // memory is a plain string key, not JSON
      }

      if (updates.scorers !== undefined) {
        setClauses.push(`scorers = $${paramIndex++}`);
        values.push(JSON.stringify(updates.scorers));
      }

      if (updates.metadata !== undefined) {
        // Merge metadata
        const mergedMetadata = { ...existingAgent.metadata, ...updates.metadata };
        setClauses.push(`metadata = $${paramIndex++}`);
        values.push(JSON.stringify(mergedMetadata));
      }

      if (updates.ownerId !== undefined) {
        setClauses.push(`"ownerId" = $${paramIndex++}`);
        values.push(updates.ownerId);
      }

      if (updates.activeVersionId !== undefined) {
        setClauses.push(`"activeVersionId" = $${paramIndex++}`);
        values.push(updates.activeVersionId);
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
      // First delete all versions for this agent
      await this.deleteVersionsByAgentId(id);

      const tableName = getTableName({ indexName: TABLE_AGENTS, schemaName: getSchemaName(this.#schema) });
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
    const { page = 0, perPage: perPageInput, orderBy, ownerId, metadata } = args || {};
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

      // Build WHERE clause for filtering
      const whereClauses: string[] = [];
      const whereValues: any[] = [];
      let paramIndex = 1;

      if (ownerId !== undefined) {
        whereClauses.push(`"ownerId" = $${paramIndex++}`);
        whereValues.push(ownerId);
      }

      // Filter by metadata using JSONB containment operator
      if (metadata && Object.keys(metadata).length > 0) {
        whereClauses.push(`metadata @> $${paramIndex++}`);
        whereValues.push(JSON.stringify(metadata));
      }

      const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

      // Get total count with filters
      const countResult = await this.#db.client.one(
        `SELECT COUNT(*) as count FROM ${tableName} ${whereClause}`,
        whereValues,
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

      // Get paginated results with filters
      const limitValue = perPageInput === false ? total : perPage;
      const dataResult = await this.#db.client.manyOrNone(
        `SELECT * FROM ${tableName} ${whereClause} ORDER BY "${field}" ${direction} LIMIT $${paramIndex++} OFFSET $${paramIndex++}`,
        [...whereValues, limitValue, offset],
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
      createdAt: (row.createdAtZ as Date) || (row.createdAt as Date),
    };
  }

  async createVersion(input: CreateVersionInput): Promise<AgentVersion> {
    try {
      const tableName = getTableName({ indexName: TABLE_AGENT_VERSIONS, schemaName: getSchemaName(this.#schema) });
      const now = new Date();
      const nowIso = now.toISOString();

      await this.#db.client.none(
        `INSERT INTO ${tableName} (
          id, "agentId", "versionNumber", name, snapshot, "changedFields", "changeMessage",
          "createdAt", "createdAtZ"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          input.id,
          input.agentId,
          input.versionNumber,
          input.name ?? null,
          JSON.stringify(input.snapshot),
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
          id: createStorageErrorId('PG', 'CREATE_AGENT_VERSION', 'FAILED'),
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
          id: createStorageErrorId('PG', 'GET_AGENT_VERSION', 'FAILED'),
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
          id: createStorageErrorId('PG', 'GET_AGENT_VERSION_BY_NUMBER', 'FAILED'),
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
          id: createStorageErrorId('PG', 'GET_LATEST_AGENT_VERSION', 'FAILED'),
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
          id: createStorageErrorId('PG', 'LIST_AGENT_VERSIONS', 'INVALID_PAGE'),
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
          perPage: perPageForResponse === false ? 0 : perPageForResponse,
          hasMore: false,
        };
      }

      // Get paginated results
      const fieldColumn = field === 'createdAt' ? '"createdAt"' : '"versionNumber"';
      const dataResult = await this.#db.client.manyOrNone(
        `SELECT * FROM ${tableName} WHERE "agentId" = $1 ORDER BY ${fieldColumn} ${direction} LIMIT $2 OFFSET $3`,
        [agentId, perPage, offset],
      );

      const versions = (dataResult || []).map(row => this.parseVersionRow(row));

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
          id: createStorageErrorId('PG', 'LIST_AGENT_VERSIONS', 'FAILED'),
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
          id: createStorageErrorId('PG', 'DELETE_AGENT_VERSION', 'FAILED'),
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
          id: createStorageErrorId('PG', 'DELETE_AGENT_VERSIONS_BY_AGENT', 'FAILED'),
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
          id: createStorageErrorId('PG', 'COUNT_AGENT_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { agentId },
        },
        error,
      );
    }
  }
}
