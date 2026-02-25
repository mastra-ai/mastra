import type { Client, InValue } from '@libsql/client';
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
import { LibSQLDB, resolveClient } from '../../db';
import type { LibSQLDomainConfig } from '../../db';
import { buildSelectColumns } from '../../db/utils';

export class MCPServersLibSQL extends MCPServersStorage {
  #db: LibSQLDB;
  #client: Client;

  constructor(config: LibSQLDomainConfig) {
    super();
    const client = resolveClient(config);
    this.#client = client;
    this.#db = new LibSQLDB({ client, maxRetries: config.maxRetries, initialBackoffMs: config.initialBackoffMs });
  }

  async init(): Promise<void> {
    await this.#db.createTable({ tableName: TABLE_MCP_SERVERS, schema: MCP_SERVERS_SCHEMA });
    await this.#db.createTable({
      tableName: TABLE_MCP_SERVER_VERSIONS,
      schema: MCP_SERVER_VERSIONS_SCHEMA,
    });

    // Unique constraint on (mcpServerId, versionNumber) to prevent duplicate versions from concurrent updates
    await this.#client.execute(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_mcp_server_versions_server_version ON "${TABLE_MCP_SERVER_VERSIONS}" ("mcpServerId", "versionNumber")`,
    );
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.deleteData({ tableName: TABLE_MCP_SERVERS });
    await this.#db.deleteData({ tableName: TABLE_MCP_SERVER_VERSIONS });
  }

  // ==========================================================================
  // MCP Server CRUD
  // ==========================================================================

  async getById(id: string): Promise<StorageMCPServerType | null> {
    try {
      const result = await this.#client.execute({
        sql: `SELECT ${buildSelectColumns(TABLE_MCP_SERVERS)} FROM "${TABLE_MCP_SERVERS}" WHERE id = ?`,
        args: [id],
      });
      const row = result.rows?.[0];
      return row ? this.#parseMCPServerRow(row) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_MCP_SERVER', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async create(input: { mcpServer: StorageCreateMCPServerInput }): Promise<StorageMCPServerType> {
    const { mcpServer } = input;
    try {
      const now = new Date();

      // Insert thin MCP server record
      await this.#db.insert({
        tableName: TABLE_MCP_SERVERS,
        record: {
          id: mcpServer.id,
          status: 'draft',
          activeVersionId: null,
          authorId: mcpServer.authorId ?? null,
          metadata: mcpServer.metadata ?? null,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
      });

      // Extract config fields for version 1
      const { id: _id, authorId: _authorId, metadata: _metadata, ...snapshotConfig } = mcpServer;
      const versionId = crypto.randomUUID();
      try {
        await this.createVersion({
          id: versionId,
          mcpServerId: mcpServer.id,
          versionNumber: 1,
          ...snapshotConfig,
          changedFields: Object.keys(snapshotConfig),
          changeMessage: 'Initial version',
        });
      } catch (versionError) {
        // Clean up the orphaned server record
        await this.#db.delete({ tableName: TABLE_MCP_SERVERS, keys: { id: mcpServer.id } });
        throw versionError;
      }

      return {
        id: mcpServer.id,
        status: 'draft',
        activeVersionId: undefined,
        authorId: mcpServer.authorId,
        metadata: mcpServer.metadata,
        createdAt: now,
        updatedAt: now,
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'CREATE_MCP_SERVER', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async update(input: StorageUpdateMCPServerInput): Promise<StorageMCPServerType> {
    const { id, ...updates } = input;
    try {
      const existing = await this.getById(id);
      if (!existing) {
        throw new Error(`MCP server with id ${id} not found`);
      }

      const { authorId, activeVersionId, metadata, status } = updates;

      // Build update data for the MCP server record
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
        tableName: TABLE_MCP_SERVERS,
        keys: { id },
        data: updateData,
      });

      // Fetch and return updated MCP server
      const updated = await this.getById(id);
      if (!updated) {
        throw new MastraError({
          id: createStorageErrorId('LIBSQL', 'UPDATE_MCP_SERVER', 'NOT_FOUND_AFTER_UPDATE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.SYSTEM,
          text: `MCP server ${id} not found after update`,
          details: { id },
        });
      }
      return updated;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'UPDATE_MCP_SERVER', 'FAILED'),
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
      await this.#client.execute({
        sql: `DELETE FROM "${TABLE_MCP_SERVERS}" WHERE "id" = ?`,
        args: [id],
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'DELETE_MCP_SERVER', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async list(args?: StorageListMCPServersInput): Promise<StorageListMCPServersOutput> {
    try {
      const { page = 0, perPage: perPageInput, orderBy, authorId, metadata, status } = args || {};
      const { field, direction } = this.parseOrderBy(orderBy);

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
          // Sanitize key to prevent SQL injection via json_extract path
          if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
            throw new MastraError({
              id: createStorageErrorId('LIBSQL', 'LIST_MCP_SERVERS', 'INVALID_METADATA_KEY'),
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
        sql: `SELECT COUNT(*) as count FROM "${TABLE_MCP_SERVERS}" ${whereClause}`,
        args: queryParams,
      });
      const total = Number(countResult.rows?.[0]?.count ?? 0);

      if (total === 0) {
        return {
          mcpServers: [],
          total: 0,
          page,
          perPage: perPageInput ?? 100,
          hasMore: false,
        };
      }

      const perPage = normalizePerPage(perPageInput, 100);
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
      const limitValue = perPageInput === false ? total : perPage;
      const end = perPageInput === false ? total : start + perPage;

      const result = await this.#client.execute({
        sql: `SELECT ${buildSelectColumns(TABLE_MCP_SERVERS)} FROM "${TABLE_MCP_SERVERS}" ${whereClause} ORDER BY ${field} ${direction} LIMIT ? OFFSET ?`,
        args: [...queryParams, limitValue, start],
      });

      const mcpServers = result.rows?.map(row => this.#parseMCPServerRow(row)) ?? [];

      return {
        mcpServers,
        total,
        page,
        perPage: perPageForResponse,
        hasMore: end < total,
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'LIST_MCP_SERVERS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  // ==========================================================================
  // MCP Server Version Methods
  // ==========================================================================

  async createVersion(input: CreateMCPServerVersionInput): Promise<MCPServerVersion> {
    try {
      const now = new Date();
      await this.#db.insert({
        tableName: TABLE_MCP_SERVER_VERSIONS,
        record: {
          id: input.id,
          mcpServerId: input.mcpServerId,
          versionNumber: input.versionNumber,
          name: input.name,
          version: input.version,
          description: input.description ?? null,
          instructions: input.instructions ?? null,
          repository: input.repository ?? null,
          releaseDate: input.releaseDate ?? null,
          isLatest: input.isLatest ?? null,
          packageCanonical: input.packageCanonical ?? null,
          tools: input.tools ?? null,
          agents: input.agents ?? null,
          workflows: input.workflows ?? null,
          changedFields: input.changedFields ?? null,
          changeMessage: input.changeMessage ?? null,
          createdAt: now.toISOString(),
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
          id: createStorageErrorId('LIBSQL', 'CREATE_MCP_SERVER_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getVersion(id: string): Promise<MCPServerVersion | null> {
    try {
      const result = await this.#client.execute({
        sql: `SELECT ${buildSelectColumns(TABLE_MCP_SERVER_VERSIONS)} FROM "${TABLE_MCP_SERVER_VERSIONS}" WHERE id = ?`,
        args: [id],
      });
      const row = result.rows?.[0];
      return row ? this.#parseVersionRow(row) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_MCP_SERVER_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getVersionByNumber(mcpServerId: string, versionNumber: number): Promise<MCPServerVersion | null> {
    try {
      const result = await this.#client.execute({
        sql: `SELECT ${buildSelectColumns(TABLE_MCP_SERVER_VERSIONS)} FROM "${TABLE_MCP_SERVER_VERSIONS}" WHERE mcpServerId = ? AND versionNumber = ?`,
        args: [mcpServerId, versionNumber],
      });
      const row = result.rows?.[0];
      return row ? this.#parseVersionRow(row) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_MCP_SERVER_VERSION_BY_NUMBER', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getLatestVersion(mcpServerId: string): Promise<MCPServerVersion | null> {
    try {
      const result = await this.#client.execute({
        sql: `SELECT ${buildSelectColumns(TABLE_MCP_SERVER_VERSIONS)} FROM "${TABLE_MCP_SERVER_VERSIONS}" WHERE mcpServerId = ? ORDER BY versionNumber DESC LIMIT 1`,
        args: [mcpServerId],
      });
      const row = result.rows?.[0];
      return row ? this.#parseVersionRow(row) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_LATEST_MCP_SERVER_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async listVersions(input: ListMCPServerVersionsInput): Promise<ListMCPServerVersionsOutput> {
    try {
      const { mcpServerId, page = 0, perPage: perPageInput, orderBy } = input;
      const { field, direction } = this.parseVersionOrderBy(orderBy);

      // Get total count
      const countResult = await this.#client.execute({
        sql: `SELECT COUNT(*) as count FROM "${TABLE_MCP_SERVER_VERSIONS}" WHERE mcpServerId = ?`,
        args: [mcpServerId],
      });
      const total = Number(countResult.rows?.[0]?.count ?? 0);

      if (total === 0) {
        return {
          versions: [],
          total: 0,
          page,
          perPage: perPageInput ?? 20,
          hasMore: false,
        };
      }

      const perPage = normalizePerPage(perPageInput, 20);
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
      const limitValue = perPageInput === false ? total : perPage;
      const end = perPageInput === false ? total : start + perPage;

      const result = await this.#client.execute({
        sql: `SELECT ${buildSelectColumns(TABLE_MCP_SERVER_VERSIONS)} FROM "${TABLE_MCP_SERVER_VERSIONS}" WHERE mcpServerId = ? ORDER BY ${field} ${direction} LIMIT ? OFFSET ?`,
        args: [mcpServerId, limitValue, start],
      });

      const versions = result.rows?.map(row => this.#parseVersionRow(row)) ?? [];

      return {
        versions,
        total,
        page,
        perPage: perPageForResponse,
        hasMore: end < total,
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'LIST_MCP_SERVER_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async deleteVersion(id: string): Promise<void> {
    try {
      await this.#client.execute({
        sql: `DELETE FROM "${TABLE_MCP_SERVER_VERSIONS}" WHERE "id" = ?`,
        args: [id],
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'DELETE_MCP_SERVER_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async deleteVersionsByParentId(entityId: string): Promise<void> {
    try {
      await this.#client.execute({
        sql: `DELETE FROM "${TABLE_MCP_SERVER_VERSIONS}" WHERE "mcpServerId" = ?`,
        args: [entityId],
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'DELETE_MCP_SERVER_VERSIONS_BY_SERVER', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async countVersions(mcpServerId: string): Promise<number> {
    try {
      const result = await this.#client.execute({
        sql: `SELECT COUNT(*) as count FROM "${TABLE_MCP_SERVER_VERSIONS}" WHERE mcpServerId = ?`,
        args: [mcpServerId],
      });
      return Number(result.rows?.[0]?.count ?? 0);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'COUNT_MCP_SERVER_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  #safeParseJSON(val: unknown): unknown {
    if (val === null || val === undefined) return undefined;
    if (typeof val === 'string') {
      try {
        return JSON.parse(val);
      } catch {
        return val;
      }
    }
    return val;
  }

  #parseMCPServerRow(row: Record<string, unknown>): StorageMCPServerType {
    return {
      id: row.id as string,
      status: (row.status as StorageMCPServerType['status']) ?? 'draft',
      activeVersionId: (row.activeVersionId as string) ?? undefined,
      authorId: (row.authorId as string) ?? undefined,
      metadata: this.#safeParseJSON(row.metadata) as Record<string, unknown> | undefined,
      createdAt: new Date(row.createdAt as string),
      updatedAt: new Date(row.updatedAt as string),
    };
  }

  #parseVersionRow(row: Record<string, unknown>): MCPServerVersion {
    return {
      id: row.id as string,
      mcpServerId: row.mcpServerId as string,
      versionNumber: Number(row.versionNumber),
      name: row.name as string,
      version: row.version as string,
      description: (row.description as string) ?? undefined,
      instructions: (row.instructions as string) ?? undefined,
      repository: this.#safeParseJSON(row.repository) as MCPServerVersion['repository'],
      releaseDate: (row.releaseDate as string) ?? undefined,
      isLatest: row.isLatest === null || row.isLatest === undefined ? undefined : Boolean(row.isLatest),
      packageCanonical: (row.packageCanonical as string) ?? undefined,
      tools: this.#safeParseJSON(row.tools) as MCPServerVersion['tools'],
      agents: this.#safeParseJSON(row.agents) as MCPServerVersion['agents'],
      workflows: this.#safeParseJSON(row.workflows) as MCPServerVersion['workflows'],
      changedFields: this.#safeParseJSON(row.changedFields) as string[] | undefined,
      changeMessage: (row.changeMessage as string) ?? undefined,
      createdAt: new Date(row.createdAt as string),
    };
  }
}
