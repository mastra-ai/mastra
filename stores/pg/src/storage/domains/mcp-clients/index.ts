import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  MCPClientsStorage,
  createStorageErrorId,
  normalizePerPage,
  calculatePagination,
  TABLE_MCP_CLIENTS,
  TABLE_MCP_CLIENT_VERSIONS,
  TABLE_SCHEMAS,
} from '@mastra/core/storage';
import type {
  StorageMCPClientType,
  StorageCreateMCPClientInput,
  StorageUpdateMCPClientInput,
  StorageListMCPClientsInput,
  StorageListMCPClientsOutput,
  CreateIndexOptions,
} from '@mastra/core/storage';
import type {
  MCPClientVersion,
  CreateMCPClientVersionInput,
  ListMCPClientVersionsInput,
  ListMCPClientVersionsOutput,
} from '@mastra/core/storage/domains/mcp-clients';
import { PgDB, resolvePgConfig } from '../../db';
import type { PgDomainConfig } from '../../db';
import { getTableName, getSchemaName } from '../utils';

const SNAPSHOT_FIELDS = ['name', 'description', 'servers'] as const;

export class MCPClientsPG extends MCPClientsStorage {
  #db: PgDB;
  #schema: string;
  #skipDefaultIndexes?: boolean;
  #indexes?: CreateIndexOptions[];

  static readonly MANAGED_TABLES = [TABLE_MCP_CLIENTS, TABLE_MCP_CLIENT_VERSIONS] as const;

  constructor(config: PgDomainConfig) {
    super();
    const { client, schemaName, skipDefaultIndexes, indexes } = resolvePgConfig(config);
    this.#db = new PgDB({ client, schemaName, skipDefaultIndexes });
    this.#schema = schemaName || 'public';
    this.#skipDefaultIndexes = skipDefaultIndexes;
    this.#indexes = indexes?.filter(idx => (MCPClientsPG.MANAGED_TABLES as readonly string[]).includes(idx.table));
  }

  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    return [
      {
        name: 'idx_mcp_client_versions_client_version',
        table: TABLE_MCP_CLIENT_VERSIONS,
        columns: ['mcpClientId', 'versionNumber'],
        unique: true,
      },
    ];
  }

  async createDefaultIndexes(): Promise<void> {
    if (this.#skipDefaultIndexes) {
      return;
    }
    for (const indexDef of this.getDefaultIndexDefinitions()) {
      try {
        await this.#db.createIndex(indexDef);
      } catch {
        // Indexes are performance optimizations, continue on failure
      }
    }
  }

  async init(): Promise<void> {
    await this.#db.createTable({
      tableName: TABLE_MCP_CLIENTS,
      schema: TABLE_SCHEMAS[TABLE_MCP_CLIENTS],
    });
    await this.#db.createTable({
      tableName: TABLE_MCP_CLIENT_VERSIONS,
      schema: TABLE_SCHEMAS[TABLE_MCP_CLIENT_VERSIONS],
    });
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  async createCustomIndexes(): Promise<void> {
    if (!this.#indexes || this.#indexes.length === 0) {
      return;
    }
    for (const indexDef of this.#indexes) {
      try {
        await this.#db.createIndex(indexDef);
      } catch (error) {
        this.logger?.warn?.(`Failed to create custom index ${indexDef.name}:`, error);
      }
    }
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.clearTable({ tableName: TABLE_MCP_CLIENT_VERSIONS });
    await this.#db.clearTable({ tableName: TABLE_MCP_CLIENTS });
  }

  // ==========================================================================
  // MCP Client CRUD Methods
  // ==========================================================================

  async getById(id: string): Promise<StorageMCPClientType | null> {
    try {
      const tableName = getTableName({ indexName: TABLE_MCP_CLIENTS, schemaName: getSchemaName(this.#schema) });
      const result = await this.#db.client.oneOrNone(`SELECT * FROM ${tableName} WHERE id = $1`, [id]);

      if (!result) {
        return null;
      }

      return this.parseMCPClientRow(result);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'GET_MCP_CLIENT_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { mcpClientId: id },
        },
        error,
      );
    }
  }

  async create(input: { mcpClient: StorageCreateMCPClientInput }): Promise<StorageMCPClientType> {
    const { mcpClient } = input;
    try {
      const tableName = getTableName({ indexName: TABLE_MCP_CLIENTS, schemaName: getSchemaName(this.#schema) });
      const now = new Date();
      const nowIso = now.toISOString();

      // 1. Create the thin MCP client record
      await this.#db.client.none(
        `INSERT INTO ${tableName} (
          id, status, "activeVersionId", "authorId", metadata,
          "createdAt", "createdAtZ", "updatedAt", "updatedAtZ"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          mcpClient.id,
          'draft',
          null,
          mcpClient.authorId ?? null,
          mcpClient.metadata ? JSON.stringify(mcpClient.metadata) : null,
          nowIso,
          nowIso,
          nowIso,
          nowIso,
        ],
      );

      // 2. Extract snapshot fields and create version 1
      const { id: _id, authorId: _authorId, metadata: _metadata, ...snapshotConfig } = mcpClient;
      const versionId = crypto.randomUUID();
      await this.createVersion({
        id: versionId,
        mcpClientId: mcpClient.id,
        versionNumber: 1,
        ...snapshotConfig,
        changedFields: [...SNAPSHOT_FIELDS],
        changeMessage: 'Initial version',
      });

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
      // Best-effort cleanup
      try {
        const tableName = getTableName({
          indexName: TABLE_MCP_CLIENTS,
          schemaName: getSchemaName(this.#schema),
        });
        await this.#db.client.none(
          `DELETE FROM ${tableName} WHERE id = $1 AND status = 'draft' AND "activeVersionId" IS NULL`,
          [mcpClient.id],
        );
      } catch {
        // Ignore cleanup errors
      }

      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'CREATE_MCP_CLIENT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { mcpClientId: mcpClient.id },
        },
        error,
      );
    }
  }

  async update(input: StorageUpdateMCPClientInput): Promise<StorageMCPClientType> {
    const { id, ...updates } = input;
    try {
      const tableName = getTableName({ indexName: TABLE_MCP_CLIENTS, schemaName: getSchemaName(this.#schema) });

      const existingClient = await this.getById(id);
      if (!existingClient) {
        throw new MastraError({
          id: createStorageErrorId('PG', 'UPDATE_MCP_CLIENT', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: `MCP client ${id} not found`,
          details: { mcpClientId: id },
        });
      }

      const { authorId, activeVersionId, metadata, status } = updates;

      // Update metadata fields on the MCP client record
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
      }

      if (status !== undefined) {
        setClauses.push(`status = $${paramIndex++}`);
        values.push(status);
      }

      if (metadata !== undefined) {
        const mergedMetadata = { ...(existingClient.metadata || {}), ...metadata };
        setClauses.push(`metadata = $${paramIndex++}`);
        values.push(JSON.stringify(mergedMetadata));
      }

      // Always update timestamps
      const now = new Date().toISOString();
      setClauses.push(`"updatedAt" = $${paramIndex++}`);
      values.push(now);
      setClauses.push(`"updatedAtZ" = $${paramIndex++}`);
      values.push(now);

      values.push(id);

      // Always update the record (at minimum updatedAt/updatedAtZ are set)
      await this.#db.client.none(`UPDATE ${tableName} SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`, values);

      const updatedClient = await this.getById(id);
      if (!updatedClient) {
        throw new MastraError({
          id: createStorageErrorId('PG', 'UPDATE_MCP_CLIENT', 'NOT_FOUND_AFTER_UPDATE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.SYSTEM,
          text: `MCP client ${id} not found after update`,
          details: { mcpClientId: id },
        });
      }
      return updatedClient;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'UPDATE_MCP_CLIENT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { mcpClientId: id },
        },
        error,
      );
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const tableName = getTableName({ indexName: TABLE_MCP_CLIENTS, schemaName: getSchemaName(this.#schema) });
      await this.deleteVersionsByParentId(id);
      await this.#db.client.none(`DELETE FROM ${tableName} WHERE id = $1`, [id]);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'DELETE_MCP_CLIENT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { mcpClientId: id },
        },
        error,
      );
    }
  }

  async list(args?: StorageListMCPClientsInput): Promise<StorageListMCPClientsOutput> {
    const { page = 0, perPage: perPageInput, orderBy, authorId, metadata, status = 'published' } = args || {};
    const { field, direction } = this.parseOrderBy(orderBy);

    if (page < 0) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'LIST_MCP_CLIENTS', 'INVALID_PAGE'),
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
      const tableName = getTableName({ indexName: TABLE_MCP_CLIENTS, schemaName: getSchemaName(this.#schema) });

      // Build WHERE conditions
      const conditions: string[] = [];
      const queryParams: any[] = [];
      let paramIdx = 1;

      conditions.push(`status = $${paramIdx++}`);
      queryParams.push(status);

      if (authorId !== undefined) {
        conditions.push(`"authorId" = $${paramIdx++}`);
        queryParams.push(authorId);
      }

      if (metadata && Object.keys(metadata).length > 0) {
        conditions.push(`metadata @> $${paramIdx++}::jsonb`);
        queryParams.push(JSON.stringify(metadata));
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`;

      // Get total count
      const countResult = await this.#db.client.one(
        `SELECT COUNT(*) as count FROM ${tableName} ${whereClause}`,
        queryParams,
      );
      const total = parseInt(countResult.count, 10);

      if (total === 0) {
        return {
          mcpClients: [],
          total: 0,
          page,
          perPage: perPageForResponse,
          hasMore: false,
        };
      }

      const limitValue = perPageInput === false ? total : perPage;
      const dataResult = await this.#db.client.manyOrNone(
        `SELECT * FROM ${tableName} ${whereClause} ORDER BY "${field}" ${direction} LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
        [...queryParams, limitValue, offset],
      );

      const mcpClients = (dataResult || []).map(row => this.parseMCPClientRow(row));

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
          id: createStorageErrorId('PG', 'LIST_MCP_CLIENTS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  // ==========================================================================
  // MCP Client Version Methods
  // ==========================================================================

  async createVersion(input: CreateMCPClientVersionInput): Promise<MCPClientVersion> {
    try {
      const tableName = getTableName({
        indexName: TABLE_MCP_CLIENT_VERSIONS,
        schemaName: getSchemaName(this.#schema),
      });
      const now = new Date();
      const nowIso = now.toISOString();

      await this.#db.client.none(
        `INSERT INTO ${tableName} (
          id, "mcpClientId", "versionNumber",
          name, description, servers,
          "changedFields", "changeMessage",
          "createdAt", "createdAtZ"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          input.id,
          input.mcpClientId,
          input.versionNumber,
          input.name,
          input.description ?? null,
          JSON.stringify(input.servers),
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
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'CREATE_MCP_CLIENT_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { versionId: input.id, mcpClientId: input.mcpClientId },
        },
        error,
      );
    }
  }

  async getVersion(id: string): Promise<MCPClientVersion | null> {
    try {
      const tableName = getTableName({
        indexName: TABLE_MCP_CLIENT_VERSIONS,
        schemaName: getSchemaName(this.#schema),
      });
      const result = await this.#db.client.oneOrNone(`SELECT * FROM ${tableName} WHERE id = $1`, [id]);

      if (!result) {
        return null;
      }

      return this.parseVersionRow(result);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'GET_MCP_CLIENT_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { versionId: id },
        },
        error,
      );
    }
  }

  async getVersionByNumber(mcpClientId: string, versionNumber: number): Promise<MCPClientVersion | null> {
    try {
      const tableName = getTableName({
        indexName: TABLE_MCP_CLIENT_VERSIONS,
        schemaName: getSchemaName(this.#schema),
      });
      const result = await this.#db.client.oneOrNone(
        `SELECT * FROM ${tableName} WHERE "mcpClientId" = $1 AND "versionNumber" = $2`,
        [mcpClientId, versionNumber],
      );

      if (!result) {
        return null;
      }

      return this.parseVersionRow(result);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'GET_MCP_CLIENT_VERSION_BY_NUMBER', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { mcpClientId, versionNumber },
        },
        error,
      );
    }
  }

  async getLatestVersion(mcpClientId: string): Promise<MCPClientVersion | null> {
    try {
      const tableName = getTableName({
        indexName: TABLE_MCP_CLIENT_VERSIONS,
        schemaName: getSchemaName(this.#schema),
      });
      const result = await this.#db.client.oneOrNone(
        `SELECT * FROM ${tableName} WHERE "mcpClientId" = $1 ORDER BY "versionNumber" DESC LIMIT 1`,
        [mcpClientId],
      );

      if (!result) {
        return null;
      }

      return this.parseVersionRow(result);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'GET_LATEST_MCP_CLIENT_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { mcpClientId },
        },
        error,
      );
    }
  }

  async listVersions(input: ListMCPClientVersionsInput): Promise<ListMCPClientVersionsOutput> {
    const { mcpClientId, page = 0, perPage: perPageInput, orderBy } = input;

    if (page < 0) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'LIST_MCP_CLIENT_VERSIONS', 'INVALID_PAGE'),
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
      const tableName = getTableName({
        indexName: TABLE_MCP_CLIENT_VERSIONS,
        schemaName: getSchemaName(this.#schema),
      });

      const countResult = await this.#db.client.one(
        `SELECT COUNT(*) as count FROM ${tableName} WHERE "mcpClientId" = $1`,
        [mcpClientId],
      );
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

      const limitValue = perPageInput === false ? total : perPage;
      const dataResult = await this.#db.client.manyOrNone(
        `SELECT * FROM ${tableName} WHERE "mcpClientId" = $1 ORDER BY "${field}" ${direction} LIMIT $2 OFFSET $3`,
        [mcpClientId, limitValue, offset],
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
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'LIST_MCP_CLIENT_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { mcpClientId },
        },
        error,
      );
    }
  }

  async deleteVersion(id: string): Promise<void> {
    try {
      const tableName = getTableName({
        indexName: TABLE_MCP_CLIENT_VERSIONS,
        schemaName: getSchemaName(this.#schema),
      });
      await this.#db.client.none(`DELETE FROM ${tableName} WHERE id = $1`, [id]);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'DELETE_MCP_CLIENT_VERSION', 'FAILED'),
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
      const tableName = getTableName({
        indexName: TABLE_MCP_CLIENT_VERSIONS,
        schemaName: getSchemaName(this.#schema),
      });
      await this.#db.client.none(`DELETE FROM ${tableName} WHERE "mcpClientId" = $1`, [entityId]);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'DELETE_MCP_CLIENT_VERSIONS_BY_MCP_CLIENT_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { mcpClientId: entityId },
        },
        error,
      );
    }
  }

  async countVersions(mcpClientId: string): Promise<number> {
    try {
      const tableName = getTableName({
        indexName: TABLE_MCP_CLIENT_VERSIONS,
        schemaName: getSchemaName(this.#schema),
      });
      const result = await this.#db.client.one(`SELECT COUNT(*) as count FROM ${tableName} WHERE "mcpClientId" = $1`, [
        mcpClientId,
      ]);
      return parseInt(result.count, 10);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'COUNT_MCP_CLIENT_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { mcpClientId },
        },
        error,
      );
    }
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  private parseJson(value: any, fieldName?: string): any {
    if (!value) return undefined;
    if (typeof value !== 'string') return value;

    try {
      return JSON.parse(value);
    } catch (error) {
      if (error instanceof MastraError) throw error;
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

  private parseMCPClientRow(row: any): StorageMCPClientType {
    return {
      id: row.id as string,
      status: row.status as StorageMCPClientType['status'],
      activeVersionId: row.activeVersionId as string | undefined,
      authorId: row.authorId as string | undefined,
      metadata: this.parseJson(row.metadata, 'metadata'),
      createdAt: new Date(row.createdAtZ || row.createdAt),
      updatedAt: new Date(row.updatedAtZ || row.updatedAt),
    };
  }

  private parseVersionRow(row: any): MCPClientVersion {
    return {
      id: row.id as string,
      mcpClientId: row.mcpClientId as string,
      versionNumber: row.versionNumber as number,
      name: row.name as string,
      description: row.description as string | undefined,
      servers: this.parseJson(row.servers, 'servers'),
      changedFields: this.parseJson(row.changedFields, 'changedFields'),
      changeMessage: row.changeMessage as string | undefined,
      createdAt: new Date(row.createdAtZ || row.createdAt),
    };
  }
}
