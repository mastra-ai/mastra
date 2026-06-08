import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  ToolProviderConnectionsStorage,
  createStorageErrorId,
  TABLE_TOOL_PROVIDER_CONNECTIONS,
  TABLE_SCHEMAS,
} from '@mastra/core/storage';
import type {
  CreateIndexOptions,
  StorageDeleteToolProviderConnectionInput,
  StorageListToolProviderConnectionsInput,
  StorageToolProviderConnection,
  StorageToolProviderConnectionKey,
  StorageToolProviderConnectionScope,
  StorageUpsertToolProviderConnectionInput,
} from '@mastra/core/storage';
import { parseSqlIdentifier } from '@mastra/core/utils';

import { PgDB, resolvePgConfig, generateTableSQL, generateIndexSQL } from '../../db';
import type { PgDomainConfig } from '../../db';
import { getTableName, getSchemaName } from '../utils';

function normaliseScope(raw: unknown): StorageToolProviderConnectionScope {
  const value = raw == null ? 'per-author' : String(raw);
  if (value === 'shared') return 'shared';
  if (value === 'caller-supplied') return 'caller-supplied';
  return 'per-author';
}

function rowToToolProviderConnection(row: Record<string, unknown>): StorageToolProviderConnection {
  return {
    authorId: String(row.authorId),
    providerId: String(row.providerId),
    toolkit: String(row.toolkit),
    connectionId: String(row.connectionId),
    label: row.label == null ? null : String(row.label),
    scope: normaliseScope(row.scope),
    createdAt: new Date(String(row.createdAtZ ?? row.createdAt)),
    updatedAt: new Date(String(row.updatedAtZ ?? row.updatedAt)),
  };
}

export class ToolProviderConnectionsPG extends ToolProviderConnectionsStorage {
  #db: PgDB;
  #schema: string;
  #skipDefaultIndexes?: boolean;
  #indexes?: CreateIndexOptions[];

  static readonly MANAGED_TABLES = [TABLE_TOOL_PROVIDER_CONNECTIONS] as const;

  constructor(config: PgDomainConfig) {
    super();
    const { client, schemaName, skipDefaultIndexes, indexes } = resolvePgConfig(config);
    this.#db = new PgDB({ client, schemaName, skipDefaultIndexes });
    this.#schema = schemaName || 'public';
    this.#skipDefaultIndexes = skipDefaultIndexes;
    this.#indexes = indexes?.filter(idx =>
      (ToolProviderConnectionsPG.MANAGED_TABLES as readonly string[]).includes(idx.table),
    );
  }

  async init(): Promise<void> {
    await this.#db.createTable({
      tableName: TABLE_TOOL_PROVIDER_CONNECTIONS,
      schema: TABLE_SCHEMAS[TABLE_TOOL_PROVIDER_CONNECTIONS],
      compositePrimaryKey: ['authorId', 'providerId', 'connectionId'],
    });
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  static getDefaultIndexDefs(schemaPrefix: string): CreateIndexOptions[] {
    return [
      {
        name: `${schemaPrefix}idx_tool_provider_connections_author`,
        table: TABLE_TOOL_PROVIDER_CONNECTIONS,
        columns: ['authorId', 'providerId', 'toolkit'],
      },
    ];
  }

  static getExportDDL(schemaName?: string): string[] {
    const statements: string[] = [];
    const parsedSchema = schemaName ? parseSqlIdentifier(schemaName, 'schema name') : '';
    const schemaPrefix = parsedSchema && parsedSchema !== 'public' ? `${parsedSchema}_` : '';

    statements.push(
      generateTableSQL({
        tableName: TABLE_TOOL_PROVIDER_CONNECTIONS,
        schema: TABLE_SCHEMAS[TABLE_TOOL_PROVIDER_CONNECTIONS],
        schemaName,
        compositePrimaryKey: ['authorId', 'providerId', 'connectionId'],
        includeAllConstraints: true,
      }),
    );

    for (const idx of ToolProviderConnectionsPG.getDefaultIndexDefs(schemaPrefix)) {
      statements.push(generateIndexSQL(idx, schemaName));
    }

    return statements;
  }

  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    const schemaPrefix = this.#schema !== 'public' ? `${this.#schema}_` : '';
    return ToolProviderConnectionsPG.getDefaultIndexDefs(schemaPrefix);
  }

  async createDefaultIndexes(): Promise<void> {
    if (this.#skipDefaultIndexes) return;
    for (const indexDef of this.getDefaultIndexDefinitions()) {
      try {
        await this.#db.createIndex(indexDef);
      } catch (error) {
        this.logger?.warn?.(`Failed to create index ${indexDef.name}:`, error);
      }
    }
  }

  async createCustomIndexes(): Promise<void> {
    if (!this.#indexes || this.#indexes.length === 0) return;
    for (const indexDef of this.#indexes) {
      try {
        await this.#db.createIndex(indexDef);
      } catch (error) {
        this.logger?.warn?.(`Failed to create custom index ${indexDef.name}:`, error);
      }
    }
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.clearTable({ tableName: TABLE_TOOL_PROVIDER_CONNECTIONS });
  }

  async getConnectionById({
    authorId,
    providerId,
    connectionId,
  }: StorageToolProviderConnectionKey): Promise<StorageToolProviderConnection | null> {
    const tableName = getTableName({
      indexName: TABLE_TOOL_PROVIDER_CONNECTIONS,
      schemaName: getSchemaName(this.#schema),
    });

    try {
      const row = await this.#db.client.oneOrNone(
        `SELECT * FROM ${tableName} WHERE "authorId" = $1 AND "providerId" = $2 AND "connectionId" = $3 LIMIT 1`,
        [authorId, providerId, connectionId],
      );
      return row ? rowToToolProviderConnection(row) : null;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'TOOL_PROVIDER_CONNECTION_GET', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { authorId, providerId, connectionId },
        },
        error,
      );
    }
  }

  async upsertConnection(input: StorageUpsertToolProviderConnectionInput): Promise<StorageToolProviderConnection> {
    const { authorId, providerId, toolkit, connectionId, label } = input;
    const tableName = getTableName({
      indexName: TABLE_TOOL_PROVIDER_CONNECTIONS,
      schemaName: getSchemaName(this.#schema),
    });
    const now = new Date();
    const nowIso = now.toISOString();
    const labelValue = label == null ? null : label;

    try {
      return await this.#db.client.tx(async t => {
        const existing = await t.oneOrNone(
          `SELECT "createdAt", "createdAtZ", scope FROM ${tableName} WHERE "authorId" = $1 AND "providerId" = $2 AND "connectionId" = $3 LIMIT 1`,
          [authorId, providerId, connectionId],
        );
        const existingCreatedAt = existing ? (existing.createdAtZ ?? existing.createdAt) : null;
        const createdAt =
          existingCreatedAt != null ? new Date(existingCreatedAt as string | Date).toISOString() : nowIso;
        const existingScope = existing && existing.scope != null ? normaliseScope(existing.scope) : undefined;
        const scope: StorageToolProviderConnectionScope = input.scope ?? existingScope ?? 'per-author';

        await t.none(
          `INSERT INTO ${tableName} ("authorId", "providerId", toolkit, "connectionId", label, scope, "createdAt", "createdAtZ", "updatedAt", "updatedAtZ")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT ("authorId", "providerId", "connectionId") DO UPDATE SET
             toolkit = EXCLUDED.toolkit,
             label = EXCLUDED.label,
             scope = EXCLUDED.scope,
             "updatedAt" = EXCLUDED."updatedAt",
             "updatedAtZ" = EXCLUDED."updatedAtZ"`,
          [authorId, providerId, toolkit, connectionId, labelValue, scope, createdAt, createdAt, nowIso, nowIso],
        );

        return {
          authorId,
          providerId,
          toolkit,
          connectionId,
          label: labelValue,
          scope,
          createdAt: new Date(createdAt),
          updatedAt: now,
        };
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'TOOL_PROVIDER_CONNECTION_UPSERT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { authorId, providerId, connectionId },
        },
        error,
      );
    }
  }

  async listConnectionsByAuthor({
    authorId,
    providerId,
    toolkit,
    scope,
  }: StorageListToolProviderConnectionsInput): Promise<StorageToolProviderConnection[]> {
    const tableName = getTableName({
      indexName: TABLE_TOOL_PROVIDER_CONNECTIONS,
      schemaName: getSchemaName(this.#schema),
    });

    try {
      const clauses: string[] = [];
      const args: string[] = [];
      if (authorId !== undefined) {
        args.push(authorId);
        clauses.push(`"authorId" = $${args.length}`);
      }
      if (providerId) {
        args.push(providerId);
        clauses.push(`"providerId" = $${args.length}`);
      }
      if (toolkit) {
        args.push(toolkit);
        clauses.push(`toolkit = $${args.length}`);
      }
      if (scope) {
        args.push(scope);
        clauses.push(`scope = $${args.length}`);
      }
      const whereClause = clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '';
      const rows = await this.#db.client.manyOrNone(`SELECT * FROM ${tableName}${whereClause}`, args);
      return rows.map(row => rowToToolProviderConnection(row));
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'TOOL_PROVIDER_CONNECTION_LIST', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { authorId: authorId ?? '', providerId: providerId ?? '', toolkit: toolkit ?? '' },
        },
        error,
      );
    }
  }

  async deleteConnection({
    authorId,
    providerId,
    connectionId,
  }: StorageDeleteToolProviderConnectionInput): Promise<void> {
    const tableName = getTableName({
      indexName: TABLE_TOOL_PROVIDER_CONNECTIONS,
      schemaName: getSchemaName(this.#schema),
    });

    try {
      await this.#db.client.none(
        `DELETE FROM ${tableName} WHERE "authorId" = $1 AND "providerId" = $2 AND "connectionId" = $3`,
        [authorId, providerId, connectionId],
      );
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'TOOL_PROVIDER_CONNECTION_DELETE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { authorId, providerId, connectionId },
        },
        error,
      );
    }
  }
}
