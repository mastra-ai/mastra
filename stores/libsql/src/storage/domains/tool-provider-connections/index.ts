import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  ToolProviderConnectionsStorage,
  createStorageErrorId,
  TABLE_TOOL_PROVIDER_CONNECTIONS,
  TOOL_PROVIDER_CONNECTIONS_SCHEMA,
} from '@mastra/core/storage';
import type {
  StorageDeleteToolProviderConnectionInput,
  StorageListToolProviderConnectionsInput,
  StorageToolProviderConnection,
  StorageToolProviderConnectionKey,
  StorageToolProviderConnectionScope,
  StorageUpsertToolProviderConnectionInput,
} from '@mastra/core/storage';

import { LibSQLDB, resolveClient } from '../../db';
import type { LibSQLDomainConfig } from '../../db';
import type { SqliteClient as Client } from '../../db/client';

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
    createdAt: new Date(String(row.createdAt)),
    updatedAt: new Date(String(row.updatedAt)),
  };
}

export class ToolProviderConnectionsLibSQL extends ToolProviderConnectionsStorage {
  #db: LibSQLDB;
  #client: Client;

  constructor(config: LibSQLDomainConfig) {
    super();
    const client = resolveClient(config);
    this.#client = client;
    this.#db = new LibSQLDB({ client, maxRetries: config.maxRetries, initialBackoffMs: config.initialBackoffMs });
  }

  async init(): Promise<void> {
    await this.#db.createTable({
      tableName: TABLE_TOOL_PROVIDER_CONNECTIONS,
      schema: TOOL_PROVIDER_CONNECTIONS_SCHEMA,
      compositePrimaryKey: ['authorId', 'providerId', 'connectionId'],
    });

    // Lookup index for author-scoped narrowing by provider/toolkit.
    await this.#client.execute(
      `CREATE INDEX IF NOT EXISTS idx_tool_provider_connections_author ON "${TABLE_TOOL_PROVIDER_CONNECTIONS}" ("authorId", "providerId", "toolkit")`,
    );
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#client.execute(`DELETE FROM "${TABLE_TOOL_PROVIDER_CONNECTIONS}"`);
  }

  async getConnectionById({
    authorId,
    providerId,
    connectionId,
  }: StorageToolProviderConnectionKey): Promise<StorageToolProviderConnection | null> {
    try {
      const result = await this.#client.execute({
        sql: `SELECT * FROM "${TABLE_TOOL_PROVIDER_CONNECTIONS}" WHERE "authorId" = ? AND "providerId" = ? AND "connectionId" = ? LIMIT 1`,
        args: [authorId, providerId, connectionId],
      });
      const row = result.rows?.[0];
      if (!row) return null;
      return rowToToolProviderConnection(row as unknown as Record<string, unknown>);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'TOOL_PROVIDER_CONNECTION_GET', 'FAILED'),
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
    const nowIso = now.toISOString();
    const labelValue = label == null ? null : label;

    try {
      const tx = await this.#client.transaction('write');
      try {
        const existing = await tx.execute({
          sql: `SELECT "createdAt", "scope" FROM "${TABLE_TOOL_PROVIDER_CONNECTIONS}" WHERE "authorId" = ? AND "providerId" = ? AND "connectionId" = ? LIMIT 1`,
          args: [authorId, providerId, connectionId],
        });
        const existingRow = existing.rows?.[0];
        const createdAt = existingRow ? String(existingRow.createdAt) : nowIso;
        const existingScope = existingRow && existingRow.scope != null ? normaliseScope(existingRow.scope) : undefined;
        const scope: StorageToolProviderConnectionScope = input.scope ?? existingScope ?? 'per-author';

        if (existingRow) {
          await tx.execute({
            sql: `UPDATE "${TABLE_TOOL_PROVIDER_CONNECTIONS}" SET "toolkit" = ?, "label" = ?, "scope" = ?, "updatedAt" = ? WHERE "authorId" = ? AND "providerId" = ? AND "connectionId" = ?`,
            args: [toolkit, labelValue, scope, nowIso, authorId, providerId, connectionId],
          });
        } else {
          await tx.execute({
            sql: `INSERT INTO "${TABLE_TOOL_PROVIDER_CONNECTIONS}" ("authorId", "providerId", "toolkit", "connectionId", "label", "scope", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [authorId, providerId, toolkit, connectionId, labelValue, scope, createdAt, nowIso],
          });
        }

        await tx.commit();

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
      } catch (error) {
        if (!tx.closed) {
          await tx.rollback();
        }
        throw error;
      }
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'TOOL_PROVIDER_CONNECTION_UPSERT', 'FAILED'),
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
        clauses.push('"authorId" = ?');
        args.push(authorId);
      }
      if (providerId) {
        clauses.push('"providerId" = ?');
        args.push(providerId);
      }
      if (toolkit) {
        clauses.push('"toolkit" = ?');
        args.push(toolkit);
      }
      if (scope) {
        clauses.push('"scope" = ?');
        args.push(scope);
      }
      const whereClause = clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '';
      const result = await this.#client.execute({
        sql: `SELECT * FROM "${TABLE_TOOL_PROVIDER_CONNECTIONS}"${whereClause}`,
        args,
      });
      return (result.rows ?? []).map(row => rowToToolProviderConnection(row as unknown as Record<string, unknown>));
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'TOOL_PROVIDER_CONNECTION_LIST', 'FAILED'),
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
      await this.#client.execute({
        sql: `DELETE FROM "${TABLE_TOOL_PROVIDER_CONNECTIONS}" WHERE "authorId" = ? AND "providerId" = ? AND "connectionId" = ?`,
        args: [authorId, providerId, connectionId],
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'TOOL_PROVIDER_CONNECTION_DELETE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { authorId, providerId, connectionId },
        },
        error,
      );
    }
  }
}
