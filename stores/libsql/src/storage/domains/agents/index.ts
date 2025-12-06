import type { Client, InValue } from '@libsql/client';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  AgentsStorage,
  createStorageErrorId,
  normalizePerPage,
  calculatePagination,
  TABLE_AGENTS,
} from '@mastra/core/storage';
import type {
  StorageAgentType,
  StorageCreateAgentInput,
  StorageUpdateAgentInput,
  StorageListAgentsInput,
  StorageListAgentsOutput,
} from '@mastra/core/storage';
import type { StoreOperationsLibSQL } from '../operations';

export class AgentsLibSQL extends AgentsStorage {
  private client: Client;

  constructor({ client, operations: _ }: { client: Client; operations: StoreOperationsLibSQL }) {
    super();
    this.client = client;
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
      const result = await this.client.execute({
        sql: `SELECT * FROM "${TABLE_AGENTS}" WHERE id = ?`,
        args: [id],
      });

      if (!result.rows || result.rows.length === 0) {
        return null;
      }

      return this.parseRow(result.rows[0]);
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
      const nowIso = now.toISOString();

      await this.client.execute({
        sql: `INSERT INTO "${TABLE_AGENTS}" (id, name, description, instructions, model, tools, "defaultOptions", workflows, agents, "inputProcessors", "outputProcessors", memory, scorers, metadata, "createdAt", "updatedAt")
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
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
        ],
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

      const setClauses: string[] = [];
      const args: InValue[] = [];

      if (updates.name !== undefined) {
        setClauses.push('name = ?');
        args.push(updates.name);
      }

      if (updates.description !== undefined) {
        setClauses.push('description = ?');
        args.push(updates.description);
      }

      if (updates.instructions !== undefined) {
        setClauses.push('instructions = ?');
        args.push(updates.instructions);
      }

      if (updates.model !== undefined) {
        setClauses.push('model = ?');
        args.push(JSON.stringify(updates.model));
      }

      if (updates.tools !== undefined) {
        setClauses.push('tools = ?');
        args.push(JSON.stringify(updates.tools));
      }

      if (updates.defaultOptions !== undefined) {
        setClauses.push('"defaultOptions" = ?');
        args.push(JSON.stringify(updates.defaultOptions));
      }

      if (updates.workflows !== undefined) {
        setClauses.push('workflows = ?');
        args.push(JSON.stringify(updates.workflows));
      }

      if (updates.agents !== undefined) {
        setClauses.push('agents = ?');
        args.push(JSON.stringify(updates.agents));
      }

      if (updates.inputProcessors !== undefined) {
        setClauses.push('"inputProcessors" = ?');
        args.push(JSON.stringify(updates.inputProcessors));
      }

      if (updates.outputProcessors !== undefined) {
        setClauses.push('"outputProcessors" = ?');
        args.push(JSON.stringify(updates.outputProcessors));
      }

      if (updates.memory !== undefined) {
        setClauses.push('memory = ?');
        args.push(JSON.stringify(updates.memory));
      }

      if (updates.scorers !== undefined) {
        setClauses.push('scorers = ?');
        args.push(JSON.stringify(updates.scorers));
      }

      if (updates.metadata !== undefined) {
        // Merge metadata
        const mergedMetadata = { ...existingAgent.metadata, ...updates.metadata };
        setClauses.push('metadata = ?');
        args.push(JSON.stringify(mergedMetadata));
      }

      // Always update the updatedAt timestamp
      const now = new Date();
      setClauses.push('"updatedAt" = ?');
      args.push(now.toISOString());

      // Add the ID for the WHERE clause
      args.push(id);

      if (setClauses.length > 1) {
        // More than just updatedAt
        await this.client.execute({
          sql: `UPDATE "${TABLE_AGENTS}" SET ${setClauses.join(', ')} WHERE id = ?`,
          args,
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
      await this.client.execute({
        sql: `DELETE FROM "${TABLE_AGENTS}" WHERE id = ?`,
        args: [id],
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
      const countResult = await this.client.execute({
        sql: `SELECT COUNT(*) as count FROM "${TABLE_AGENTS}"`,
        args: [],
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
      const dataResult = await this.client.execute({
        sql: `SELECT * FROM "${TABLE_AGENTS}" ORDER BY "${field}" ${direction} LIMIT ? OFFSET ?`,
        args: [limitValue, offset],
      });

      const agents = (dataResult.rows || []).map(row => this.parseRow(row));

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
