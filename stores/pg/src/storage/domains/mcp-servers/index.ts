import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  MCPServersStorage,
  createStorageErrorId,
  normalizePerPage,
  calculatePagination,
  TABLE_MCP_SERVERS,
  TABLE_MCP_SERVER_VERSIONS,
  TABLE_SCHEMAS,
} from '@mastra/core/storage';
import type {
  StorageMCPServerType,
  StorageCreateMCPServerInput,
  StorageUpdateMCPServerInput,
  StorageListMCPServersInput,
  StorageListMCPServersOutput,
  CreateIndexOptions,
} from '@mastra/core/storage';
import type {
  MCPServerVersion,
  CreateMCPServerVersionInput,
  ListMCPServerVersionsInput,
  ListMCPServerVersionsOutput,
} from '@mastra/core/storage/domains/mcp-servers';
import { PgDB, resolvePgConfig } from '../../db';
import type { PgDomainConfig } from '../../db';
import { getTableName, getSchemaName } from '../utils';

const SNAPSHOT_FIELDS = [
  'name',
  'version',
  'description',
  'instructions',
  'repository',
  'releaseDate',
  'isLatest',
  'packageCanonical',
  'tools',
  'agents',
  'workflows',
] as const;

export class MCPServersPG extends MCPServersStorage {
  #db: PgDB;
  #schema: string;
  #skipDefaultIndexes?: boolean;
  #indexes?: CreateIndexOptions[];

  static readonly MANAGED_TABLES = [TABLE_MCP_SERVERS, TABLE_MCP_SERVER_VERSIONS] as const;

  constructor(config: PgDomainConfig) {
    super();
    const { client, schemaName, skipDefaultIndexes, indexes } = resolvePgConfig(config);
    this.#db = new PgDB({ client, schemaName, skipDefaultIndexes });
    this.#schema = schemaName || 'public';
    this.#skipDefaultIndexes = skipDefaultIndexes;
    this.#indexes = indexes?.filter(idx => (MCPServersPG.MANAGED_TABLES as readonly string[]).includes(idx.table));
  }

  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    return [
      {
        name: 'idx_mcp_server_versions_server_version',
        table: TABLE_MCP_SERVER_VERSIONS,
        columns: ['mcpServerId', 'versionNumber'],
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
      tableName: TABLE_MCP_SERVERS,
      schema: TABLE_SCHEMAS[TABLE_MCP_SERVERS],
    });
    await this.#db.createTable({
      tableName: TABLE_MCP_SERVER_VERSIONS,
      schema: TABLE_SCHEMAS[TABLE_MCP_SERVER_VERSIONS],
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
    await this.#db.clearTable({ tableName: TABLE_MCP_SERVER_VERSIONS });
    await this.#db.clearTable({ tableName: TABLE_MCP_SERVERS });
  }

  // ==========================================================================
  // MCP Server CRUD Methods
  // ==========================================================================

  async getById(id: string): Promise<StorageMCPServerType | null> {
    try {
      const tableName = getTableName({ indexName: TABLE_MCP_SERVERS, schemaName: getSchemaName(this.#schema) });
      const result = await this.#db.client.oneOrNone(`SELECT * FROM ${tableName} WHERE id = $1`, [id]);

      if (!result) {
        return null;
      }

      return this.parseMCPServerRow(result);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'GET_MCP_SERVER_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { mcpServerId: id },
        },
        error,
      );
    }
  }

  async create(input: { mcpServer: StorageCreateMCPServerInput }): Promise<StorageMCPServerType> {
    const { mcpServer } = input;
    try {
      const tableName = getTableName({ indexName: TABLE_MCP_SERVERS, schemaName: getSchemaName(this.#schema) });
      const now = new Date();
      const nowIso = now.toISOString();

      // 1. Create the thin MCP server record
      await this.#db.client.none(
        `INSERT INTO ${tableName} (
          id, status, "activeVersionId", "authorId", metadata,
          "createdAt", "createdAtZ", "updatedAt", "updatedAtZ"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          mcpServer.id,
          'draft',
          null,
          mcpServer.authorId ?? null,
          mcpServer.metadata ? JSON.stringify(mcpServer.metadata) : null,
          nowIso,
          nowIso,
          nowIso,
          nowIso,
        ],
      );

      // 2. Extract snapshot fields and create version 1
      const { id: _id, authorId: _authorId, metadata: _metadata, ...snapshotConfig } = mcpServer;
      const versionId = crypto.randomUUID();
      await this.createVersion({
        id: versionId,
        mcpServerId: mcpServer.id,
        versionNumber: 1,
        ...snapshotConfig,
        changedFields: [...SNAPSHOT_FIELDS],
        changeMessage: 'Initial version',
      });

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
      // Best-effort cleanup
      try {
        const tableName = getTableName({
          indexName: TABLE_MCP_SERVERS,
          schemaName: getSchemaName(this.#schema),
        });
        await this.#db.client.none(
          `DELETE FROM ${tableName} WHERE id = $1 AND status = 'draft' AND "activeVersionId" IS NULL`,
          [mcpServer.id],
        );
      } catch {
        // Ignore cleanup errors
      }

      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'CREATE_MCP_SERVER', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { mcpServerId: mcpServer.id },
        },
        error,
      );
    }
  }

  async update(input: StorageUpdateMCPServerInput): Promise<StorageMCPServerType> {
    const { id, ...updates } = input;
    try {
      const tableName = getTableName({ indexName: TABLE_MCP_SERVERS, schemaName: getSchemaName(this.#schema) });

      const existingServer = await this.getById(id);
      if (!existingServer) {
        throw new MastraError({
          id: createStorageErrorId('PG', 'UPDATE_MCP_SERVER', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: `MCP server ${id} not found`,
          details: { mcpServerId: id },
        });
      }

      const { authorId, activeVersionId, metadata, status } = updates;

      // Update metadata fields on the MCP server record
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
        const mergedMetadata = { ...(existingServer.metadata || {}), ...metadata };
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

      const updatedServer = await this.getById(id);
      if (!updatedServer) {
        throw new MastraError({
          id: createStorageErrorId('PG', 'UPDATE_MCP_SERVER', 'NOT_FOUND_AFTER_UPDATE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.SYSTEM,
          text: `MCP server ${id} not found after update`,
          details: { mcpServerId: id },
        });
      }
      return updatedServer;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'UPDATE_MCP_SERVER', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { mcpServerId: id },
        },
        error,
      );
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const tableName = getTableName({ indexName: TABLE_MCP_SERVERS, schemaName: getSchemaName(this.#schema) });
      await this.deleteVersionsByParentId(id);
      await this.#db.client.none(`DELETE FROM ${tableName} WHERE id = $1`, [id]);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'DELETE_MCP_SERVER', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { mcpServerId: id },
        },
        error,
      );
    }
  }

  async list(args?: StorageListMCPServersInput): Promise<StorageListMCPServersOutput> {
    const { page = 0, perPage: perPageInput, orderBy, authorId, metadata, status = 'published' } = args || {};
    const { field, direction } = this.parseOrderBy(orderBy);

    if (page < 0) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'LIST_MCP_SERVERS', 'INVALID_PAGE'),
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
      const tableName = getTableName({ indexName: TABLE_MCP_SERVERS, schemaName: getSchemaName(this.#schema) });

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
          mcpServers: [],
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

      const mcpServers = (dataResult || []).map(row => this.parseMCPServerRow(row));

      return {
        mcpServers,
        total,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : offset + perPage < total,
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'LIST_MCP_SERVERS', 'FAILED'),
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
      const tableName = getTableName({
        indexName: TABLE_MCP_SERVER_VERSIONS,
        schemaName: getSchemaName(this.#schema),
      });
      const now = new Date();
      const nowIso = now.toISOString();

      await this.#db.client.none(
        `INSERT INTO ${tableName} (
          id, "mcpServerId", "versionNumber",
          name, version, description, instructions,
          repository, "releaseDate", "isLatest", "packageCanonical",
          tools, agents, workflows,
          "changedFields", "changeMessage",
          "createdAt", "createdAtZ"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
        [
          input.id,
          input.mcpServerId,
          input.versionNumber,
          input.name,
          input.version,
          input.description ?? null,
          input.instructions ?? null,
          input.repository ? JSON.stringify(input.repository) : null,
          input.releaseDate ?? null,
          input.isLatest ?? null,
          input.packageCanonical ?? null,
          input.tools ? JSON.stringify(input.tools) : null,
          input.agents ? JSON.stringify(input.agents) : null,
          input.workflows ? JSON.stringify(input.workflows) : null,
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
          id: createStorageErrorId('PG', 'CREATE_MCP_SERVER_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { versionId: input.id, mcpServerId: input.mcpServerId },
        },
        error,
      );
    }
  }

  async getVersion(id: string): Promise<MCPServerVersion | null> {
    try {
      const tableName = getTableName({
        indexName: TABLE_MCP_SERVER_VERSIONS,
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
          id: createStorageErrorId('PG', 'GET_MCP_SERVER_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { versionId: id },
        },
        error,
      );
    }
  }

  async getVersionByNumber(mcpServerId: string, versionNumber: number): Promise<MCPServerVersion | null> {
    try {
      const tableName = getTableName({
        indexName: TABLE_MCP_SERVER_VERSIONS,
        schemaName: getSchemaName(this.#schema),
      });
      const result = await this.#db.client.oneOrNone(
        `SELECT * FROM ${tableName} WHERE "mcpServerId" = $1 AND "versionNumber" = $2`,
        [mcpServerId, versionNumber],
      );

      if (!result) {
        return null;
      }

      return this.parseVersionRow(result);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'GET_MCP_SERVER_VERSION_BY_NUMBER', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { mcpServerId, versionNumber },
        },
        error,
      );
    }
  }

  async getLatestVersion(mcpServerId: string): Promise<MCPServerVersion | null> {
    try {
      const tableName = getTableName({
        indexName: TABLE_MCP_SERVER_VERSIONS,
        schemaName: getSchemaName(this.#schema),
      });
      const result = await this.#db.client.oneOrNone(
        `SELECT * FROM ${tableName} WHERE "mcpServerId" = $1 ORDER BY "versionNumber" DESC LIMIT 1`,
        [mcpServerId],
      );

      if (!result) {
        return null;
      }

      return this.parseVersionRow(result);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'GET_LATEST_MCP_SERVER_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { mcpServerId },
        },
        error,
      );
    }
  }

  async listVersions(input: ListMCPServerVersionsInput): Promise<ListMCPServerVersionsOutput> {
    const { mcpServerId, page = 0, perPage: perPageInput, orderBy } = input;

    if (page < 0) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'LIST_MCP_SERVER_VERSIONS', 'INVALID_PAGE'),
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
        indexName: TABLE_MCP_SERVER_VERSIONS,
        schemaName: getSchemaName(this.#schema),
      });

      const countResult = await this.#db.client.one(
        `SELECT COUNT(*) as count FROM ${tableName} WHERE "mcpServerId" = $1`,
        [mcpServerId],
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
        `SELECT * FROM ${tableName} WHERE "mcpServerId" = $1 ORDER BY "${field}" ${direction} LIMIT $2 OFFSET $3`,
        [mcpServerId, limitValue, offset],
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
          id: createStorageErrorId('PG', 'LIST_MCP_SERVER_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { mcpServerId },
        },
        error,
      );
    }
  }

  async deleteVersion(id: string): Promise<void> {
    try {
      const tableName = getTableName({
        indexName: TABLE_MCP_SERVER_VERSIONS,
        schemaName: getSchemaName(this.#schema),
      });
      await this.#db.client.none(`DELETE FROM ${tableName} WHERE id = $1`, [id]);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'DELETE_MCP_SERVER_VERSION', 'FAILED'),
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
        indexName: TABLE_MCP_SERVER_VERSIONS,
        schemaName: getSchemaName(this.#schema),
      });
      await this.#db.client.none(`DELETE FROM ${tableName} WHERE "mcpServerId" = $1`, [entityId]);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'DELETE_MCP_SERVER_VERSIONS_BY_MCP_SERVER_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { mcpServerId: entityId },
        },
        error,
      );
    }
  }

  async countVersions(mcpServerId: string): Promise<number> {
    try {
      const tableName = getTableName({
        indexName: TABLE_MCP_SERVER_VERSIONS,
        schemaName: getSchemaName(this.#schema),
      });
      const result = await this.#db.client.one(`SELECT COUNT(*) as count FROM ${tableName} WHERE "mcpServerId" = $1`, [
        mcpServerId,
      ]);
      return parseInt(result.count, 10);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'COUNT_MCP_SERVER_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { mcpServerId },
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
        valueLength: String(value.length),
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

  private parseMCPServerRow(row: any): StorageMCPServerType {
    return {
      id: row.id as string,
      status: row.status as StorageMCPServerType['status'],
      activeVersionId: row.activeVersionId as string | undefined,
      authorId: row.authorId as string | undefined,
      metadata: this.parseJson(row.metadata, 'metadata'),
      createdAt: new Date(row.createdAtZ || row.createdAt),
      updatedAt: new Date(row.updatedAtZ || row.updatedAt),
    };
  }

  private parseVersionRow(row: any): MCPServerVersion {
    return {
      id: row.id as string,
      mcpServerId: row.mcpServerId as string,
      versionNumber: row.versionNumber as number,
      name: row.name as string,
      version: row.version as string,
      description: row.description as string | undefined,
      instructions: row.instructions as string | undefined,
      repository: this.parseJson(row.repository, 'repository'),
      releaseDate: row.releaseDate as string | undefined,
      isLatest: row.isLatest as boolean | undefined,
      packageCanonical: row.packageCanonical as string | undefined,
      tools: this.parseJson(row.tools, 'tools'),
      agents: this.parseJson(row.agents, 'agents'),
      workflows: this.parseJson(row.workflows, 'workflows'),
      changedFields: this.parseJson(row.changedFields, 'changedFields'),
      changeMessage: row.changeMessage as string | undefined,
      createdAt: new Date(row.createdAtZ || row.createdAt),
    };
  }
}
