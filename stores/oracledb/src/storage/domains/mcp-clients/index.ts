import { ErrorCategory, MastraError } from '@mastra/core/error';
import {
  calculatePagination,
  MCPClientsStorage,
  normalizePerPage,
  TABLE_MCP_CLIENTS,
  TABLE_MCP_CLIENT_VERSIONS,
  TABLE_SCHEMAS,
} from '@mastra/core/storage';
import type {
  StorageCreateMCPClientInput,
  StorageListMCPClientsInput,
  StorageListMCPClientsOutput,
  StorageMCPClientType,
  StorageUpdateMCPClientInput,
} from '@mastra/core/storage';
import type {
  CreateMCPClientVersionInput,
  ListMCPClientVersionsInput,
  ListMCPClientVersionsOutput,
  MCPClientVersion,
} from '@mastra/core/storage/domains/mcp-clients';

import { jsonBind, nullableJsonBind, safeJsonValue } from '../../../shared/connection';
import { assertJsonPath, indexNameForTable, qualifyName } from '../../../vector/identifiers';
import { OracleDB, createOracleIndex, filterIndexesForTables, parseOracleJson } from '../../db';
import type { OracleCreateIndexOptions, OracleTxClient } from '../../db';
import {
  createOracleStorageError,
  parseOptionalJsonObject,
  parseOptionalStringArray,
  toDate,
} from '../../domain-utils';
import type { OracleDomainConfig } from '../../types';

// MCP clients use the same registry/version pattern as agents: parent rows handle discovery while version rows snapshot server bindings.
const STORE_NAME = 'ORACLEDB';
const SNAPSHOT_FIELDS = ['name', 'description', 'servers'] as const;

const CLIENT_ACTIVE_VERSION_ID = '"activeVersionId"';
const CLIENT_AUTHOR_ID = '"authorId"';
const CLIENT_CREATED_AT = '"createdAt"';
const CLIENT_UPDATED_AT = '"updatedAt"';
const VERSION_MCP_CLIENT_ID = '"mcpClientId"';
const VERSION_VERSION_NUMBER = '"versionNumber"';
const VERSION_CHANGED_FIELDS = '"changedFields"';
const VERSION_CHANGE_MESSAGE = '"changeMessage"';
const VERSION_CREATED_AT = '"createdAt"';

type MCPClientRow = {
  id: string;
  status: StorageMCPClientType['status'];
  activeVersionId?: string | null;
  authorId?: string | null;
  metadata?: unknown;
  createdAt: Date | string;
  updatedAt: Date | string;
};

type MCPClientVersionRow = {
  id: string;
  mcpClientId: string;
  versionNumber: number | string;
  name: string;
  description?: string | null;
  servers: unknown;
  changedFields?: unknown;
  changeMessage?: string | null;
  createdAt: Date | string;
};

type VersionWriteClient = Pick<OracleTxClient, 'none'>;

export class MCPClientsOracle extends MCPClientsStorage {
  // MCP clients follow the registry pattern: parent lifecycle row plus versioned server config snapshots.
  static readonly MANAGED_TABLES = [TABLE_MCP_CLIENTS, TABLE_MCP_CLIENT_VERSIONS] as const;

  private readonly db: OracleDB;
  private readonly schemaName?: string;
  private readonly skipDefaultIndexes?: boolean;
  private readonly indexes: OracleCreateIndexOptions[];

  constructor(config: OracleDomainConfig) {
    super();
    this.db = new OracleDB(config);
    this.schemaName = config.schemaName;
    this.skipDefaultIndexes = config.skipDefaultIndexes;
    this.indexes = filterIndexesForTables(config.indexes, MCPClientsOracle.MANAGED_TABLES);
  }

  async init(): Promise<void> {
    await this.db.createTable({
      tableName: TABLE_MCP_CLIENTS,
      schema: TABLE_SCHEMAS[TABLE_MCP_CLIENTS],
    });
    await this.db.createTable({
      tableName: TABLE_MCP_CLIENT_VERSIONS,
      schema: TABLE_SCHEMAS[TABLE_MCP_CLIENT_VERSIONS],
    });
    await this.createIndexes();
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.db.tx(async client => {
      await client.none(`DELETE FROM ${this.table(TABLE_MCP_CLIENT_VERSIONS)}`);
      await client.none(`DELETE FROM ${this.table(TABLE_MCP_CLIENTS)}`);
    });
  }

  getDefaultIndexDefinitions(): OracleCreateIndexOptions[] {
    return getDefaultMCPClientIndexDefinitions(this.indexName.bind(this));
  }

  async getById(id: string): Promise<StorageMCPClientType | null> {
    try {
      const row = await this.db.oneOrNone<MCPClientRow>(
        `${this.clientSelect()} FROM ${this.table(TABLE_MCP_CLIENTS)} WHERE id = :id`,
        { id },
      );
      return row ? this.parseMCPClientRow(row) : null;
    } catch (error) {
      throw this.storageError('GET_MCP_CLIENT_BY_ID', 'FAILED', { mcpClientId: id }, error);
    }
  }

  async create(input: { mcpClient: StorageCreateMCPClientInput }): Promise<StorageMCPClientType> {
    const { mcpClient } = input;

    try {
      const now = new Date();

      await this.db.tx(async client => {
        const existing = await client.oneOrNone<{ id: string }>(
          `SELECT id AS "id" FROM ${this.table(TABLE_MCP_CLIENTS)} WHERE id = :id`,
          { id: mcpClient.id },
        );
        if (existing) {
          throw new Error(`MCP client with id ${mcpClient.id} already exists`);
        }

        await client.none(
          `INSERT INTO ${this.table(TABLE_MCP_CLIENTS)} (
            id, status, ${CLIENT_ACTIVE_VERSION_ID}, ${CLIENT_AUTHOR_ID}, metadata,
            ${CLIENT_CREATED_AT}, ${CLIENT_UPDATED_AT}
          ) VALUES (
            :id, :status, :activeVersionId, :authorId, :metadata,
            :createdAt, :updatedAt
          )`,
          {
            id: mcpClient.id,
            status: 'draft',
            activeVersionId: null,
            authorId: mcpClient.authorId ?? null,
            metadata: nullableJsonBind(mcpClient.metadata),
            createdAt: now,
            updatedAt: now,
          },
        );

        // Store the editable server map in the version row so historical client configs remain inspectable.
        const { id: _id, authorId: _authorId, metadata: _metadata, ...snapshotConfig } = mcpClient;
        await this.insertVersion(client, {
          id: crypto.randomUUID(),
          mcpClientId: mcpClient.id,
          versionNumber: 1,
          ...snapshotConfig,
          changedFields: [...SNAPSHOT_FIELDS],
          changeMessage: 'Initial version',
        });
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
      if (error instanceof MastraError) throw error;
      throw this.storageError('CREATE_MCP_CLIENT', 'FAILED', { mcpClientId: mcpClient.id }, error);
    }
  }

  async update(input: StorageUpdateMCPClientInput): Promise<StorageMCPClientType> {
    const { id, ...updates } = input;

    try {
      const existingClient = await this.getById(id);
      if (!existingClient) {
        throw new Error(`MCP client with id ${id} not found`);
      }

      const { authorId, activeVersionId, metadata, status } = updates;
      const setClauses: string[] = [];
      const binds: Record<string, unknown> = { id };

      if (authorId !== undefined) {
        setClauses.push(`${CLIENT_AUTHOR_ID} = :authorId`);
        binds.authorId = authorId;
      }

      if (activeVersionId !== undefined) {
        setClauses.push(`${CLIENT_ACTIVE_VERSION_ID} = :activeVersionId`);
        binds.activeVersionId = activeVersionId;
      }

      if (status !== undefined) {
        setClauses.push(`status = :status`);
        binds.status = status;
      }

      if (metadata !== undefined) {
        const mergedMetadata = { ...(existingClient.metadata ?? {}), ...metadata };
        // Client discovery metadata is mutable on the parent row; server
        // connection maps are kept in explicit version rows.
        setClauses.push(`metadata = :metadata`);
        binds.metadata = jsonBind(mergedMetadata);
      }

      setClauses.push(`${CLIENT_UPDATED_AT} = :updatedAt`);
      binds.updatedAt = new Date();

      await this.db.none(
        `UPDATE ${this.table(TABLE_MCP_CLIENTS)} SET ${setClauses.join(', ')} WHERE id = :id`,
        binds,
      );

      const updatedClient = await this.getById(id);
      if (!updatedClient) {
        throw new Error(`MCP client with id ${id} not found after update`);
      }
      return updatedClient;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw this.storageError('UPDATE_MCP_CLIENT', 'FAILED', { mcpClientId: id }, error);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.db.tx(async client => {
        await client.none(`DELETE FROM ${this.table(TABLE_MCP_CLIENT_VERSIONS)} WHERE ${VERSION_MCP_CLIENT_ID} = :id`, {
          id,
        });
        await client.none(`DELETE FROM ${this.table(TABLE_MCP_CLIENTS)} WHERE id = :id`, { id });
      });
    } catch (error) {
      throw this.storageError('DELETE_MCP_CLIENT', 'FAILED', { mcpClientId: id }, error);
    }
  }

  async list(args?: StorageListMCPClientsInput): Promise<StorageListMCPClientsOutput> {
    const { page = 0, perPage: perPageInput, orderBy, authorId, metadata, status = 'published' } = args || {};

    try {
      this.validatePagination(page, perPageInput, 100);
    } catch (error) {
      throw this.storageError('LIST_MCP_CLIENTS', 'INVALID_INPUT', { page }, error, ErrorCategory.USER);
    }

    const perPage = normalizePerPage(perPageInput, 100);
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    try {
      const { field, direction } = this.parseOrderBy(orderBy);
      const { whereClause, binds } = this.clientWhereClause({ status, authorId, metadata });

      const countRow = await this.db.oneOrNone<{ count: number | string }>(
        `SELECT COUNT(*) AS "count" FROM ${this.table(TABLE_MCP_CLIENTS)} ${whereClause}`,
        binds,
      );
      const total = Number(countRow?.count ?? 0);

      if (total === 0) {
        return {
          mcpClients: [],
          total: 0,
          page,
          perPage: perPageForResponse,
          hasMore: false,
        };
      }

      if (perPage === 0) {
        return {
          mcpClients: [],
          total,
          page,
          perPage: perPageForResponse,
          hasMore: total > 0,
        };
      }

      const limit = perPageInput === false ? total : perPage;
      // `id ASC` breaks ties between rows sharing the same order-by value so
      // pages stay stable instead of duplicating or dropping rows across pages.
      const rows = await this.db.manyOrNone<MCPClientRow>(
        `${this.clientSelect()} FROM ${this.table(TABLE_MCP_CLIENTS)} ${whereClause} ORDER BY ${this.clientOrderColumn(
          field,
        )} ${direction}, id ASC OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
        { ...binds, offset, limit },
      );

      return {
        mcpClients: rows.map(row => this.parseMCPClientRow(row)),
        total,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : offset + perPage < total,
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw this.storageError('LIST_MCP_CLIENTS', 'FAILED', {}, error);
    }
  }

  async createVersion(input: CreateMCPClientVersionInput): Promise<MCPClientVersion> {
    try {
      const existingById = await this.db.oneOrNone<{ id: string }>(
        `SELECT id AS "id" FROM ${this.table(TABLE_MCP_CLIENT_VERSIONS)} WHERE id = :id`,
        { id: input.id },
      );
      if (existingById) {
        throw new Error(`Version with id ${input.id} already exists`);
      }

      const existingByNumber = await this.db.oneOrNone<{ id: string }>(
        `SELECT id AS "id" FROM ${this.table(
          TABLE_MCP_CLIENT_VERSIONS,
        )} WHERE ${VERSION_MCP_CLIENT_ID} = :mcpClientId AND ${VERSION_VERSION_NUMBER} = :versionNumber`,
        { mcpClientId: input.mcpClientId, versionNumber: input.versionNumber },
      );
      if (existingByNumber) {
        throw new Error(`Version number ${input.versionNumber} already exists for MCP client ${input.mcpClientId}`);
      }

      const createdAt = new Date();
      await this.insertVersion(this.db, input, createdAt);

      return {
        ...input,
        createdAt,
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw this.storageError(
        'CREATE_MCP_CLIENT_VERSION',
        'FAILED',
        { versionId: input.id, mcpClientId: input.mcpClientId },
        error,
      );
    }
  }

  async getVersion(id: string): Promise<MCPClientVersion | null> {
    try {
      const row = await this.db.oneOrNone<MCPClientVersionRow>(
        `${this.versionSelect()} FROM ${this.table(TABLE_MCP_CLIENT_VERSIONS)} WHERE id = :id`,
        { id },
      );
      return row ? this.parseVersionRow(row) : null;
    } catch (error) {
      throw this.storageError('GET_MCP_CLIENT_VERSION', 'FAILED', { versionId: id }, error);
    }
  }

  async getVersionByNumber(mcpClientId: string, versionNumber: number): Promise<MCPClientVersion | null> {
    try {
      const row = await this.db.oneOrNone<MCPClientVersionRow>(
        `${this.versionSelect()} FROM ${this.table(
          TABLE_MCP_CLIENT_VERSIONS,
        )} WHERE ${VERSION_MCP_CLIENT_ID} = :mcpClientId AND ${VERSION_VERSION_NUMBER} = :versionNumber`,
        { mcpClientId, versionNumber },
      );
      return row ? this.parseVersionRow(row) : null;
    } catch (error) {
      throw this.storageError(
        'GET_MCP_CLIENT_VERSION_BY_NUMBER',
        'FAILED',
        { mcpClientId, versionNumber },
        error,
      );
    }
  }

  async getLatestVersion(mcpClientId: string): Promise<MCPClientVersion | null> {
    try {
      const row = await this.db.oneOrNone<MCPClientVersionRow>(
        `${this.versionSelect()} FROM ${this.table(
          TABLE_MCP_CLIENT_VERSIONS,
        )} WHERE ${VERSION_MCP_CLIENT_ID} = :mcpClientId ORDER BY ${VERSION_VERSION_NUMBER} DESC FETCH FIRST 1 ROWS ONLY`,
        { mcpClientId },
      );
      return row ? this.parseVersionRow(row) : null;
    } catch (error) {
      throw this.storageError('GET_LATEST_MCP_CLIENT_VERSION', 'FAILED', { mcpClientId }, error);
    }
  }

  async listVersions(input: ListMCPClientVersionsInput): Promise<ListMCPClientVersionsOutput> {
    const { mcpClientId, page = 0, perPage: perPageInput, orderBy } = input;

    try {
      this.validatePagination(page, perPageInput, 20);
    } catch (error) {
      throw this.storageError('LIST_MCP_CLIENT_VERSIONS', 'INVALID_INPUT', { page, mcpClientId }, error, ErrorCategory.USER);
    }

    const perPage = normalizePerPage(perPageInput, 20);
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    try {
      const { field, direction } = this.parseVersionOrderBy(orderBy);
      const countRow = await this.db.oneOrNone<{ count: number | string }>(
        `SELECT COUNT(*) AS "count" FROM ${this.table(TABLE_MCP_CLIENT_VERSIONS)} WHERE ${VERSION_MCP_CLIENT_ID} = :mcpClientId`,
        { mcpClientId },
      );
      const total = Number(countRow?.count ?? 0);

      if (total === 0) {
        return {
          versions: [],
          total: 0,
          page,
          perPage: perPageForResponse,
          hasMore: false,
        };
      }

      if (perPage === 0) {
        return {
          versions: [],
          total,
          page,
          perPage: perPageForResponse,
          hasMore: total > 0,
        };
      }

      const limit = perPageInput === false ? total : perPage;
      // `id ASC` breaks ties between versions sharing the same order-by value so
      // pages stay stable instead of duplicating or dropping rows across pages.
      const rows = await this.db.manyOrNone<MCPClientVersionRow>(
        `${this.versionSelect()} FROM ${this.table(
          TABLE_MCP_CLIENT_VERSIONS,
        )} WHERE ${VERSION_MCP_CLIENT_ID} = :mcpClientId ORDER BY ${this.versionOrderColumn(
          field,
        )} ${direction}, id ASC OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`,
        { mcpClientId, offset, limit },
      );

      return {
        versions: rows.map(row => this.parseVersionRow(row)),
        total,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : offset + perPage < total,
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw this.storageError('LIST_MCP_CLIENT_VERSIONS', 'FAILED', { mcpClientId }, error);
    }
  }

  async deleteVersion(id: string): Promise<void> {
    try {
      await this.db.none(`DELETE FROM ${this.table(TABLE_MCP_CLIENT_VERSIONS)} WHERE id = :id`, { id });
    } catch (error) {
      throw this.storageError('DELETE_MCP_CLIENT_VERSION', 'FAILED', { versionId: id }, error);
    }
  }

  async deleteVersionsByParentId(entityId: string): Promise<void> {
    try {
      await this.db.none(`DELETE FROM ${this.table(TABLE_MCP_CLIENT_VERSIONS)} WHERE ${VERSION_MCP_CLIENT_ID} = :entityId`, {
        entityId,
      });
    } catch (error) {
      throw this.storageError('DELETE_MCP_CLIENT_VERSIONS_BY_MCP_CLIENT_ID', 'FAILED', { mcpClientId: entityId }, error);
    }
  }

  async countVersions(mcpClientId: string): Promise<number> {
    try {
      const row = await this.db.oneOrNone<{ count: number | string }>(
        `SELECT COUNT(*) AS "count" FROM ${this.table(TABLE_MCP_CLIENT_VERSIONS)} WHERE ${VERSION_MCP_CLIENT_ID} = :mcpClientId`,
        { mcpClientId },
      );
      return Number(row?.count ?? 0);
    } catch (error) {
      throw this.storageError('COUNT_MCP_CLIENT_VERSIONS', 'FAILED', { mcpClientId }, error);
    }
  }

  private async createIndexes(): Promise<void> {
    await this.db.withConnection(async connection => {
      if (!this.skipDefaultIndexes) {
        for (const index of this.getDefaultIndexDefinitions()) {
          try {
            await createOracleIndex(connection, index, this.schemaName);
          } catch (error) {
            this.logger?.warn?.(`Failed to create Oracle default index ${index.name}:`, error);
          }
        }
      }

      for (const index of this.indexes) {
        try {
          await createOracleIndex(connection, index, this.schemaName);
        } catch (error) {
          this.logger?.warn?.(`Failed to create Oracle custom index ${index.name}:`, error);
        }
      }
    });
  }

  private async insertVersion(
    client: VersionWriteClient,
    input: CreateMCPClientVersionInput,
    createdAt = new Date(),
  ): Promise<void> {
    // The server map is the important reproducible client config, so it is
    // stored as Oracle JSON on each version row.
    await client.none(
      `INSERT INTO ${this.table(TABLE_MCP_CLIENT_VERSIONS)} (
        id, ${VERSION_MCP_CLIENT_ID}, ${VERSION_VERSION_NUMBER},
        name, description, servers,
        ${VERSION_CHANGED_FIELDS}, ${VERSION_CHANGE_MESSAGE},
        ${VERSION_CREATED_AT}
      ) VALUES (
        :id, :mcpClientId, :versionNumber,
        :name, :description, :servers,
        :changedFields, :changeMessage,
        :createdAt
      )`,
      {
        id: input.id,
        mcpClientId: input.mcpClientId,
        versionNumber: input.versionNumber,
        name: input.name,
        description: input.description ?? null,
        servers: jsonBind(input.servers),
        changedFields: nullableJsonBind(input.changedFields),
        changeMessage: input.changeMessage ?? null,
        createdAt,
      },
    );
  }

  private clientWhereClause(args: {
    status: StorageMCPClientType['status'];
    authorId?: string;
    metadata?: Record<string, unknown>;
  }): { whereClause: string; binds: Record<string, unknown> } {
    const conditions = ['status = :status'];
    const binds: Record<string, unknown> = { status: args.status };

    if (args.authorId !== undefined) {
      conditions.push(`${CLIENT_AUTHOR_ID} = :authorId`);
      binds.authorId = args.authorId;
    }

    if (args.metadata && Object.keys(args.metadata).length > 0) {
      let index = 0;
      for (const [key, value] of Object.entries(args.metadata)) {
        const bindName = `metadata${index++}`;
        // Scalar metadata filters use JSON_VALUE so provider listings stay
        // indexable without loading every client row.
        conditions.push(`${jsonValue('metadata', key, value)} = :${bindName}`);
        binds[bindName] = jsonComparableValue(value);
      }
    }

    return { whereClause: `WHERE ${conditions.join(' AND ')}`, binds };
  }

  private clientSelect(): string {
    return [
      `SELECT id AS "id"`,
      `status AS "status"`,
      `${CLIENT_ACTIVE_VERSION_ID} AS "activeVersionId"`,
      `${CLIENT_AUTHOR_ID} AS "authorId"`,
      `metadata AS "metadata"`,
      `${CLIENT_CREATED_AT} AS "createdAt"`,
      `${CLIENT_UPDATED_AT} AS "updatedAt"`,
    ].join(', ');
  }

  private versionSelect(): string {
    return [
      `SELECT id AS "id"`,
      `${VERSION_MCP_CLIENT_ID} AS "mcpClientId"`,
      `${VERSION_VERSION_NUMBER} AS "versionNumber"`,
      `name AS "name"`,
      `description AS "description"`,
      `servers AS "servers"`,
      `${VERSION_CHANGED_FIELDS} AS "changedFields"`,
      `${VERSION_CHANGE_MESSAGE} AS "changeMessage"`,
      `${VERSION_CREATED_AT} AS "createdAt"`,
    ].join(', ');
  }

  private parseMCPClientRow(row: MCPClientRow): StorageMCPClientType {
    return {
      id: String(row.id),
      status: row.status,
      activeVersionId: optionalString(row.activeVersionId),
      authorId: optionalString(row.authorId),
      metadata: parseOptionalJsonObject(row.metadata),
      createdAt: toDate(row.createdAt),
      updatedAt: toDate(row.updatedAt),
    };
  }

  private parseVersionRow(row: MCPClientVersionRow): MCPClientVersion {
    // Normalize the JSON server map before returning it to Mastra core.
    return {
      id: String(row.id),
      mcpClientId: String(row.mcpClientId),
      versionNumber: Number(row.versionNumber),
      name: String(row.name),
      description: optionalString(row.description),
      servers: parseOracleJson(row.servers) as MCPClientVersion['servers'],
      changedFields: parseOptionalStringArray(row.changedFields),
      changeMessage: optionalString(row.changeMessage),
      createdAt: toDate(row.createdAt),
    };
  }

  private clientOrderColumn(field: string): string {
    return field === 'updatedAt' ? CLIENT_UPDATED_AT : CLIENT_CREATED_AT;
  }

  private versionOrderColumn(field: string): string {
    return field === 'createdAt' ? VERSION_CREATED_AT : VERSION_VERSION_NUMBER;
  }

  private validatePagination(page: number, perPageInput: number | false | undefined, defaultPerPage: number): void {
    if (page < 0) {
      throw new Error('page must be >= 0');
    }

    const perPage = normalizePerPage(perPageInput, defaultPerPage);
    const maxOffset = Number.MAX_SAFE_INTEGER / 2;
    if (perPageInput !== false && page * perPage > maxOffset) {
      throw new Error('page value too large');
    }
  }

  private table(tableName: string): string {
    return qualifyName(tableName, this.schemaName);
  }

  private indexName(indexName: string): string {
    return indexNameForTable(indexName, 'IDX');
  }

  private storageError(
    operation: string,
    reason: string,
    details: Record<string, string | number | boolean | undefined>,
    cause: unknown,
    category: ErrorCategory = ErrorCategory.THIRD_PARTY,
  ): MastraError {
    return createOracleStorageError({ storeName: STORE_NAME, operation, reason, details, cause, category });
  }
}

export function getDefaultMCPClientIndexDefinitions(indexName: (name: string) => string): OracleCreateIndexOptions[] {
  return [
    {
      name: indexName('MASTRA_MCP_CLIENT_VERSIONS_CLIENT_VERSION'),
      table: TABLE_MCP_CLIENT_VERSIONS,
      columns: ['mcpClientId', 'versionNumber'],
      unique: true,
    },
  ];
}

function optionalString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  return String(value);
}

function jsonValue(column: string, path: string, comparisonValue: unknown): string {
  const jsonPath = assertJsonPath(path);
  if (typeof comparisonValue === 'number') {
    return `JSON_VALUE(${column}, '${jsonPath}' RETURNING NUMBER NULL ON ERROR)`;
  }
  return `JSON_VALUE(${column}, '${jsonPath}' RETURNING VARCHAR2(4000) NULL ON ERROR)`;
}

function jsonComparableValue(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'boolean') return String(value);
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(safeJsonValue(value));
  return value;
}
