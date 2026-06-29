import type { Database } from '@google-cloud/spanner';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  calculatePagination,
  createStorageErrorId,
  MCPClientsStorage,
  MCP_CLIENTS_SCHEMA,
  MCP_CLIENT_VERSIONS_SCHEMA,
  normalizePerPage,
  TABLE_MCP_CLIENTS,
  TABLE_MCP_CLIENT_VERSIONS,
} from '@mastra/core/storage';
import type {
  CreateIndexOptions,
  StorageMCPClientType,
  StorageCreateMCPClientInput,
  StorageListMCPClientsInput,
  StorageListMCPClientsOutput,
  StorageUpdateMCPClientInput,
} from '@mastra/core/storage';
import type {
  CreateMCPClientVersionInput,
  ListMCPClientVersionsInput,
  ListMCPClientVersionsOutput,
  MCPClientVersion,
} from '@mastra/core/storage/domains/mcp-clients';
import { SpannerDB, resolveSpannerConfig } from '../../db';
import type { SpannerDomainConfig } from '../../db';
import { quoteIdent } from '../../db/utils';
import { transformFromSpannerRow } from '../utils';

/**
 * Spanner-backed storage for MCP-client definitions and their immutable versions.
 * Mirrors the thin-record + versions pattern used by agents/skills/prompt-blocks.
 */
export class MCPClientsSpanner extends MCPClientsStorage {
  private database: Database;
  private db: SpannerDB;
  private readonly skipDefaultIndexes?: boolean;
  private readonly indexes?: CreateIndexOptions[];

  static readonly MANAGED_TABLES = [TABLE_MCP_CLIENTS, TABLE_MCP_CLIENT_VERSIONS] as const;

  constructor(config: SpannerDomainConfig) {
    super();
    const { database, indexes, skipDefaultIndexes, initMode, cleanupStaleDraftsOnStartup } =
      resolveSpannerConfig(config);
    this.database = database;
    this.db = new SpannerDB({ database, skipDefaultIndexes, initMode, cleanupStaleDraftsOnStartup });
    this.skipDefaultIndexes = skipDefaultIndexes;
    this.indexes = indexes?.filter(idx => (MCPClientsSpanner.MANAGED_TABLES as readonly string[]).includes(idx.table));
  }

  /** Creates the MCP-client tables, indexes, and (when opted in) sweeps stale drafts. */
  async init(): Promise<void> {
    await this.db.createTable({ tableName: TABLE_MCP_CLIENTS, schema: MCP_CLIENTS_SCHEMA });
    await this.db.createTable({ tableName: TABLE_MCP_CLIENT_VERSIONS, schema: MCP_CLIENT_VERSIONS_SCHEMA });
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
    // Sweep any orphaned drafts left behind by previous partial create() calls.
    await this.cleanupStaleDrafts();
  }

  /**
   * Sweeps orphaned draft thin-rows whose paired version row was never written.
   * Skipped under `initMode: 'validate'` (no destructive DML in validate mode).
   */
  private async cleanupStaleDrafts(): Promise<void> {
    if (this.db.initMode === 'validate') return;
    if (!this.db.cleanupStaleDraftsOnStartup) return;
    try {
      await this.db.runDml({
        sql: `DELETE FROM ${quoteIdent(TABLE_MCP_CLIENTS, 'table name')}
              WHERE ${quoteIdent('status', 'column name')} = 'draft'
                AND ${quoteIdent('activeVersionId', 'column name')} IS NULL
                AND id NOT IN (
                  SELECT ${quoteIdent('mcpClientId', 'column name')}
                  FROM ${quoteIdent(TABLE_MCP_CLIENT_VERSIONS, 'table name')}
                  WHERE ${quoteIdent('mcpClientId', 'column name')} IS NOT NULL
                )`,
      });
    } catch (error) {
      this.logger?.warn?.('Failed to clean up stale draft MCP clients:', error);
    }
  }

  /** Returns the default index set this domain creates during `init()`. */
  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    return [
      {
        name: 'mastra_mcp_clients_status_createdat_idx',
        table: TABLE_MCP_CLIENTS,
        columns: ['status', 'createdAt DESC'],
      },
      {
        name: 'mastra_mcp_clients_authorid_idx',
        table: TABLE_MCP_CLIENTS,
        columns: ['authorId'],
      },
      // Unique index on (mcpClientId, versionNumber) prevents duplicate versions
      // from concurrent createVersion calls.
      {
        name: 'mastra_mcp_client_versions_unique_idx',
        table: TABLE_MCP_CLIENT_VERSIONS,
        columns: ['mcpClientId', 'versionNumber'],
        unique: true,
      },
    ];
  }

  /** Creates the default indexes; no-op when `skipDefaultIndexes` was set. */
  async createDefaultIndexes(): Promise<void> {
    if (this.skipDefaultIndexes) return;
    await this.db.createIndexes(this.getDefaultIndexDefinitions());
  }

  /** Creates custom indexes routed to this domain's tables; no-op when none supplied. */
  async createCustomIndexes(): Promise<void> {
    if (!this.indexes || this.indexes.length === 0) return;
    await this.db.createIndexes(this.indexes);
  }

  /** Removes every row from this domain's tables. Intended for tests. */
  async dangerouslyClearAll(): Promise<void> {
    await this.db.clearTable({ tableName: TABLE_MCP_CLIENT_VERSIONS });
    await this.db.clearTable({ tableName: TABLE_MCP_CLIENTS });
  }

  /** Decodes a raw Spanner thin-row into the public MCP-client shape. */
  private parseClientRow(row: Record<string, any>): StorageMCPClientType {
    const transformed = transformFromSpannerRow<Record<string, any>>({ tableName: TABLE_MCP_CLIENTS, row });
    return {
      id: transformed.id,
      status: transformed.status,
      activeVersionId: transformed.activeVersionId ?? undefined,
      authorId: transformed.authorId ?? undefined,
      metadata: transformed.metadata ?? undefined,
      createdAt: transformed.createdAt,
      updatedAt: transformed.updatedAt,
    };
  }

  /** Decodes a raw Spanner version row into the public version shape. */
  private parseVersionRow(row: Record<string, any>): MCPClientVersion {
    const transformed = transformFromSpannerRow<Record<string, any>>({
      tableName: TABLE_MCP_CLIENT_VERSIONS,
      row,
    });
    return {
      id: transformed.id,
      mcpClientId: transformed.mcpClientId,
      versionNumber: Number(transformed.versionNumber),
      name: transformed.name,
      description: transformed.description ?? undefined,
      servers: transformed.servers ?? {},
      changedFields: transformed.changedFields ?? undefined,
      changeMessage: transformed.changeMessage ?? undefined,
      createdAt: transformed.createdAt,
    };
  }

  /** Fetches the thin MCP-client record by id, or `null` when absent. */
  async getById(id: string): Promise<StorageMCPClientType | null> {
    try {
      const [rows] = await this.database.run({
        sql: `SELECT * FROM ${quoteIdent(TABLE_MCP_CLIENTS, 'table name')} WHERE id = @id LIMIT 1`,
        params: { id },
        json: true,
      });
      const row = (rows as Array<Record<string, any>>)[0];
      return row ? this.parseClientRow(row) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'GET_MCP_CLIENT_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { mcpClientId: id },
        },
        error,
      );
    }
  }

  /** Atomically inserts a draft thin row + version 1 in a single Spanner transaction. */
  async create(input: { mcpClient: StorageCreateMCPClientInput }): Promise<StorageMCPClientType> {
    const { mcpClient } = input;
    try {
      const now = new Date();
      const { id: _id, authorId: _authorId, metadata: _metadata, ...snapshot } = mcpClient;
      const versionId = globalThis.crypto?.randomUUID
        ? globalThis.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      // Wrap the thin-record insert and the seed-version insert in a single
      // Spanner read-write transaction so they commit or roll back together,
      // making orphaned drafts impossible. runWithAbortRetry handles the
      // ABORTED retry loop; the inner block must be idempotent.
      await this.db.runWithAbortRetry(() =>
        this.database.runTransactionAsync(async tx => {
          try {
            await this.db.insert({
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
              transaction: tx,
            });
            await this.db.insert({
              tableName: TABLE_MCP_CLIENT_VERSIONS,
              record: {
                id: versionId,
                mcpClientId: mcpClient.id,
                versionNumber: 1,
                name: (snapshot as any).name,
                description: (snapshot as any).description ?? null,
                servers: (snapshot as any).servers ?? {},
                changedFields: Object.keys(snapshot),
                changeMessage: 'Initial version',
                createdAt: now,
              },
              transaction: tx,
            });
            await tx.commit();
          } catch (err) {
            // The Spanner client does NOT auto-rollback when the runFn throws
            // the transaction (and its row locks) stay pending on the server
            // until explicitly released. Without this rollback, a failed
            // create() blocks subsequent reads/writes against the same rows.
            await tx.rollback().catch(rollbackErr => {
              throw new AggregateError([err, rollbackErr], 'Transaction and rollback both failed');
            });
            throw err;
          }
        }),
      );

      const created = await this.getById(mcpClient.id);
      if (!created) {
        throw new MastraError({
          id: createStorageErrorId('SPANNER', 'CREATE_MCP_CLIENT', 'NOT_FOUND_AFTER_CREATE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.SYSTEM,
          text: `MCP client ${mcpClient.id} not found after creation`,
          details: { mcpClientId: mcpClient.id },
        });
      }
      return created;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'CREATE_MCP_CLIENT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { mcpClientId: mcpClient.id },
        },
        error,
      );
    }
  }

  /** Updates thin-record fields (status, activeVersionId, authorId, metadata). */
  async update(input: StorageUpdateMCPClientInput): Promise<StorageMCPClientType> {
    const { id, ...updates } = input;
    try {
      const existing = await this.getById(id);
      if (!existing) {
        throw new MastraError({
          id: createStorageErrorId('SPANNER', 'UPDATE_MCP_CLIENT', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: `MCP client ${id} not found`,
          details: { mcpClientId: id },
        });
      }

      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (updates.authorId !== undefined) updateData.authorId = updates.authorId;
      if (updates.activeVersionId !== undefined) updateData.activeVersionId = updates.activeVersionId;
      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.metadata !== undefined) updateData.metadata = updates.metadata ?? null;

      await this.db.update({ tableName: TABLE_MCP_CLIENTS, keys: { id }, data: updateData });

      const updated = await this.getById(id);
      if (!updated) {
        throw new MastraError({
          id: createStorageErrorId('SPANNER', 'UPDATE_MCP_CLIENT', 'NOT_FOUND_AFTER_UPDATE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.SYSTEM,
          text: `MCP client ${id} not found after update`,
          details: { mcpClientId: id },
        });
      }
      return updated;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'UPDATE_MCP_CLIENT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { mcpClientId: id },
        },
        error,
      );
    }
  }

  /** Removes an MCP client and all its versions atomically in a single transaction. */
  async delete(id: string): Promise<void> {
    try {
      await this.db.runWithAbortRetry(() =>
        this.database.runTransactionAsync(async tx => {
          try {
            await tx.runUpdate({
              sql: `DELETE FROM ${quoteIdent(TABLE_MCP_CLIENT_VERSIONS, 'table name')} WHERE ${quoteIdent('mcpClientId', 'column name')} = @mcpClientId`,
              params: { mcpClientId: id },
            });
            await tx.runUpdate({
              sql: `DELETE FROM ${quoteIdent(TABLE_MCP_CLIENTS, 'table name')} WHERE id = @id`,
              params: { id },
            });
            await tx.commit();
          } catch (err) {
            await tx.rollback().catch(rollbackErr => {
              throw new AggregateError([err, rollbackErr], 'Transaction and rollback both failed');
            });
            throw err;
          }
        }),
      );
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'DELETE_MCP_CLIENT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { mcpClientId: id },
        },
        error,
      );
    }
  }

  /** Paginated listing; defaults to `status='published'` so drafts never leak. */
  async list(args?: StorageListMCPClientsInput): Promise<StorageListMCPClientsOutput> {
    // Default to status='published' so list() never leaks drafts to callers
    // that omit the filter.
    const { page = 0, perPage: perPageInput, orderBy, authorId, metadata, status = 'published' } = args || {};
    const { field, direction } = this.parseOrderBy(orderBy);

    if (page < 0) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'LIST_MCP_CLIENTS', 'INVALID_PAGE'),
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
      const tableName = quoteIdent(TABLE_MCP_CLIENTS, 'table name');
      const conditions: string[] = [];
      const params: Record<string, any> = {};

      if (status) {
        conditions.push(`${quoteIdent('status', 'column name')} = @status`);
        params.status = status;
      }
      if (authorId !== undefined) {
        conditions.push(`${quoteIdent('authorId', 'column name')} = @authorId`);
        params.authorId = authorId;
      }
      if (metadata && Object.keys(metadata).length > 0) {
        let i = 0;
        for (const [key, value] of Object.entries(metadata)) {
          if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
            throw new MastraError({
              id: createStorageErrorId('SPANNER', 'LIST_MCP_CLIENTS', 'INVALID_METADATA_KEY'),
              domain: ErrorDomain.STORAGE,
              category: ErrorCategory.USER,
              text: `Invalid metadata key: ${key}. Keys must be alphanumeric with underscores.`,
              details: { key },
            });
          }
          const param = `m${i++}`;
          conditions.push(`JSON_VALUE(metadata, '$.${key}') = @${param}`);
          params[param] = typeof value === 'string' ? value : JSON.stringify(value);
        }
      }

      const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const [countRows] = await this.database.run({
        sql: `SELECT COUNT(*) AS count FROM ${tableName} ${whereSql}`,
        params,
        json: true,
      });
      const total = Number((countRows as Array<{ count: number | string }>)[0]?.count ?? 0);
      if (total === 0) {
        return { mcpClients: [], total: 0, page, perPage: perPageForResponse, hasMore: false };
      }

      const limit = perPageInput === false ? total : perPage;
      const dirSql = (direction || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      const [rows] = await this.database.run({
        sql: `SELECT * FROM ${tableName} ${whereSql}
              ORDER BY ${quoteIdent(field, 'column name')} ${dirSql}, id ${dirSql}
              LIMIT @limit OFFSET @offset`,
        params: { ...params, limit, offset },
        json: true,
      });
      const mcpClients = (rows as Array<Record<string, any>>).map(r => this.parseClientRow(r));
      return {
        mcpClients,
        total,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : offset + perPage < total,
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'LIST_MCP_CLIENTS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  /** Inserts a new immutable version row for an existing MCP client. */
  async createVersion(input: CreateMCPClientVersionInput): Promise<MCPClientVersion> {
    try {
      const now = new Date();
      await this.db.insert({
        tableName: TABLE_MCP_CLIENT_VERSIONS,
        record: {
          id: input.id,
          mcpClientId: input.mcpClientId,
          versionNumber: input.versionNumber,
          name: input.name,
          description: input.description ?? null,
          servers: input.servers ?? {},
          changedFields: input.changedFields ?? null,
          changeMessage: input.changeMessage ?? null,
          createdAt: now,
        },
      });
      return { ...input, createdAt: now } as MCPClientVersion;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'CREATE_MCP_CLIENT_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { versionId: input.id, mcpClientId: input.mcpClientId },
        },
        error,
      );
    }
  }

  /** Fetches a version row by its id, or `null` when absent. */
  async getVersion(id: string): Promise<MCPClientVersion | null> {
    try {
      const [rows] = await this.database.run({
        sql: `SELECT * FROM ${quoteIdent(TABLE_MCP_CLIENT_VERSIONS, 'table name')} WHERE id = @id LIMIT 1`,
        params: { id },
        json: true,
      });
      const row = (rows as Array<Record<string, any>>)[0];
      return row ? this.parseVersionRow(row) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'GET_MCP_CLIENT_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { versionId: id },
        },
        error,
      );
    }
  }

  /** Fetches a specific version by `(mcpClientId, versionNumber)`. */
  async getVersionByNumber(mcpClientId: string, versionNumber: number): Promise<MCPClientVersion | null> {
    try {
      const [rows] = await this.database.run({
        sql: `SELECT * FROM ${quoteIdent(TABLE_MCP_CLIENT_VERSIONS, 'table name')}
              WHERE ${quoteIdent('mcpClientId', 'column name')} = @mcpClientId
                AND ${quoteIdent('versionNumber', 'column name')} = @versionNumber
              LIMIT 1`,
        params: { mcpClientId, versionNumber },
        json: true,
      });
      const row = (rows as Array<Record<string, any>>)[0];
      return row ? this.parseVersionRow(row) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'GET_MCP_CLIENT_VERSION_BY_NUMBER', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { mcpClientId, versionNumber },
        },
        error,
      );
    }
  }

  /** Returns the highest-numbered version for an MCP client. */
  async getLatestVersion(mcpClientId: string): Promise<MCPClientVersion | null> {
    try {
      const [rows] = await this.database.run({
        sql: `SELECT * FROM ${quoteIdent(TABLE_MCP_CLIENT_VERSIONS, 'table name')}
              WHERE ${quoteIdent('mcpClientId', 'column name')} = @mcpClientId
              ORDER BY ${quoteIdent('versionNumber', 'column name')} DESC
              LIMIT 1`,
        params: { mcpClientId },
        json: true,
      });
      const row = (rows as Array<Record<string, any>>)[0];
      return row ? this.parseVersionRow(row) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'GET_MCP_CLIENT_LATEST_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { mcpClientId },
        },
        error,
      );
    }
  }

  /** Paginated listing of versions for a single MCP client. */
  async listVersions(input: ListMCPClientVersionsInput): Promise<ListMCPClientVersionsOutput> {
    const { mcpClientId, page = 0, perPage: perPageInput, orderBy } = input;
    if (page < 0) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'LIST_MCP_CLIENT_VERSIONS', 'INVALID_PAGE'),
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
      const dirSql = direction === 'ASC' ? 'ASC' : 'DESC';
      const tableName = quoteIdent(TABLE_MCP_CLIENT_VERSIONS, 'table name');

      const [countRows] = await this.database.run({
        sql: `SELECT COUNT(*) AS count FROM ${tableName} WHERE ${quoteIdent('mcpClientId', 'column name')} = @mcpClientId`,
        params: { mcpClientId },
        json: true,
      });
      const total = Number((countRows as Array<{ count: number | string }>)[0]?.count ?? 0);
      if (total === 0) {
        return { versions: [], total: 0, page, perPage: perPageForResponse, hasMore: false };
      }

      const limit = perPageInput === false ? total : perPage;
      const [rows] = await this.database.run({
        sql: `SELECT * FROM ${tableName}
              WHERE ${quoteIdent('mcpClientId', 'column name')} = @mcpClientId
              ORDER BY ${quoteIdent(field, 'column name')} ${dirSql}, id ${dirSql}
              LIMIT @limit OFFSET @offset`,
        params: { mcpClientId, limit, offset },
        json: true,
      });
      const versions = (rows as Array<Record<string, any>>).map(r => this.parseVersionRow(r));
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
          id: createStorageErrorId('SPANNER', 'LIST_MCP_CLIENT_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { mcpClientId },
        },
        error,
      );
    }
  }

  /** Deletes a single version row by id. */
  async deleteVersion(id: string): Promise<void> {
    try {
      await this.db.runDml({
        sql: `DELETE FROM ${quoteIdent(TABLE_MCP_CLIENT_VERSIONS, 'table name')} WHERE id = @id`,
        params: { id },
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'DELETE_MCP_CLIENT_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { versionId: id },
        },
        error,
      );
    }
  }

  /** Deletes every version row belonging to the given MCP client. */
  async deleteVersionsByParentId(entityId: string): Promise<void> {
    try {
      await this.db.runDml({
        sql: `DELETE FROM ${quoteIdent(TABLE_MCP_CLIENT_VERSIONS, 'table name')} WHERE ${quoteIdent('mcpClientId', 'column name')} = @mcpClientId`,
        params: { mcpClientId: entityId },
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'DELETE_MCP_CLIENT_VERSIONS_BY_PARENT_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { mcpClientId: entityId },
        },
        error,
      );
    }
  }

  /** Returns the total number of version rows for the given MCP client. */
  async countVersions(mcpClientId: string): Promise<number> {
    try {
      const [rows] = await this.database.run({
        sql: `SELECT COUNT(*) AS count FROM ${quoteIdent(TABLE_MCP_CLIENT_VERSIONS, 'table name')} WHERE ${quoteIdent('mcpClientId', 'column name')} = @mcpClientId`,
        params: { mcpClientId },
        json: true,
      });
      return Number((rows as Array<{ count: number | string }>)[0]?.count ?? 0);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'COUNT_MCP_CLIENT_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { mcpClientId },
        },
        error,
      );
    }
  }
}
