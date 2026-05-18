import type { Client } from '@libsql/client';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  ToolConnectionsStorage,
  createStorageErrorId,
  TABLE_TOOL_CONNECTIONS,
  TOOL_CONNECTIONS_SCHEMA,
} from '@mastra/core/storage';
import type {
  StorageDeleteToolConnectionInput,
  StorageListToolConnectionsInput,
  StorageToolConnection,
  StorageToolConnectionKey,
  StorageUpsertToolConnectionInput,
} from '@mastra/core/storage';

import { LibSQLDB, resolveClient } from '../../db';
import type { LibSQLDomainConfig } from '../../db';

function rowToToolConnection(row: Record<string, unknown>): StorageToolConnection {
  return {
    authorId: String(row.authorId),
    providerId: String(row.providerId),
    toolService: String(row.toolService),
    connectionId: String(row.connectionId),
    label: row.label == null ? null : String(row.label),
    createdAt: new Date(String(row.createdAt)),
    updatedAt: new Date(String(row.updatedAt)),
  };
}

export class ToolConnectionsLibSQL extends ToolConnectionsStorage {
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
      tableName: TABLE_TOOL_CONNECTIONS,
      schema: TOOL_CONNECTIONS_SCHEMA,
      compositePrimaryKey: ['authorId', 'providerId', 'connectionId'],
    });

    // Lookup index for author-scoped narrowing by provider/toolService.
    await this.#client.execute(
      `CREATE INDEX IF NOT EXISTS idx_tool_connections_author ON "${TABLE_TOOL_CONNECTIONS}" ("authorId", "providerId", "toolService")`,
    );
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#client.execute(`DELETE FROM "${TABLE_TOOL_CONNECTIONS}"`);
  }

  async get({ authorId, providerId, connectionId }: StorageToolConnectionKey): Promise<StorageToolConnection | null> {
    try {
      const result = await this.#client.execute({
        sql: `SELECT * FROM "${TABLE_TOOL_CONNECTIONS}" WHERE "authorId" = ? AND "providerId" = ? AND "connectionId" = ? LIMIT 1`,
        args: [authorId, providerId, connectionId],
      });
      const row = result.rows?.[0];
      if (!row) return null;
      return rowToToolConnection(row as unknown as Record<string, unknown>);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'TOOL_CONNECTION_GET', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { authorId, providerId, connectionId },
        },
        error,
      );
    }
  }

  async upsert(input: StorageUpsertToolConnectionInput): Promise<StorageToolConnection> {
    const { authorId, providerId, toolService, connectionId, label } = input;
    const now = new Date();
    const nowIso = now.toISOString();
    const labelValue = label == null ? null : label;

    try {
      const tx = await this.#client.transaction('write');
      try {
        const existing = await tx.execute({
          sql: `SELECT "createdAt" FROM "${TABLE_TOOL_CONNECTIONS}" WHERE "authorId" = ? AND "providerId" = ? AND "connectionId" = ? LIMIT 1`,
          args: [authorId, providerId, connectionId],
        });
        const existingRow = existing.rows?.[0];
        const createdAt = existingRow ? String(existingRow.createdAt) : nowIso;

        if (existingRow) {
          await tx.execute({
            sql: `UPDATE "${TABLE_TOOL_CONNECTIONS}" SET "toolService" = ?, "label" = ?, "updatedAt" = ? WHERE "authorId" = ? AND "providerId" = ? AND "connectionId" = ?`,
            args: [toolService, labelValue, nowIso, authorId, providerId, connectionId],
          });
        } else {
          await tx.execute({
            sql: `INSERT INTO "${TABLE_TOOL_CONNECTIONS}" ("authorId", "providerId", "toolService", "connectionId", "label", "createdAt", "updatedAt") VALUES (?, ?, ?, ?, ?, ?, ?)`,
            args: [authorId, providerId, toolService, connectionId, labelValue, createdAt, nowIso],
          });
        }

        await tx.commit();

        return {
          authorId,
          providerId,
          toolService,
          connectionId,
          label: labelValue,
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
          id: createStorageErrorId('LIBSQL', 'TOOL_CONNECTION_UPSERT', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { authorId, providerId, connectionId },
        },
        error,
      );
    }
  }

  async list({ authorId, providerId, toolService }: StorageListToolConnectionsInput): Promise<StorageToolConnection[]> {
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
      if (toolService) {
        clauses.push('"toolService" = ?');
        args.push(toolService);
      }
      const whereClause = clauses.length > 0 ? ` WHERE ${clauses.join(' AND ')}` : '';
      const result = await this.#client.execute({
        sql: `SELECT * FROM "${TABLE_TOOL_CONNECTIONS}"${whereClause}`,
        args,
      });
      return (result.rows ?? []).map(row => rowToToolConnection(row as unknown as Record<string, unknown>));
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'TOOL_CONNECTION_LIST', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { authorId, providerId: providerId ?? '', toolService: toolService ?? '' },
        },
        error,
      );
    }
  }

  async delete({ authorId, providerId, connectionId }: StorageDeleteToolConnectionInput): Promise<void> {
    try {
      await this.#client.execute({
        sql: `DELETE FROM "${TABLE_TOOL_CONNECTIONS}" WHERE "authorId" = ? AND "providerId" = ? AND "connectionId" = ?`,
        args: [authorId, providerId, connectionId],
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'TOOL_CONNECTION_DELETE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { authorId, providerId, connectionId },
        },
        error,
      );
    }
  }
}
