import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  ToolProviderConnectionsStorage,
  createStorageErrorId,
  TABLE_TOOL_PROVIDER_CONNECTIONS,
  TABLE_SCHEMAS,
  TOOL_PROVIDER_CONNECTIONS_SCHEMA,
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
import type { Pool, RowDataPacket } from 'mysql2/promise';

import type { StoreOperationsMySQL } from '../operations';
import { generateTableSQL } from '../operations';
import { formatTableName, quoteIdentifier, transformToSqlValue, parseDateTime } from '../utils';

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
    createdAt: parseDateTime(row.createdAt as string | number | Date | null | undefined) ?? new Date(),
    updatedAt: parseDateTime(row.updatedAt as string | number | Date | null | undefined) ?? new Date(),
  };
}

export class ToolProviderConnectionsMySQL extends ToolProviderConnectionsStorage {
  private pool: Pool;
  private operations: StoreOperationsMySQL;
  #skipDefaultIndexes?: boolean;
  #indexes?: CreateIndexOptions[];

  /** Tables managed by this domain */
  static readonly MANAGED_TABLES = [TABLE_TOOL_PROVIDER_CONNECTIONS] as const;

  /**
   * Returns default index definitions for the tool-provider-connections domain tables.
   * Currently no default indexes are defined for tool-provider-connections.
   */
  static getDefaultIndexDefs(_prefix: string = ''): CreateIndexOptions[] {
    return [];
  }

  /**
   * Exports DDL statements for all managed tables.
   */
  static getExportDDL(): string[] {
    return [
      generateTableSQL({
        tableName: TABLE_TOOL_PROVIDER_CONNECTIONS,
        schema: TABLE_SCHEMAS[TABLE_TOOL_PROVIDER_CONNECTIONS],
        compositePrimaryKey: ['authorId', 'providerId', 'connectionId'],
      }),
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
    this.#indexes = indexes?.filter(idx =>
      (ToolProviderConnectionsMySQL.MANAGED_TABLES as readonly string[]).includes(idx.table),
    );
  }

  /**
   * Returns default index definitions for the tool-provider-connections domain tables.
   */
  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    return ToolProviderConnectionsMySQL.getDefaultIndexDefs('');
  }

  /**
   * Creates default indexes for optimal query performance.
   * Currently no default indexes are defined for tool-provider-connections.
   */
  async createDefaultIndexes(): Promise<void> {
    if (this.#skipDefaultIndexes) return;
    // No default indexes for tool-provider-connections domain
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
    await this.operations.createTable({
      tableName: TABLE_TOOL_PROVIDER_CONNECTIONS,
      schema: TOOL_PROVIDER_CONNECTIONS_SCHEMA,
    });
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.operations.clearTable({ tableName: TABLE_TOOL_PROVIDER_CONNECTIONS });
  }

  async getConnectionById({
    authorId,
    providerId,
    connectionId,
  }: StorageToolProviderConnectionKey): Promise<StorageToolProviderConnection | null> {
    try {
      const [rows] = await this.pool.execute<RowDataPacket[]>(
        `SELECT * FROM ${formatTableName(TABLE_TOOL_PROVIDER_CONNECTIONS)} WHERE ${quoteIdentifier('authorId', 'column name')} = ? AND ${quoteIdentifier('providerId', 'column name')} = ? AND ${quoteIdentifier('connectionId', 'column name')} = ? LIMIT 1`,
        [authorId, providerId, connectionId],
      );
      return rows.length ? rowToToolProviderConnection(rows[0]!) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('MYSQL', 'TOOL_PROVIDER_CONNECTION_GET', 'FAILED'),
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
    const now = new Date();
    const labelValue = label == null ? null : label;

    try {
      return await this.operations.withTransaction(async connection => {
        const [existing] = await connection.execute<RowDataPacket[]>(
          `SELECT ${quoteIdentifier('createdAt', 'column name')}, ${quoteIdentifier('scope', 'column name')} FROM ${formatTableName(TABLE_TOOL_PROVIDER_CONNECTIONS)} WHERE ${quoteIdentifier('authorId', 'column name')} = ? AND ${quoteIdentifier('providerId', 'column name')} = ? AND ${quoteIdentifier('connectionId', 'column name')} = ? LIMIT 1`,
          [authorId, providerId, connectionId],
        );

        const existingRow = existing[0];
        const createdAt = existingRow ? existingRow.createdAt : now;
        const existingScope = existingRow && existingRow.scope != null ? normaliseScope(existingRow.scope) : undefined;
        const scope: StorageToolProviderConnectionScope = input.scope ?? existingScope ?? 'per-author';

        if (existingRow) {
          await connection.execute(
            `UPDATE ${formatTableName(TABLE_TOOL_PROVIDER_CONNECTIONS)} SET ${quoteIdentifier('toolkit', 'column name')} = ?, ${quoteIdentifier('label', 'column name')} = ?, ${quoteIdentifier('scope', 'column name')} = ?, ${quoteIdentifier('updatedAt', 'column name')} = ? WHERE ${quoteIdentifier('authorId', 'column name')} = ? AND ${quoteIdentifier('providerId', 'column name')} = ? AND ${quoteIdentifier('connectionId', 'column name')} = ?`,
            [toolkit, labelValue, scope, transformToSqlValue(now), authorId, providerId, connectionId],
          );
        } else {
          await connection.execute(
            `INSERT INTO ${formatTableName(TABLE_TOOL_PROVIDER_CONNECTIONS)} (${quoteIdentifier('authorId', 'column name')}, ${quoteIdentifier('providerId', 'column name')}, ${quoteIdentifier('toolkit', 'column name')}, ${quoteIdentifier('connectionId', 'column name')}, ${quoteIdentifier('label', 'column name')}, ${quoteIdentifier('scope', 'column name')}, ${quoteIdentifier('createdAt', 'column name')}, ${quoteIdentifier('updatedAt', 'column name')}) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              authorId,
              providerId,
              toolkit,
              connectionId,
              labelValue,
              scope,
              transformToSqlValue(createdAt),
              transformToSqlValue(now),
            ],
          );
        }

        return {
          authorId,
          providerId,
          toolkit,
          connectionId,
          label: labelValue,
          scope,
          createdAt: parseDateTime(createdAt) ?? now,
          updatedAt: now,
        };
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('MYSQL', 'TOOL_PROVIDER_CONNECTION_UPSERT', 'FAILED'),
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
    try {
      const clauses: string[] = [];
      const args: (string | number | null)[] = [];
      if (authorId !== undefined) {
        clauses.push(`${quoteIdentifier('authorId', 'column name')} = ?`);
        args.push(authorId);
      }
      if (providerId) {
        clauses.push(`${quoteIdentifier('providerId', 'column name')} = ?`);
        args.push(providerId);
      }
      if (toolkit) {
        clauses.push(`${quoteIdentifier('toolkit', 'column name')} = ?`);
        args.push(toolkit);
      }
      if (scope) {
        clauses.push(`${quoteIdentifier('scope', 'column name')} = ?`);
        args.push(scope);
      }
      const whereClause = clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '';
      const [rows] = await this.pool.execute<RowDataPacket[]>(
        `SELECT * FROM ${formatTableName(TABLE_TOOL_PROVIDER_CONNECTIONS)}${whereClause}`,
        args,
      );
      return rows.map(row => rowToToolProviderConnection(row as Record<string, unknown>));
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('MYSQL', 'TOOL_PROVIDER_CONNECTION_LIST', 'FAILED'),
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
    try {
      await this.pool.execute(
        `DELETE FROM ${formatTableName(TABLE_TOOL_PROVIDER_CONNECTIONS)} WHERE ${quoteIdentifier('authorId', 'column name')} = ? AND ${quoteIdentifier('providerId', 'column name')} = ? AND ${quoteIdentifier('connectionId', 'column name')} = ?`,
        [authorId, providerId, connectionId],
      );
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('MYSQL', 'TOOL_PROVIDER_CONNECTION_DELETE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { authorId, providerId, connectionId },
        },
        error,
      );
    }
  }
}
