import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  AgentsStorage,
  createStorageErrorId,
  normalizePerPage,
  calculatePagination,
  TABLE_AGENTS,
  TABLE_SCHEMAS,
} from '@mastra/core/storage';
import type {
  StorageAgentType,
  StorageCreateAgentInput,
  StorageUpdateAgentInput,
  StorageListAgentsInput,
  StorageListAgentsOutput,
} from '@mastra/core/storage';
import { PgDB, resolvePgConfig } from '../../db';
import type { PgDomainConfig } from '../../db';
import { getTableName, getSchemaName } from '../utils';

export class AgentsPG extends AgentsStorage {
  #db: PgDB;
  #schema: string;

  constructor(config: PgDomainConfig) {
    super();
    const { client, schemaName } = resolvePgConfig(config);
    this.#db = new PgDB({ client, schemaName });
    this.#schema = schemaName || 'public';
  }

  async init(): Promise<void> {
    await this.#db.createTable({ tableName: TABLE_AGENTS, schema: TABLE_SCHEMAS[TABLE_AGENTS] });
  }

  async dangerouslyClearAll(): Promise<void> {
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
      memory: this.parseJson(row.memory, 'memory'),
      scorers: this.parseJson(row.scorers, 'scorers'),
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
      const tableName = getTableName({ indexName: TABLE_AGENTS, schemaName: getSchemaName(this.#schema) });
      const now = new Date();
      const nowIso = now.toISOString();

      await this.#db.client.none(
        `INSERT INTO ${tableName} (
          id, name, description, instructions, model, tools, 
          "defaultOptions", workflows, agents, "inputProcessors", "outputProcessors", memory, scorers, metadata, 
          "createdAt", "createdAtZ", "updatedAt", "updatedAtZ"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
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
          agent.memory ? JSON.stringify(agent.memory) : null,
          agent.scorers ? JSON.stringify(agent.scorers) : null,
          agent.metadata ? JSON.stringify(agent.metadata) : null,
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
        values.push(JSON.stringify(updates.memory));
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
        await this.#db.client.none(`UPDATE ${tableName} SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`, values);
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
}
