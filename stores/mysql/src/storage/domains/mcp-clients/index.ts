import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  MCPClientsStorage,
  createStorageErrorId,
  normalizePerPage,
  calculatePagination,
  TABLE_MCP_CLIENTS,
  TABLE_MCP_CLIENT_VERSIONS,
  TABLE_SCHEMAS,
  MCP_CLIENTS_SCHEMA,
  MCP_CLIENT_VERSIONS_SCHEMA,
} from '@mastra/core/storage';
import type {
  CreateIndexOptions,
  StorageMCPClientType,
  StorageCreateMCPClientInput,
  StorageUpdateMCPClientInput,
  StorageListMCPClientsInput,
  StorageListMCPClientsOutput,
} from '@mastra/core/storage';
import type {
  MCPClientVersion,
  CreateMCPClientVersionInput,
  ListMCPClientVersionsInput,
  ListMCPClientVersionsOutput,
} from '@mastra/core/storage/domains/mcp-clients';
import type { Pool, RowDataPacket } from 'mysql2/promise';

import type { StoreOperationsMySQL } from '../operations';
import { generateTableSQL } from '../operations';
import { formatTableName, quoteIdentifier } from '../utils';

export class MCPClientsMySQL extends MCPClientsStorage {
  private pool: Pool;
  private operations: StoreOperationsMySQL;
  #skipDefaultIndexes?: boolean;
  #indexes?: CreateIndexOptions[];

  /** Tables managed by this domain */
  static readonly MANAGED_TABLES = [TABLE_MCP_CLIENTS, TABLE_MCP_CLIENT_VERSIONS] as const;

  /**
   * Returns default index definitions for the mcp-clients domain tables.
   * Currently no default indexes are defined for mcp-clients.
   */
  static getDefaultIndexDefs(_prefix: string = ''): CreateIndexOptions[] {
    return [];
  }

  /**
   * Exports DDL statements for all managed tables.
   */
  static getExportDDL(): string[] {
    return [
      generateTableSQL({ tableName: TABLE_MCP_CLIENTS, schema: TABLE_SCHEMAS[TABLE_MCP_CLIENTS] }),
      generateTableSQL({ tableName: TABLE_MCP_CLIENT_VERSIONS, schema: TABLE_SCHEMAS[TABLE_MCP_CLIENT_VERSIONS] }),
    ];
  }

  constructor({
    pool,
    operations,
    skipDefaultIndexes,
    indexes,
  }: {
    pool: Pool;
    operations: StoreOperationsMySQL;
    skipDefaultIndexes?: boolean;
    indexes?: CreateIndexOptions[];
  }) {
    super();
    this.pool = pool;
    this.operations = operations;
    this.#skipDefaultIndexes = skipDefaultIndexes;
    this.#indexes = indexes?.filter(idx => (MCPClientsMySQL.MANAGED_TABLES as readonly string[]).includes(idx.table));
  }

  /**
   * Returns default index definitions for the mcp-clients domain tables.
   */
  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    return MCPClientsMySQL.getDefaultIndexDefs('');
  }

  /**
   * Creates default indexes for optimal query performance.
   * Currently no default indexes are defined for mcp-clients.
   */
  async createDefaultIndexes(): Promise<void> {
    if (this.#skipDefaultIndexes) return;
    // No default indexes for mcp-clients domain
  }

  /**
   * Creates custom user-defined indexes for this domain's tables.
   */
  async createCustomIndexes(): Promise<void> {
    if (!this.#indexes || this.#indexes.length === 0) return;
    for (const indexDef of this.#indexes) {
      await this.operations.createIndex(indexDef);
    }
  }

  async init(): Promise<void> {
    await this.operations.createTable({ tableName: TABLE_MCP_CLIENTS, schema: MCP_CLIENTS_SCHEMA });
    await this.operations.createTable({ tableName: TABLE_MCP_CLIENT_VERSIONS, schema: MCP_CLIENT_VERSIONS_SCHEMA });
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.operations.clearTable({ tableName: TABLE_MCP_CLIENT_VERSIONS });
    await this.operations.clearTable({ tableName: TABLE_MCP_CLIENTS });
  }

  private safeParseJSON<T = unknown>(val: unknown): T | undefined {
    if (val === null || val === undefined) return undefined;
    if (typeof val === 'string') {
      try {
        return JSON.parse(val) as T;
      } catch {
        return val as T;
      }
    }
    return val as T;
  }

  private parseClientRow(row: Record<string, unknown>): StorageMCPClientType {
    return {
      id: row.id as string,
      status: (row.status as StorageMCPClientType['status']) ?? 'draft',
      activeVersionId: (row.activeVersionId as string) ?? undefined,
      authorId: (row.authorId as string) ?? undefined,
      metadata: this.safeParseJSON(row.metadata) as Record<string, unknown> | undefined,
      createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt as string),
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt as string),
    };
  }

  private parseVersionRow(row: Record<string, unknown>): MCPClientVersion {
    return {
      id: row.id as string,
      mcpClientId: row.mcpClientId as string,
      versionNumber: Number(row.versionNumber),
      name: row.name as string,
      description: (row.description as string) ?? undefined,
      servers: this.safeParseJSON(row.servers) as MCPClientVersion['servers'],
      changedFields: this.safeParseJSON(row.changedFields) as string[] | undefined,
      changeMessage: (row.changeMessage as string) ?? undefined,
      createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt as string),
    };
  }

  async getById(id: string): Promise<StorageMCPClientType | null> {
    try {
      const [rows] = await this.pool.execute<RowDataPacket[]>(
        `SELECT * FROM ${formatTableName(TABLE_MCP_CLIENTS)} WHERE ${quoteIdentifier('id', 'column name')} = ?`,
        [id],
      );
      return rows.length ? this.parseClientRow(rows[0]!) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('MYSQL', 'GET_MCP_CLIENT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async create(input: { mcpClient: StorageCreateMCPClientInput }): Promise<StorageMCPClientType> {
    const { mcpClient } = input;
    try {
      const now = new Date();
      await this.operations.insert({
        tableName: TABLE_MCP_CLIENTS,
        record: {
          id: mcpClient.id,
          status: 'draft',
          activeVersionId: null,
          authorId: mcpClient.authorId ?? null,
          metadata: mcpClient.metadata ?? null,
          createdAt: now,
          updatedAt: now,
        },
      });

      const { id: _id, authorId: _authorId, metadata: _metadata, ...snapshotConfig } = mcpClient;
      const versionId = crypto.randomUUID();
      try {
        await this.createVersion({
          id: versionId,
          mcpClientId: mcpClient.id,
          versionNumber: 1,
          ...snapshotConfig,
          changedFields: Object.keys(snapshotConfig),
          changeMessage: 'Initial version',
        });
      } catch (versionError) {
        try {
          await this.operations.delete({ tableName: TABLE_MCP_CLIENTS, keys: { id: mcpClient.id } });
        } catch (rollbackError) {
          console.error('Failed to rollback MCP client creation:', rollbackError);
        }
        throw versionError;
      }

      return {
        id: mcpClient.id,
        status: 'draft',
        activeVersionId: undefined,
        authorId: mcpClient.authorId,
        metadata: mcpClient.metadata,
        createdAt: now,
        updatedAt: now,
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('MYSQL', 'CREATE_MCP_CLIENT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async update(input: StorageUpdateMCPClientInput): Promise<StorageMCPClientType> {
    const { id, ...updates } = input;
    try {
      const existing = await this.getById(id);
      if (!existing) {
        throw new MastraError({
          id: createStorageErrorId('MYSQL', 'UPDATE_MCP_CLIENT', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: `MCP client with id ${id} not found`,
          details: { id },
        });
      }

      const { authorId, activeVersionId, metadata, status } = updates;
      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (authorId !== undefined) updateData.authorId = authorId;
      if (activeVersionId !== undefined) updateData.activeVersionId = activeVersionId;
      if (status !== undefined) updateData.status = status;
      if (metadata !== undefined) updateData.metadata = { ...existing.metadata, ...metadata };

      await this.operations.update({ tableName: TABLE_MCP_CLIENTS, keys: { id }, data: updateData });

      const updated = await this.getById(id);
      if (!updated)
        throw new MastraError({
          id: createStorageErrorId('MYSQL', 'UPDATE_MCP_CLIENT', 'NOT_FOUND_AFTER_UPDATE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.SYSTEM,
          text: `MCP client ${id} not found after update`,
          details: { id },
        });
      return updated;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('MYSQL', 'UPDATE_MCP_CLIENT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.deleteVersionsByParentId(id);
      await this.operations.delete({ tableName: TABLE_MCP_CLIENTS, keys: { id } });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('MYSQL', 'DELETE_MCP_CLIENT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async list(args?: StorageListMCPClientsInput): Promise<StorageListMCPClientsOutput> {
    try {
      const { page = 0, perPage: perPageInput, orderBy, authorId, metadata, status = 'published' } = args || {};
      const { field, direction } = this.parseOrderBy(orderBy);

      const conditions: string[] = [];
      const queryParams: any[] = [];
      conditions.push(`${quoteIdentifier('status', 'column name')} = ?`);
      queryParams.push(status);
      if (authorId !== undefined) {
        conditions.push(`${quoteIdentifier('authorId', 'column name')} = ?`);
        queryParams.push(authorId);
      }
      if (metadata && Object.keys(metadata).length > 0) {
        for (const [key, value] of Object.entries(metadata)) {
          if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key))
            throw new MastraError({
              id: createStorageErrorId('MYSQL', 'LIST_MCP_CLIENTS', 'INVALID_METADATA_KEY'),
              domain: ErrorDomain.STORAGE,
              category: ErrorCategory.USER,
              text: `Invalid metadata key: ${key}`,
              details: { key },
            });
          if (typeof value === 'string') {
            conditions.push(
              `JSON_UNQUOTE(JSON_EXTRACT(${quoteIdentifier('metadata', 'column name')}, '$.${key}')) = ?`,
            );
            queryParams.push(value);
          } else {
            conditions.push(
              `JSON_EXTRACT(${quoteIdentifier('metadata', 'column name')}, '$.${key}') = CAST(? AS JSON)`,
            );
            queryParams.push(JSON.stringify(value));
          }
        }
      }

      const whereClause = { sql: ` WHERE ${conditions.join(' AND ')}`, args: queryParams };
      const total = await this.operations.loadTotalCount({ tableName: TABLE_MCP_CLIENTS, whereClause });
      if (total === 0) return { mcpClients: [], total: 0, page, perPage: perPageInput ?? 100, hasMore: false };

      const perPage = normalizePerPage(perPageInput, 100);
      const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
      const limitValue = perPageInput === false ? total : perPage;

      const rows = await this.operations.loadMany<Record<string, unknown>>({
        tableName: TABLE_MCP_CLIENTS,
        whereClause,
        orderBy: `${quoteIdentifier(field, 'column name')} ${direction}`,
        offset,
        limit: limitValue,
      });

      return {
        mcpClients: rows.map(row => this.parseClientRow(row)),
        total,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : offset + perPage < total,
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('MYSQL', 'LIST_MCP_CLIENTS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  // ==========================================================================
  // Version Methods
  // ==========================================================================

  async createVersion(input: CreateMCPClientVersionInput): Promise<MCPClientVersion> {
    try {
      const now = new Date();
      await this.operations.insert({
        tableName: TABLE_MCP_CLIENT_VERSIONS,
        record: {
          id: input.id,
          mcpClientId: input.mcpClientId,
          versionNumber: input.versionNumber,
          name: input.name,
          description: input.description ?? null,
          servers: input.servers ?? null,
          changedFields: input.changedFields ?? null,
          changeMessage: input.changeMessage ?? null,
          createdAt: now,
        },
      });
      return { ...input, createdAt: now };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('MYSQL', 'CREATE_MCP_CLIENT_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getVersion(id: string): Promise<MCPClientVersion | null> {
    try {
      const [rows] = await this.pool.execute<RowDataPacket[]>(
        `SELECT * FROM ${formatTableName(TABLE_MCP_CLIENT_VERSIONS)} WHERE ${quoteIdentifier('id', 'column name')} = ?`,
        [id],
      );
      return rows.length ? this.parseVersionRow(rows[0]!) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('MYSQL', 'GET_MCP_CLIENT_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getVersionByNumber(mcpClientId: string, versionNumber: number): Promise<MCPClientVersion | null> {
    try {
      const rows = await this.operations.loadMany<Record<string, unknown>>({
        tableName: TABLE_MCP_CLIENT_VERSIONS,
        whereClause: {
          sql: ` WHERE ${quoteIdentifier('mcpClientId', 'column name')} = ? AND ${quoteIdentifier('versionNumber', 'column name')} = ?`,
          args: [mcpClientId, versionNumber],
        },
        limit: 1,
      });
      return rows.length ? this.parseVersionRow(rows[0]!) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('MYSQL', 'GET_MCP_CLIENT_VERSION_BY_NUMBER', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getLatestVersion(mcpClientId: string): Promise<MCPClientVersion | null> {
    try {
      const rows = await this.operations.loadMany<Record<string, unknown>>({
        tableName: TABLE_MCP_CLIENT_VERSIONS,
        whereClause: { sql: ` WHERE ${quoteIdentifier('mcpClientId', 'column name')} = ?`, args: [mcpClientId] },
        orderBy: `${quoteIdentifier('versionNumber', 'column name')} DESC`,
        limit: 1,
      });
      return rows.length ? this.parseVersionRow(rows[0]!) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('MYSQL', 'GET_LATEST_MCP_CLIENT_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async listVersions(input: ListMCPClientVersionsInput): Promise<ListMCPClientVersionsOutput> {
    try {
      const { mcpClientId, page = 0, perPage: perPageInput, orderBy } = input;
      const { field, direction } = this.parseVersionOrderBy(orderBy);
      const whereClause = { sql: ` WHERE ${quoteIdentifier('mcpClientId', 'column name')} = ?`, args: [mcpClientId] };
      const total = await this.operations.loadTotalCount({ tableName: TABLE_MCP_CLIENT_VERSIONS, whereClause });
      if (total === 0) return { versions: [], total: 0, page, perPage: perPageInput ?? 20, hasMore: false };

      const perPage = normalizePerPage(perPageInput, 20);
      const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
      const limitValue = perPageInput === false ? total : perPage;

      const rows = await this.operations.loadMany<Record<string, unknown>>({
        tableName: TABLE_MCP_CLIENT_VERSIONS,
        whereClause,
        orderBy: `${quoteIdentifier(field, 'column name')} ${direction}`,
        offset,
        limit: limitValue,
      });

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
          id: createStorageErrorId('MYSQL', 'LIST_MCP_CLIENT_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async deleteVersion(id: string): Promise<void> {
    try {
      await this.operations.delete({ tableName: TABLE_MCP_CLIENT_VERSIONS, keys: { id } });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('MYSQL', 'DELETE_MCP_CLIENT_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async deleteVersionsByParentId(entityId: string): Promise<void> {
    try {
      await this.pool.execute(
        `DELETE FROM ${formatTableName(TABLE_MCP_CLIENT_VERSIONS)} WHERE ${quoteIdentifier('mcpClientId', 'column name')} = ?`,
        [entityId],
      );
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('MYSQL', 'DELETE_MCP_CLIENT_VERSIONS_BY_CLIENT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async countVersions(mcpClientId: string): Promise<number> {
    try {
      return await this.operations.loadTotalCount({
        tableName: TABLE_MCP_CLIENT_VERSIONS,
        whereClause: { sql: ` WHERE ${quoteIdentifier('mcpClientId', 'column name')} = ?`, args: [mcpClientId] },
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('MYSQL', 'COUNT_MCP_CLIENT_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }
}
