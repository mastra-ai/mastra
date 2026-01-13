import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  AgentVersionsStorage,
  createStorageErrorId,
  normalizePerPage,
  calculatePagination,
  TABLE_AGENT_VERSIONS,
  TABLE_SCHEMAS,
} from '@mastra/core/storage';
import type {
  AgentVersion,
  CreateVersionInput,
  ListVersionsInput,
  ListVersionsOutput,
  CreateIndexOptions,
} from '@mastra/core/storage';
import { PgDB, resolvePgConfig } from '../../db';
import type { PgDomainConfig } from '../../db';
import { getTableName, getSchemaName } from '../utils';

export class AgentVersionsPG extends AgentVersionsStorage {
  #db: PgDB;
  #schema: string;
  #skipDefaultIndexes?: boolean;
  #indexes?: CreateIndexOptions[];

  /** Tables managed by this domain */
  static readonly MANAGED_TABLES = [TABLE_AGENT_VERSIONS] as const;

  constructor(config: PgDomainConfig) {
    super();
    const { client, schemaName, skipDefaultIndexes, indexes } = resolvePgConfig(config);
    this.#db = new PgDB({ client, schemaName, skipDefaultIndexes });
    this.#schema = schemaName || 'public';
    this.#skipDefaultIndexes = skipDefaultIndexes;
    // Filter indexes to only those for tables managed by this domain
    this.#indexes = indexes?.filter(idx => (AgentVersionsPG.MANAGED_TABLES as readonly string[]).includes(idx.table));
  }

  /**
   * Returns default index definitions for the agent versions domain tables.
   */
  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    return [
      {
        name: 'idx_agent_versions_agent_id',
        table: TABLE_AGENT_VERSIONS,
        columns: ['agentId'],
      },
      {
        name: 'idx_agent_versions_agent_version',
        table: TABLE_AGENT_VERSIONS,
        columns: ['agentId', 'versionNumber'],
        unique: true,
      },
    ];
  }

  /**
   * Creates default indexes for optimal query performance.
   */
  async createDefaultIndexes(): Promise<void> {
    if (this.#skipDefaultIndexes) {
      return;
    }

    const defaultIndexes = this.getDefaultIndexDefinitions();
    for (const indexDef of defaultIndexes) {
      try {
        await this.#db.createIndex(indexDef);
      } catch (error) {
        // Log but continue - indexes are performance optimizations
        this.logger?.warn?.(`Failed to create default index ${indexDef.name}:`, error);
      }
    }
  }

  async init(): Promise<void> {
    await this.#db.createTable({ tableName: TABLE_AGENT_VERSIONS, schema: TABLE_SCHEMAS[TABLE_AGENT_VERSIONS] });
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  /**
   * Creates custom user-defined indexes for this domain's tables.
   */
  async createCustomIndexes(): Promise<void> {
    if (!this.#indexes || this.#indexes.length === 0) {
      return;
    }

    for (const indexDef of this.#indexes) {
      try {
        await this.#db.createIndex(indexDef);
      } catch (error) {
        // Log but continue - indexes are performance optimizations
        this.logger?.warn?.(`Failed to create custom index ${indexDef.name}:`, error);
      }
    }
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.clearTable({ tableName: TABLE_AGENT_VERSIONS });
  }

  private parseJson(value: unknown, fieldName?: string): unknown {
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

  private parseRow(row: Record<string, unknown>): AgentVersion {
    return {
      id: row.id as string,
      agentId: row.agentId as string,
      versionNumber: row.versionNumber as number,
      name: (row.name as string) || undefined,
      snapshot: this.parseJson(row.snapshot, 'snapshot') as AgentVersion['snapshot'],
      changedFields: row.changedFields ? (this.parseJson(row.changedFields, 'changedFields') as string[]) : undefined,
      changeMessage: (row.changeMessage as string) || undefined,
      createdAt: (row.createdAtZ as Date) || (row.createdAt as Date),
    };
  }

  async createVersion(input: CreateVersionInput): Promise<AgentVersion> {
    try {
      const tableName = getTableName({ indexName: TABLE_AGENT_VERSIONS, schemaName: getSchemaName(this.#schema) });
      const now = new Date();
      const nowIso = now.toISOString();

      await this.#db.client.none(
        `INSERT INTO ${tableName} (
          id, "agentId", "versionNumber", name, snapshot, "changedFields", "changeMessage",
          "createdAt", "createdAtZ"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          input.id,
          input.agentId,
          input.versionNumber,
          input.name ?? null,
          JSON.stringify(input.snapshot),
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
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'CREATE_AGENT_VERSION', 'FAILED'),
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
      const tableName = getTableName({ indexName: TABLE_AGENT_VERSIONS, schemaName: getSchemaName(this.#schema) });

      const result = await this.#db.client.oneOrNone(`SELECT * FROM ${tableName} WHERE id = $1`, [id]);

      if (!result) {
        return null;
      }

      return this.parseRow(result);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'GET_AGENT_VERSION', 'FAILED'),
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
      const tableName = getTableName({ indexName: TABLE_AGENT_VERSIONS, schemaName: getSchemaName(this.#schema) });

      const result = await this.#db.client.oneOrNone(
        `SELECT * FROM ${tableName} WHERE "agentId" = $1 AND "versionNumber" = $2`,
        [agentId, versionNumber],
      );

      if (!result) {
        return null;
      }

      return this.parseRow(result);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'GET_AGENT_VERSION_BY_NUMBER', 'FAILED'),
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
      const tableName = getTableName({ indexName: TABLE_AGENT_VERSIONS, schemaName: getSchemaName(this.#schema) });

      const result = await this.#db.client.oneOrNone(
        `SELECT * FROM ${tableName} WHERE "agentId" = $1 ORDER BY "versionNumber" DESC LIMIT 1`,
        [agentId],
      );

      if (!result) {
        return null;
      }

      return this.parseRow(result);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'GET_LATEST_AGENT_VERSION', 'FAILED'),
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
    const { field, direction } = this.parseOrderBy(orderBy);

    if (page < 0) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'LIST_AGENT_VERSIONS', 'INVALID_PAGE'),
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
      const tableName = getTableName({ indexName: TABLE_AGENT_VERSIONS, schemaName: getSchemaName(this.#schema) });

      // Get total count
      const countResult = await this.#db.client.one(`SELECT COUNT(*) as count FROM ${tableName} WHERE "agentId" = $1`, [
        agentId,
      ]);
      const total = parseInt(countResult.count, 10);

      if (total === 0) {
        return {
          versions: [],
          total: 0,
          page,
          perPage: perPageForResponse === false ? 0 : perPageForResponse,
          hasMore: false,
        };
      }

      // Get paginated results
      const fieldColumn = field === 'createdAt' ? '"createdAt"' : '"versionNumber"';
      const dataResult = await this.#db.client.manyOrNone(
        `SELECT * FROM ${tableName} WHERE "agentId" = $1 ORDER BY ${fieldColumn} ${direction} LIMIT $2 OFFSET $3`,
        [agentId, perPage, offset],
      );

      const versions = (dataResult || []).map(row => this.parseRow(row));

      return {
        versions,
        total,
        page,
        perPage: perPageForResponse === false ? total : perPageForResponse,
        hasMore: offset + perPage < total,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'LIST_AGENT_VERSIONS', 'FAILED'),
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
      const tableName = getTableName({ indexName: TABLE_AGENT_VERSIONS, schemaName: getSchemaName(this.#schema) });

      await this.#db.client.none(`DELETE FROM ${tableName} WHERE id = $1`, [id]);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'DELETE_AGENT_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { versionId: id },
        },
        error,
      );
    }
  }

  async deleteVersionsByAgentId(agentId: string): Promise<void> {
    try {
      const tableName = getTableName({ indexName: TABLE_AGENT_VERSIONS, schemaName: getSchemaName(this.#schema) });

      await this.#db.client.none(`DELETE FROM ${tableName} WHERE "agentId" = $1`, [agentId]);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'DELETE_AGENT_VERSIONS_BY_AGENT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { agentId },
        },
        error,
      );
    }
  }

  async countVersions(agentId: string): Promise<number> {
    try {
      const tableName = getTableName({ indexName: TABLE_AGENT_VERSIONS, schemaName: getSchemaName(this.#schema) });

      const result = await this.#db.client.one(`SELECT COUNT(*) as count FROM ${tableName} WHERE "agentId" = $1`, [
        agentId,
      ]);

      return parseInt(result.count, 10);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'COUNT_AGENT_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { agentId },
        },
        error,
      );
    }
  }
}
