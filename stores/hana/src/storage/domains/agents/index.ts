import { randomUUID } from 'node:crypto';

import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  AgentsStorage,
  AGENTS_SCHEMA,
  AGENT_VERSIONS_SCHEMA,
  TABLE_AGENTS,
  TABLE_AGENT_VERSIONS,
  createStorageErrorId,
  normalizePerPage,
  calculatePagination,
} from '@mastra/core/storage';
import type {
  StorageAgentType,
  StorageCreateAgentInput,
  StorageUpdateAgentInput,
  StorageListAgentsInput,
  StorageListAgentsOutput,
  CreateIndexOptions,
} from '@mastra/core/storage';
import type {
  AgentVersion,
  CreateVersionInput,
  ListVersionsInput,
  ListVersionsOutput,
} from '@mastra/core/storage/domains/agents';
import { parseSqlIdentifier } from '@mastra/core/utils';

import { HANAClient, resolveHanaConfig } from '../../db';
import type { HANADomainConfig } from '../../db';
import { getTableName, getSchemaName } from '../utils';

export class AgentsHANA extends AgentsStorage {
  private db: HANAClient;
  private schema?: string;
  private needsInit: boolean;
  private skipDefaultIndexes?: boolean;
  private indexes?: CreateIndexOptions[];

  static readonly MANAGED_TABLES = [TABLE_AGENTS, TABLE_AGENT_VERSIONS] as const;

  constructor(config: HANADomainConfig) {
    super();
    const { pool, schemaName, skipDefaultIndexes, indexes, needsInit } = resolveHanaConfig(config);
    this.schema = schemaName;
    this.db = new HANAClient({ pool, schemaName, skipDefaultIndexes });
    this.needsInit = needsInit;
    this.skipDefaultIndexes = skipDefaultIndexes;
    this.indexes = indexes?.filter(idx => (AgentsHANA.MANAGED_TABLES as readonly string[]).includes(idx.table));
  }

  async init(): Promise<void> {
    if (this.needsInit) {
      await this.db.pool.initialize();
      this.needsInit = false;
    }
    await this.db.createTable({ tableName: TABLE_AGENTS, schema: AGENTS_SCHEMA });
    await this.db.createTable({ tableName: TABLE_AGENT_VERSIONS, schema: AGENT_VERSIONS_SCHEMA });
    this.schema = this.db.schemaName;
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  private getDefaultIndexDefinitions(): CreateIndexOptions[] {
    const schemaPrefix = this.schema ? `${this.schema}_` : '';
    return [
      {
        name: `${schemaPrefix}mastra_agents_createdat_idx`,
        table: TABLE_AGENTS,
        columns: ['createdAt DESC'],
      },
      {
        name: `${schemaPrefix}mastra_agent_versions_agentid_versionnumber_uniq`,
        table: TABLE_AGENT_VERSIONS,
        columns: ['agentId', 'versionNumber DESC'],
        unique: true,
      },
      {
        name: `${schemaPrefix}mastra_agent_versions_agentid_createdat_idx`,
        table: TABLE_AGENT_VERSIONS,
        columns: ['agentId', 'createdAt DESC'],
      },
    ];
  }

  private async createDefaultIndexes(): Promise<void> {
    if (this.skipDefaultIndexes) return;
    for (const indexDef of this.getDefaultIndexDefinitions()) {
      try {
        await this.db.createIndex(indexDef);
      } catch (error) {
        this.logger?.warn?.(`Failed to create index ${indexDef.name}:`, error);
      }
    }
  }

  private async createCustomIndexes(): Promise<void> {
    if (!this.indexes || this.indexes.length === 0) return;
    for (const indexDef of this.indexes) {
      try {
        await this.db.createIndex(indexDef);
      } catch (error) {
        this.logger?.warn?.(`Failed to create custom index ${indexDef.name}:`, error);
      }
    }
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.db.clearTable({ tableName: TABLE_AGENT_VERSIONS });
    await this.db.clearTable({ tableName: TABLE_AGENTS });
  }

  private parseJson(value: unknown, fieldName?: string): unknown {
    if (value === null || value === undefined) return undefined;
    if (typeof value !== 'string') return value;
    try {
      return JSON.parse(value);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('HANA', 'PARSE_JSON', 'INVALID_JSON'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.SYSTEM,
          text: `Failed to parse JSON${fieldName ? ` for field "${fieldName}"` : ''}: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`,
          details: { field: fieldName ?? '', valueLen: (value as string).length },
        },
        error as Error,
      );
    }
  }

  private serializeInstructions(instructions: string | string[] | undefined): string | undefined {
    if (instructions === undefined) return undefined;
    return Array.isArray(instructions) ? JSON.stringify(instructions) : instructions;
  }

  private deserializeInstructions(raw: string | null | undefined): string | string[] | undefined {
    if (!raw) return raw ?? undefined;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // fall through — value is a plain string
    }
    return raw;
  }

  private parseRow(row: Record<string, unknown>): StorageAgentType {
    return {
      id: row['id'] as string,
      status: row['status'] as StorageAgentType['status'],
      activeVersionId: (row['activeVersionId'] as string | null | undefined) ?? undefined,
      authorId: (row['authorId'] as string | null | undefined) ?? undefined,
      visibility: (row['visibility'] as StorageAgentType['visibility'] | null | undefined) ?? undefined,
      favoriteCount: row['favoriteCount'] != null ? Number(row['favoriteCount']) : 0,
      metadata: this.parseJson(row['metadata'], 'metadata') as StorageAgentType['metadata'],
      createdAt: row['createdAt'] instanceof Date ? row['createdAt'] : new Date(row['createdAt'] as string),
      updatedAt: row['updatedAt'] instanceof Date ? row['updatedAt'] : new Date(row['updatedAt'] as string),
    };
  }

  private parseVersionRow(row: Record<string, unknown>): AgentVersion {
    return {
      id: row['id'] as string,
      agentId: row['agentId'] as string,
      versionNumber: row['versionNumber'] as number,
      name: row['name'] as string,
      description: (row['description'] as string | null | undefined) ?? undefined,
      instructions: this.deserializeInstructions(
        row['instructions'] as string | null | undefined,
      ) as AgentVersion['instructions'],
      model: this.parseJson(row['model'], 'model') as AgentVersion['model'],
      tools: this.parseJson(row['tools'], 'tools') as AgentVersion['tools'],
      defaultOptions: this.parseJson(row['defaultOptions'], 'defaultOptions') as AgentVersion['defaultOptions'],
      workflows: this.parseJson(row['workflows'], 'workflows') as AgentVersion['workflows'],
      agents: this.parseJson(row['agents'], 'agents') as AgentVersion['agents'],
      integrationTools: this.parseJson(row['integrationTools'], 'integrationTools') as AgentVersion['integrationTools'],
      inputProcessors: this.parseJson(row['inputProcessors'], 'inputProcessors') as AgentVersion['inputProcessors'],
      outputProcessors: this.parseJson(row['outputProcessors'], 'outputProcessors') as AgentVersion['outputProcessors'],
      memory: this.parseJson(row['memory'], 'memory') as AgentVersion['memory'],
      scorers: this.parseJson(row['scorers'], 'scorers') as AgentVersion['scorers'],
      mcpClients: this.parseJson(row['mcpClients'], 'mcpClients') as AgentVersion['mcpClients'],
      requestContextSchema: this.parseJson(
        row['requestContextSchema'],
        'requestContextSchema',
      ) as AgentVersion['requestContextSchema'],
      workspace: this.parseJson(row['workspace'], 'workspace') as AgentVersion['workspace'],
      skills: this.parseJson(row['skills'], 'skills') as AgentVersion['skills'],
      skillsFormat: (row['skillsFormat'] as 'xml' | 'json' | 'markdown' | null | undefined) ?? undefined,
      changedFields: this.parseJson(row['changedFields'], 'changedFields') as AgentVersion['changedFields'],
      changeMessage: (row['changeMessage'] as string | null | undefined) ?? undefined,
      createdAt: row['createdAt'] instanceof Date ? row['createdAt'] : new Date(row['createdAt'] as string),
    };
  }

  async getById(id: string): Promise<StorageAgentType | null> {
    try {
      const result = await this.db.load({ tableName: TABLE_AGENTS, keys: { id } });
      return result ? this.parseRow(result) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('HANA', 'GET_AGENT_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { agentId: id },
        },
        error as Error,
      );
    }
  }

  async create(input: { agent: StorageCreateAgentInput }): Promise<StorageAgentType> {
    const { agent } = input;
    try {
      const now = new Date();
      await this.db.insert({
        tableName: TABLE_AGENTS,
        record: {
          id: agent.id,
          status: 'draft',
          activeVersionId: null,
          authorId: agent.authorId ?? null,
          visibility: agent.visibility ?? null,
          favoriteCount: null,
          metadata: agent.metadata ?? null,
          createdAt: now,
          updatedAt: now,
        },
      });
      const { id: _id, authorId: _authorId, metadata: _metadata, ...snapshotConfig } = agent;
      const versionId = randomUUID();
      await this.createVersion({
        id: versionId,
        agentId: agent.id,
        versionNumber: 1,
        ...snapshotConfig,
        changedFields: Object.keys(snapshotConfig),
        changeMessage: 'Initial version',
      } as CreateVersionInput);
      const created = await this.getById(agent.id);
      if (!created) {
        throw new MastraError({
          id: createStorageErrorId('HANA', 'CREATE_AGENT', 'NOT_FOUND_AFTER_CREATE'),
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
          id: createStorageErrorId('HANA', 'CREATE_AGENT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { agentId: agent.id },
        },
        error as Error,
      );
    }
  }

  async update(input: StorageUpdateAgentInput): Promise<StorageAgentType> {
    const { id, ...updates } = input;
    try {
      const existing = await this.getById(id);
      if (!existing) {
        throw new MastraError({
          id: createStorageErrorId('HANA', 'UPDATE_AGENT', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: `Agent ${id} not found`,
          details: { agentId: id },
        });
      }
      const { authorId, activeVersionId, metadata, status } = updates;
      const data: Record<string, unknown> = { updatedAt: new Date() };
      if (authorId !== undefined) data.authorId = authorId;
      if (activeVersionId !== undefined) data.activeVersionId = activeVersionId;
      if (status !== undefined) data.status = status;
      if (metadata !== undefined) data.metadata = { ...existing.metadata, ...metadata };
      await this.db.update({ tableName: TABLE_AGENTS, keys: { id }, data });
      const updated = await this.getById(id);
      if (!updated) {
        throw new MastraError({
          id: createStorageErrorId('HANA', 'UPDATE_AGENT', 'NOT_FOUND_AFTER_UPDATE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.SYSTEM,
          text: `Agent ${id} not found after update`,
          details: { agentId: id },
        });
      }
      return updated;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('HANA', 'UPDATE_AGENT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { agentId: id },
        },
        error as Error,
      );
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.deleteVersionsByParentId(id);
      const fullName = getTableName({ indexName: TABLE_AGENTS, schemaName: getSchemaName(this.schema) });
      await this.db.pool.withConnection(conn => conn.execPromise(`DELETE FROM ${fullName} WHERE "id" = ?`, [id]));
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('HANA', 'DELETE_AGENT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { agentId: id },
        },
        error as Error,
      );
    }
  }

  async list(args?: StorageListAgentsInput): Promise<StorageListAgentsOutput> {
    const { page = 0, perPage: perPageInput, orderBy, authorId, metadata, status } = args || {};
    const { field, direction } = this.parseOrderBy(orderBy);
    if (page < 0) {
      throw new MastraError(
        {
          id: createStorageErrorId('HANA', 'LIST_AGENTS', 'INVALID_PAGE'),
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
      const params: unknown[] = [];

      if (status !== undefined) {
        conditions.push('"status" = ?');
        params.push(status);
      }
      if (authorId !== undefined) {
        conditions.push('"authorId" = ?');
        params.push(authorId);
      }
      if (metadata && Object.keys(metadata).length > 0) {
        for (const [key, value] of Object.entries(metadata)) {
          if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
            throw new MastraError({
              id: createStorageErrorId('HANA', 'LIST_AGENTS', 'INVALID_METADATA_KEY'),
              domain: ErrorDomain.STORAGE,
              category: ErrorCategory.USER,
              text: `Invalid metadata key: ${key}. Keys must be alphanumeric with underscores.`,
              details: { key },
            });
          }
          if (value !== null && typeof value === 'object') {
            throw new MastraError({
              id: createStorageErrorId('HANA', 'LIST_AGENTS', 'NON_PRIMITIVE_METADATA'),
              domain: ErrorDomain.STORAGE,
              category: ErrorCategory.USER,
              text: `Metadata filter for key "${key}" must be a primitive; received ${Array.isArray(value) ? 'array' : 'object'}.`,
              details: { key },
            });
          }
          if (value === null) {
            conditions.push(`JSON_VALUE("metadata", '$.${key}') IS NULL`);
            continue;
          }
          conditions.push(`JSON_VALUE("metadata", '$.${key}') = ?`);
          params.push(typeof value === 'string' ? value : String(value));
        }
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const fullName = getTableName({ indexName: TABLE_AGENTS, schemaName: getSchemaName(this.schema) });

      const countRows = (await this.db.pool.withConnection(conn =>
        conn.execPromise(`SELECT COUNT(*) AS CNT FROM ${fullName} ${whereClause}`, [...params]),
      )) as Array<{ CNT: number }>;
      const total = Number(countRows[0]?.CNT ?? 0);

      if (total === 0) {
        return { agents: [], total: 0, page, perPage: perPageForResponse, hasMore: false };
      }

      const limitValue = perPageInput === false ? total : perPage;
      const fieldSafe = parseSqlIdentifier(field, 'order column');
      const dirSafe = direction === 'ASC' ? 'ASC' : 'DESC';

      const rows = (await this.db.pool.withConnection(conn =>
        conn.execPromise(
          `SELECT * FROM ${fullName} ${whereClause} ORDER BY "${fieldSafe}" ${dirSafe} LIMIT ? OFFSET ?`,
          [...params, limitValue, offset],
        ),
      )) as Array<Record<string, unknown>>;

      return {
        agents: rows.map(row => this.parseRow(row)),
        total,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : offset + perPage < total,
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('HANA', 'LIST_AGENTS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error as Error,
      );
    }
  }

  async createVersion(input: CreateVersionInput): Promise<AgentVersion> {
    try {
      const now = new Date();
      await this.db.insert({
        tableName: TABLE_AGENT_VERSIONS,
        record: {
          id: input.id,
          agentId: input.agentId,
          versionNumber: input.versionNumber,
          name: input.name ?? null,
          description: input.description ?? null,
          instructions: this.serializeInstructions(input.instructions as string | string[] | undefined) ?? null,
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
      return { ...input, createdAt: now } as AgentVersion;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('HANA', 'CREATE_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { versionId: input.id, agentId: input.agentId },
        },
        error as Error,
      );
    }
  }

  async getVersion(id: string): Promise<AgentVersion | null> {
    try {
      const result = await this.db.load({ tableName: TABLE_AGENT_VERSIONS, keys: { id } });
      return result ? this.parseVersionRow(result) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('HANA', 'GET_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { versionId: id },
        },
        error as Error,
      );
    }
  }

  async getVersionByNumber(agentId: string, versionNumber: number): Promise<AgentVersion | null> {
    try {
      const fullName = getTableName({ indexName: TABLE_AGENT_VERSIONS, schemaName: getSchemaName(this.schema) });
      const rows = (await this.db.pool.withConnection(conn =>
        conn.execPromise(`SELECT * FROM ${fullName} WHERE "agentId" = ? AND "versionNumber" = ? LIMIT 1`, [
          agentId,
          versionNumber,
        ]),
      )) as Array<Record<string, unknown>>;
      return rows?.[0] ? this.parseVersionRow(rows[0]) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('HANA', 'GET_VERSION_BY_NUMBER', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { agentId, versionNumber },
        },
        error as Error,
      );
    }
  }

  async getLatestVersion(agentId: string): Promise<AgentVersion | null> {
    try {
      const fullName = getTableName({ indexName: TABLE_AGENT_VERSIONS, schemaName: getSchemaName(this.schema) });
      const rows = (await this.db.pool.withConnection(conn =>
        conn.execPromise(`SELECT * FROM ${fullName} WHERE "agentId" = ? ORDER BY "versionNumber" DESC LIMIT 1`, [
          agentId,
        ]),
      )) as Array<Record<string, unknown>>;
      return rows?.[0] ? this.parseVersionRow(rows[0]) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('HANA', 'GET_LATEST_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { agentId },
        },
        error as Error,
      );
    }
  }

  async listVersions(input: ListVersionsInput): Promise<ListVersionsOutput> {
    const { agentId, page = 0, perPage: perPageInput, orderBy } = input;
    if (page < 0) {
      throw new MastraError(
        {
          id: createStorageErrorId('HANA', 'LIST_VERSIONS', 'INVALID_PAGE'),
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
      const fullName = getTableName({ indexName: TABLE_AGENT_VERSIONS, schemaName: getSchemaName(this.schema) });

      const countRows = (await this.db.pool.withConnection(conn =>
        conn.execPromise(`SELECT COUNT(*) AS CNT FROM ${fullName} WHERE "agentId" = ?`, [agentId]),
      )) as Array<{ CNT: number }>;
      const total = Number(countRows[0]?.CNT ?? 0);

      if (total === 0) {
        return { versions: [], total: 0, page, perPage: perPageForResponse, hasMore: false };
      }

      const limitValue = perPageInput === false ? total : perPage;
      const fieldSafe = parseSqlIdentifier(field, 'order column');
      const dirSafe = direction === 'ASC' ? 'ASC' : 'DESC';

      const rows = (await this.db.pool.withConnection(conn =>
        conn.execPromise(
          `SELECT * FROM ${fullName} WHERE "agentId" = ? ORDER BY "${fieldSafe}" ${dirSafe} LIMIT ? OFFSET ?`,
          [agentId, limitValue, offset],
        ),
      )) as Array<Record<string, unknown>>;

      return {
        versions: rows.map(row => this.parseVersionRow(row)),
        total,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : offset + perPage < total,
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('HANA', 'LIST_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { agentId },
        },
        error as Error,
      );
    }
  }

  async deleteVersion(id: string): Promise<void> {
    try {
      const fullName = getTableName({ indexName: TABLE_AGENT_VERSIONS, schemaName: getSchemaName(this.schema) });
      await this.db.pool.withConnection(conn => conn.execPromise(`DELETE FROM ${fullName} WHERE "id" = ?`, [id]));
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('HANA', 'DELETE_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { versionId: id },
        },
        error as Error,
      );
    }
  }

  async deleteVersionsByParentId(entityId: string): Promise<void> {
    try {
      const fullName = getTableName({ indexName: TABLE_AGENT_VERSIONS, schemaName: getSchemaName(this.schema) });
      await this.db.pool.withConnection(conn =>
        conn.execPromise(`DELETE FROM ${fullName} WHERE "agentId" = ?`, [entityId]),
      );
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('HANA', 'DELETE_VERSIONS_BY_AGENT_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { agentId: entityId },
        },
        error as Error,
      );
    }
  }

  async countVersions(agentId: string): Promise<number> {
    try {
      const fullName = getTableName({ indexName: TABLE_AGENT_VERSIONS, schemaName: getSchemaName(this.schema) });
      const rows = (await this.db.pool.withConnection(conn =>
        conn.execPromise(`SELECT COUNT(*) AS CNT FROM ${fullName} WHERE "agentId" = ?`, [agentId]),
      )) as Array<{ CNT: number }>;
      return Number(rows[0]?.CNT ?? 0);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('HANA', 'COUNT_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { agentId },
        },
        error as Error,
      );
    }
  }
}
