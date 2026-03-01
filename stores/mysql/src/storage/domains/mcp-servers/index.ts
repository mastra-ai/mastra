import type { Pool, RowDataPacket } from 'mysql2/promise';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  MCPServersStorage,
  createStorageErrorId,
  normalizePerPage,
  calculatePagination,
  TABLE_MCP_SERVERS,
  TABLE_MCP_SERVER_VERSIONS,
  MCP_SERVERS_SCHEMA,
  MCP_SERVER_VERSIONS_SCHEMA,
} from '@mastra/core/storage';
import type {
  StorageMCPServerType,
  StorageCreateMCPServerInput,
  StorageUpdateMCPServerInput,
  StorageListMCPServersInput,
  StorageListMCPServersOutput,
} from '@mastra/core/storage';
import type {
  MCPServerVersion,
  CreateMCPServerVersionInput,
  ListMCPServerVersionsInput,
  ListMCPServerVersionsOutput,
} from '@mastra/core/storage/domains/mcp-servers';

import type { StoreOperationsMySQL } from '../operations';
import { formatTableName, quoteIdentifier } from '../utils';

export class MCPServersMySQL extends MCPServersStorage {
  private pool: Pool;
  private operations: StoreOperationsMySQL;

  constructor({ pool, operations }: { pool: Pool; operations: StoreOperationsMySQL }) {
    super();
    this.pool = pool;
    this.operations = operations;
  }

  async init(): Promise<void> {
    await this.operations.createTable({ tableName: TABLE_MCP_SERVERS, schema: MCP_SERVERS_SCHEMA });
    await this.operations.createTable({ tableName: TABLE_MCP_SERVER_VERSIONS, schema: MCP_SERVER_VERSIONS_SCHEMA });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.operations.clearTable({ tableName: TABLE_MCP_SERVER_VERSIONS });
    await this.operations.clearTable({ tableName: TABLE_MCP_SERVERS });
  }

  private safeParseJSON(val: unknown): any {
    if (val === null || val === undefined) return undefined;
    if (typeof val === 'string') {
      try { return JSON.parse(val); } catch { return val; }
    }
    return val;
  }

  private parseServerRow(row: Record<string, unknown>): StorageMCPServerType {
    return {
      id: row.id as string,
      status: (row.status as StorageMCPServerType['status']) ?? 'draft',
      activeVersionId: (row.activeVersionId as string) ?? undefined,
      authorId: (row.authorId as string) ?? undefined,
      metadata: this.safeParseJSON(row.metadata) as Record<string, unknown> | undefined,
      createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt as string),
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt as string),
    };
  }

  private parseVersionRow(row: Record<string, unknown>): MCPServerVersion {
    return {
      id: row.id as string,
      mcpServerId: row.mcpServerId as string,
      versionNumber: Number(row.versionNumber),
      name: row.name as string,
      version: row.version as string,
      description: (row.description as string) ?? undefined,
      instructions: (row.instructions as string) ?? undefined,
      repository: this.safeParseJSON(row.repository) as MCPServerVersion['repository'],
      releaseDate: (row.releaseDate as string) ?? undefined,
      isLatest: row.isLatest === null || row.isLatest === undefined ? undefined : Boolean(row.isLatest === true || row.isLatest === 1 || row.isLatest === '1'),
      packageCanonical: (row.packageCanonical as string) ?? undefined,
      tools: this.safeParseJSON(row.tools) as MCPServerVersion['tools'],
      agents: this.safeParseJSON(row.agents) as MCPServerVersion['agents'],
      workflows: this.safeParseJSON(row.workflows) as MCPServerVersion['workflows'],
      changedFields: this.safeParseJSON(row.changedFields) as string[] | undefined,
      changeMessage: (row.changeMessage as string) ?? undefined,
      createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt as string),
    };
  }

  async getById(id: string): Promise<StorageMCPServerType | null> {
    try {
      const [rows] = await this.pool.execute<RowDataPacket[]>(
        `SELECT * FROM ${formatTableName(TABLE_MCP_SERVERS)} WHERE ${quoteIdentifier('id', 'column name')} = ?`, [id],
      );
      return rows.length ? this.parseServerRow(rows[0]!) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError({ id: createStorageErrorId('MYSQL', 'GET_MCP_SERVER', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY }, error);
    }
  }

  async create(input: { mcpServer: StorageCreateMCPServerInput }): Promise<StorageMCPServerType> {
    const { mcpServer } = input;
    try {
      const now = new Date();
      await this.operations.insert({
        tableName: TABLE_MCP_SERVERS,
        record: { id: mcpServer.id, status: 'draft', activeVersionId: null, authorId: mcpServer.authorId ?? null, metadata: mcpServer.metadata ?? null, createdAt: now, updatedAt: now },
      });

      const { id: _id, authorId: _authorId, metadata: _metadata, ...snapshotConfig } = mcpServer;
      const versionId = crypto.randomUUID();
      try {
        await this.createVersion({ id: versionId, mcpServerId: mcpServer.id, versionNumber: 1, ...snapshotConfig, changedFields: Object.keys(snapshotConfig), changeMessage: 'Initial version' });
      } catch (versionError) {
        await this.operations.delete({ tableName: TABLE_MCP_SERVERS, keys: { id: mcpServer.id } });
        throw versionError;
      }

      return { id: mcpServer.id, status: 'draft', activeVersionId: undefined, authorId: mcpServer.authorId, metadata: mcpServer.metadata, createdAt: now, updatedAt: now };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError({ id: createStorageErrorId('MYSQL', 'CREATE_MCP_SERVER', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY }, error);
    }
  }

  async update(input: StorageUpdateMCPServerInput): Promise<StorageMCPServerType> {
    const { id, ...updates } = input;
    try {
      const existing = await this.getById(id);
      if (!existing) throw new Error(`MCP server with id ${id} not found`);

      const { authorId, activeVersionId, metadata, status } = updates;
      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (authorId !== undefined) updateData.authorId = authorId;
      if (activeVersionId !== undefined) updateData.activeVersionId = activeVersionId;
      if (status !== undefined) updateData.status = status;
      if (metadata !== undefined) updateData.metadata = { ...existing.metadata, ...metadata };

      await this.operations.update({ tableName: TABLE_MCP_SERVERS, keys: { id }, data: updateData });

      const updated = await this.getById(id);
      if (!updated) throw new MastraError({ id: createStorageErrorId('MYSQL', 'UPDATE_MCP_SERVER', 'NOT_FOUND_AFTER_UPDATE'), domain: ErrorDomain.STORAGE, category: ErrorCategory.SYSTEM, text: `MCP server ${id} not found after update`, details: { id } });
      return updated;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError({ id: createStorageErrorId('MYSQL', 'UPDATE_MCP_SERVER', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY }, error);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.deleteVersionsByParentId(id);
      await this.operations.delete({ tableName: TABLE_MCP_SERVERS, keys: { id } });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError({ id: createStorageErrorId('MYSQL', 'DELETE_MCP_SERVER', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY }, error);
    }
  }

  async list(args?: StorageListMCPServersInput): Promise<StorageListMCPServersOutput> {
    try {
      const { page = 0, perPage: perPageInput, orderBy, authorId, metadata, status = 'published' } = args || {};
      const { field, direction } = this.parseOrderBy(orderBy);

      const conditions: string[] = [];
      const queryParams: any[] = [];
      conditions.push(`${quoteIdentifier('status', 'column name')} = ?`);
      queryParams.push(status);
      if (authorId !== undefined) { conditions.push(`${quoteIdentifier('authorId', 'column name')} = ?`); queryParams.push(authorId); }
      if (metadata && Object.keys(metadata).length > 0) {
        for (const [key, value] of Object.entries(metadata)) {
          if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) throw new MastraError({ id: createStorageErrorId('MYSQL', 'LIST_MCP_SERVERS', 'INVALID_METADATA_KEY'), domain: ErrorDomain.STORAGE, category: ErrorCategory.USER, text: `Invalid metadata key: ${key}`, details: { key } });
          conditions.push(`JSON_EXTRACT(${quoteIdentifier('metadata', 'column name')}, '$.${key}') = ?`);
          queryParams.push(typeof value === 'string' ? value : JSON.stringify(value));
        }
      }

      const whereClause = { sql: ` WHERE ${conditions.join(' AND ')}`, args: queryParams };
      const total = await this.operations.loadTotalCount({ tableName: TABLE_MCP_SERVERS, whereClause });
      if (total === 0) return { mcpServers: [], total: 0, page, perPage: perPageInput ?? 100, hasMore: false };

      const perPage = normalizePerPage(perPageInput, 100);
      const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
      const limitValue = perPageInput === false ? total : perPage;

      const rows = await this.operations.loadMany<Record<string, unknown>>({
        tableName: TABLE_MCP_SERVERS, whereClause,
        orderBy: `${quoteIdentifier(field, 'column name')} ${direction}`, offset, limit: limitValue,
      });

      return { mcpServers: rows.map(row => this.parseServerRow(row)), total, page, perPage: perPageForResponse, hasMore: perPageInput === false ? false : offset + perPage < total };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError({ id: createStorageErrorId('MYSQL', 'LIST_MCP_SERVERS', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY }, error);
    }
  }

  // ==========================================================================
  // Version Methods
  // ==========================================================================

  async createVersion(input: CreateMCPServerVersionInput): Promise<MCPServerVersion> {
    try {
      const now = new Date();
      await this.operations.insert({
        tableName: TABLE_MCP_SERVER_VERSIONS,
        record: {
          id: input.id, mcpServerId: input.mcpServerId, versionNumber: input.versionNumber,
          name: input.name, version: input.version,
          description: input.description ?? null, instructions: input.instructions ?? null,
          repository: input.repository ?? null, releaseDate: input.releaseDate ?? null,
          isLatest: input.isLatest ?? null, packageCanonical: input.packageCanonical ?? null,
          tools: input.tools ?? null, agents: input.agents ?? null, workflows: input.workflows ?? null,
          changedFields: input.changedFields ?? null, changeMessage: input.changeMessage ?? null, createdAt: now,
        },
      });
      return { ...input, createdAt: now };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError({ id: createStorageErrorId('MYSQL', 'CREATE_MCP_SERVER_VERSION', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY }, error);
    }
  }

  async getVersion(id: string): Promise<MCPServerVersion | null> {
    try {
      const [rows] = await this.pool.execute<RowDataPacket[]>(
        `SELECT * FROM ${formatTableName(TABLE_MCP_SERVER_VERSIONS)} WHERE ${quoteIdentifier('id', 'column name')} = ?`, [id],
      );
      return rows.length ? this.parseVersionRow(rows[0]!) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError({ id: createStorageErrorId('MYSQL', 'GET_MCP_SERVER_VERSION', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY }, error);
    }
  }

  async getVersionByNumber(mcpServerId: string, versionNumber: number): Promise<MCPServerVersion | null> {
    try {
      const rows = await this.operations.loadMany<Record<string, unknown>>({
        tableName: TABLE_MCP_SERVER_VERSIONS,
        whereClause: { sql: ` WHERE ${quoteIdentifier('mcpServerId', 'column name')} = ? AND ${quoteIdentifier('versionNumber', 'column name')} = ?`, args: [mcpServerId, versionNumber] },
        limit: 1,
      });
      return rows.length ? this.parseVersionRow(rows[0]!) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError({ id: createStorageErrorId('MYSQL', 'GET_MCP_SERVER_VERSION_BY_NUMBER', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY }, error);
    }
  }

  async getLatestVersion(mcpServerId: string): Promise<MCPServerVersion | null> {
    try {
      const rows = await this.operations.loadMany<Record<string, unknown>>({
        tableName: TABLE_MCP_SERVER_VERSIONS,
        whereClause: { sql: ` WHERE ${quoteIdentifier('mcpServerId', 'column name')} = ?`, args: [mcpServerId] },
        orderBy: `${quoteIdentifier('versionNumber', 'column name')} DESC`, limit: 1,
      });
      return rows.length ? this.parseVersionRow(rows[0]!) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError({ id: createStorageErrorId('MYSQL', 'GET_LATEST_MCP_SERVER_VERSION', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY }, error);
    }
  }

  async listVersions(input: ListMCPServerVersionsInput): Promise<ListMCPServerVersionsOutput> {
    try {
      const { mcpServerId, page = 0, perPage: perPageInput, orderBy } = input;
      const { field, direction } = this.parseVersionOrderBy(orderBy);
      const whereClause = { sql: ` WHERE ${quoteIdentifier('mcpServerId', 'column name')} = ?`, args: [mcpServerId] };
      const total = await this.operations.loadTotalCount({ tableName: TABLE_MCP_SERVER_VERSIONS, whereClause });
      if (total === 0) return { versions: [], total: 0, page, perPage: perPageInput ?? 20, hasMore: false };

      const perPage = normalizePerPage(perPageInput, 20);
      const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
      const limitValue = perPageInput === false ? total : perPage;

      const rows = await this.operations.loadMany<Record<string, unknown>>({
        tableName: TABLE_MCP_SERVER_VERSIONS, whereClause,
        orderBy: `${quoteIdentifier(field, 'column name')} ${direction}`, offset, limit: limitValue,
      });

      return { versions: rows.map(row => this.parseVersionRow(row)), total, page, perPage: perPageForResponse, hasMore: perPageInput === false ? false : offset + perPage < total };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError({ id: createStorageErrorId('MYSQL', 'LIST_MCP_SERVER_VERSIONS', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY }, error);
    }
  }

  async deleteVersion(id: string): Promise<void> {
    try { await this.operations.delete({ tableName: TABLE_MCP_SERVER_VERSIONS, keys: { id } }); } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError({ id: createStorageErrorId('MYSQL', 'DELETE_MCP_SERVER_VERSION', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY }, error);
    }
  }

  async deleteVersionsByParentId(entityId: string): Promise<void> {
    try {
      await this.pool.execute(`DELETE FROM ${formatTableName(TABLE_MCP_SERVER_VERSIONS)} WHERE ${quoteIdentifier('mcpServerId', 'column name')} = ?`, [entityId]);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError({ id: createStorageErrorId('MYSQL', 'DELETE_MCP_SERVER_VERSIONS_BY_SERVER', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY }, error);
    }
  }

  async countVersions(mcpServerId: string): Promise<number> {
    try {
      return await this.operations.loadTotalCount({
        tableName: TABLE_MCP_SERVER_VERSIONS,
        whereClause: { sql: ` WHERE ${quoteIdentifier('mcpServerId', 'column name')} = ?`, args: [mcpServerId] },
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError({ id: createStorageErrorId('MYSQL', 'COUNT_MCP_SERVER_VERSIONS', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY }, error);
    }
  }
}
