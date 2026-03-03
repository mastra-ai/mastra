import type { Pool, RowDataPacket } from 'mysql2/promise';
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

import type { StoreOperationsMySQL } from '../operations';
import { formatTableName, quoteIdentifier } from '../utils';

export class AgentsMySQL extends AgentsStorage {
  private pool: Pool;
  private operations: StoreOperationsMySQL;

  constructor({ pool, operations }: { pool: Pool; operations: StoreOperationsMySQL }) {
    super();
    this.pool = pool;
    this.operations = operations;
  }

  async init(): Promise<void> {
    await this.operations.createTable({ tableName: TABLE_AGENTS, schema: AGENTS_SCHEMA });
    await this.operations.createTable({ tableName: TABLE_AGENT_VERSIONS, schema: AGENT_VERSIONS_SCHEMA });
    await this.operations.alterTable({
      tableName: TABLE_AGENTS,
      schema: AGENTS_SCHEMA,
      ifNotExists: ['status', 'authorId'],
    });
    await this.operations.alterTable({
      tableName: TABLE_AGENT_VERSIONS,
      schema: AGENT_VERSIONS_SCHEMA,
      ifNotExists: ['mcpClients', 'requestContextSchema', 'workspace', 'skills', 'skillsFormat'],
    });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.operations.clearTable({ tableName: TABLE_AGENT_VERSIONS });
    await this.operations.clearTable({ tableName: TABLE_AGENTS });
  }

  private safeParseJSON(value: unknown): any {
    if (value === null || value === undefined) return undefined;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  }

  private parseRow(row: Record<string, unknown>): StorageAgentType {
    return {
      id: row.id as string,
      status: (row.status as 'draft' | 'published' | 'archived') ?? 'draft',
      activeVersionId: (row.activeVersionId as string) ?? undefined,
      authorId: (row.authorId as string) ?? undefined,
      metadata: this.safeParseJSON(row.metadata),
      createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt as string),
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt as string),
    };
  }

  async getById(id: string): Promise<StorageAgentType | null> {
    try {
      const [rows] = await this.pool.execute<RowDataPacket[]>(
        `SELECT * FROM ${formatTableName(TABLE_AGENTS)} WHERE ${quoteIdentifier('id', 'column name')} = ?`,
        [id],
      );
      return rows.length ? this.parseRow(rows[0]!) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('MYSQL', 'GET_AGENT_BY_ID', 'FAILED'),
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

      await this.operations.insert({
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

      const { id: _id, authorId: _authorId, metadata: _metadata, ...snapshotConfig } = agent;

      const versionId = crypto.randomUUID();
      try {
        await this.createVersion({
          id: versionId,
          agentId: agent.id,
          versionNumber: 1,
          ...snapshotConfig,
          changedFields: Object.keys(snapshotConfig),
          changeMessage: 'Initial version',
        });
      } catch (versionError) {
        await this.operations.delete({ tableName: TABLE_AGENTS, keys: { id: agent.id } });
        throw versionError;
      }

      const created = await this.getById(agent.id);
      if (!created) {
        throw new MastraError({
          id: createStorageErrorId('MYSQL', 'CREATE_AGENT', 'NOT_FOUND_AFTER_CREATE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.SYSTEM,
          text: `Agent ${agent.id} not found after creation`,
          details: { agentId: agent.id },
        });
      }

      return created;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('MYSQL', 'CREATE_AGENT', 'FAILED'),
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
          id: createStorageErrorId('MYSQL', 'UPDATE_AGENT', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: `Agent ${id} not found`,
          details: { agentId: id },
        });
      }

      const { authorId, activeVersionId, metadata, status } = updates;

      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (authorId !== undefined) updateData.authorId = authorId;
      if (activeVersionId !== undefined) updateData.activeVersionId = activeVersionId;
      if (status !== undefined) updateData.status = status;
      if (metadata !== undefined) {
        updateData.metadata = { ...existing.metadata, ...metadata };
      }

      await this.operations.update({
        tableName: TABLE_AGENTS,
        keys: { id },
        data: updateData,
      });

      const updatedAgent = await this.getById(id);
      if (!updatedAgent) {
        throw new MastraError({
          id: createStorageErrorId('MYSQL', 'UPDATE_AGENT', 'NOT_FOUND_AFTER_UPDATE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.SYSTEM,
          text: `Agent ${id} not found after update`,
          details: { agentId: id },
        });
      }

      return updatedAgent;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('MYSQL', 'UPDATE_AGENT', 'FAILED'),
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
      await this.deleteVersionsByParentId(id);
      await this.operations.delete({ tableName: TABLE_AGENTS, keys: { id } });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('MYSQL', 'DELETE_AGENT', 'FAILED'),
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
          id: createStorageErrorId('MYSQL', 'LIST_AGENTS', 'INVALID_PAGE'),
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
      const conditions: string[] = [];
      const queryParams: any[] = [];

      if (status) {
        conditions.push(`${quoteIdentifier('status', 'column name')} = ?`);
        queryParams.push(status);
      }

      if (authorId !== undefined) {
        conditions.push(`${quoteIdentifier('authorId', 'column name')} = ?`);
        queryParams.push(authorId);
      }

      if (metadata && Object.keys(metadata).length > 0) {
        for (const [key, value] of Object.entries(metadata)) {
          if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
            throw new MastraError({
              id: createStorageErrorId('MYSQL', 'LIST_AGENTS', 'INVALID_METADATA_KEY'),
              domain: ErrorDomain.STORAGE,
              category: ErrorCategory.USER,
              text: `Invalid metadata key: ${key}. Keys must be alphanumeric with underscores.`,
              details: { key },
            });
          }
          conditions.push(`JSON_EXTRACT(${quoteIdentifier('metadata', 'column name')}, '$.${key}') = ?`);
          queryParams.push(typeof value === 'string' ? value : JSON.stringify(value));
        }
      }

      const whereClause = conditions.length > 0 ? { sql: ` WHERE ${conditions.join(' AND ')}`, args: queryParams } : undefined;

      const total = await this.operations.loadTotalCount({ tableName: TABLE_AGENTS, whereClause });

      if (total === 0) {
        return {
          agents: [],
          total: 0,
          page,
          perPage: perPageForResponse,
          hasMore: false,
        };
      }

      const limitValue = perPageInput === false ? total : perPage;
      const rows = await this.operations.loadMany<Record<string, unknown>>({
        tableName: TABLE_AGENTS,
        whereClause,
        orderBy: `${quoteIdentifier(field, 'column name')} ${direction}`,
        offset,
        limit: limitValue,
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
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('MYSQL', 'LIST_AGENTS', 'FAILED'),
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

      await this.operations.insert({
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
          workspace: input.workspace ?? null,
          skills: input.skills ?? null,
          skillsFormat: input.skillsFormat ?? null,
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
          id: createStorageErrorId('MYSQL', 'CREATE_VERSION', 'FAILED'),
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
      const [rows] = await this.pool.execute<RowDataPacket[]>(
        `SELECT * FROM ${formatTableName(TABLE_AGENT_VERSIONS)} WHERE ${quoteIdentifier('id', 'column name')} = ?`,
        [id],
      );
      return rows.length ? this.parseVersionRow(rows[0]!) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('MYSQL', 'GET_VERSION', 'FAILED'),
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
      const rows = await this.operations.loadMany<Record<string, unknown>>({
        tableName: TABLE_AGENT_VERSIONS,
        whereClause: {
          sql: ` WHERE ${quoteIdentifier('agentId', 'column name')} = ? AND ${quoteIdentifier('versionNumber', 'column name')} = ?`,
          args: [agentId, versionNumber],
        },
        limit: 1,
      });

      return rows.length ? this.parseVersionRow(rows[0]!) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('MYSQL', 'GET_VERSION_BY_NUMBER', 'FAILED'),
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
      const rows = await this.operations.loadMany<Record<string, unknown>>({
        tableName: TABLE_AGENT_VERSIONS,
        whereClause: {
          sql: ` WHERE ${quoteIdentifier('agentId', 'column name')} = ?`,
          args: [agentId],
        },
        orderBy: `${quoteIdentifier('versionNumber', 'column name')} DESC`,
        limit: 1,
      });

      return rows.length ? this.parseVersionRow(rows[0]!) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('MYSQL', 'GET_LATEST_VERSION', 'FAILED'),
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
          id: createStorageErrorId('MYSQL', 'LIST_VERSIONS', 'INVALID_PAGE'),
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

      const whereClause = {
        sql: ` WHERE ${quoteIdentifier('agentId', 'column name')} = ?`,
        args: [agentId],
      };

      const total = await this.operations.loadTotalCount({ tableName: TABLE_AGENT_VERSIONS, whereClause });

      if (total === 0) {
        return {
          versions: [],
          total: 0,
          page,
          perPage: perPageForResponse,
          hasMore: false,
        };
      }

      const limitValue = perPageInput === false ? total : perPage;
      const rows = await this.operations.loadMany<Record<string, unknown>>({
        tableName: TABLE_AGENT_VERSIONS,
        whereClause,
        orderBy: `${quoteIdentifier(field, 'column name')} ${direction}`,
        offset,
        limit: limitValue,
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
          id: createStorageErrorId('MYSQL', 'LIST_VERSIONS', 'FAILED'),
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
      await this.operations.delete({ tableName: TABLE_AGENT_VERSIONS, keys: { id } });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('MYSQL', 'DELETE_VERSION', 'FAILED'),
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
      await this.pool.execute(
        `DELETE FROM ${formatTableName(TABLE_AGENT_VERSIONS)} WHERE ${quoteIdentifier('agentId', 'column name')} = ?`,
        [entityId],
      );
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('MYSQL', 'DELETE_VERSIONS_BY_AGENT_ID', 'FAILED'),
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
      return await this.operations.loadTotalCount({
        tableName: TABLE_AGENT_VERSIONS,
        whereClause: {
          sql: ` WHERE ${quoteIdentifier('agentId', 'column name')} = ?`,
          args: [agentId],
        },
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('MYSQL', 'COUNT_VERSIONS', 'FAILED'),
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

  private parseVersionRow(row: Record<string, unknown>): AgentVersion {
    return {
      id: row.id as string,
      agentId: row.agentId as string,
      versionNumber: Number(row.versionNumber),
      name: row.name as string,
      description: (row.description as string) ?? undefined,
      instructions: this.deserializeInstructions(row.instructions as string),
      model: this.safeParseJSON(row.model),
      tools: this.safeParseJSON(row.tools),
      defaultOptions: this.safeParseJSON(row.defaultOptions),
      workflows: this.safeParseJSON(row.workflows),
      agents: this.safeParseJSON(row.agents),
      integrationTools: this.safeParseJSON(row.integrationTools),
      inputProcessors: this.safeParseJSON(row.inputProcessors),
      outputProcessors: this.safeParseJSON(row.outputProcessors),
      memory: this.safeParseJSON(row.memory),
      scorers: this.safeParseJSON(row.scorers),
      mcpClients: this.safeParseJSON(row.mcpClients),
      requestContextSchema: this.safeParseJSON(row.requestContextSchema),
      workspace: this.safeParseJSON(row.workspace),
      skills: this.safeParseJSON(row.skills),
      skillsFormat: row.skillsFormat as 'xml' | 'json' | 'markdown' | undefined,
      changedFields: this.safeParseJSON(row.changedFields),
      changeMessage: (row.changeMessage as string) ?? undefined,
      createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt as string),
    };
  }
}
