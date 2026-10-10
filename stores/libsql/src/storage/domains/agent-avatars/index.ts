import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  AgentAvatarsStorage,
  createStorageErrorId,
  TABLE_AGENT_AVATARS,
  AGENT_AVATARS_SCHEMA,
} from '@mastra/core/storage';
import type { StorageAgentAvatarType, StoragePutAgentAvatarInput } from '@mastra/core/storage';

import { LibSQLDB, resolveClient } from '../../db';
import type { LibSQLDomainConfig } from '../../db';
import type { SqliteClient as Client } from '../../db/client';

export class AgentAvatarsLibSQL extends AgentAvatarsStorage {
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
      tableName: TABLE_AGENT_AVATARS,
      schema: AGENT_AVATARS_SCHEMA,
    });
  }

  async put({ agentId, data, mime }: StoragePutAgentAvatarInput): Promise<void> {
    try {
      const now = new Date().toISOString();
      const sizeBytes = Buffer.byteLength(data, 'base64');
      // Upsert: replace bytes/mime/updatedAt, preserve createdAt on conflict.
      await this.#client.execute({
        sql: `INSERT INTO "${TABLE_AGENT_AVATARS}" ("agentId", "data", "mime", "sizeBytes", "createdAt", "updatedAt")
              VALUES (?, ?, ?, ?, ?, ?)
              ON CONFLICT("agentId") DO UPDATE SET
                "data" = excluded."data",
                "mime" = excluded."mime",
                "sizeBytes" = excluded."sizeBytes",
                "updatedAt" = excluded."updatedAt"`,
        args: [agentId, data, mime, sizeBytes, now, now],
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'PUT_AGENT_AVATAR', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { agentId },
        },
        error,
      );
    }
  }

  async get(agentId: string): Promise<StorageAgentAvatarType | null> {
    try {
      const result = await this.#client.execute({
        sql: `SELECT "agentId", "data", "mime", "sizeBytes", "createdAt", "updatedAt" FROM "${TABLE_AGENT_AVATARS}" WHERE "agentId" = ? LIMIT 1`,
        args: [agentId],
      });
      const row = result.rows?.[0];
      if (!row) return null;
      return {
        agentId: row.agentId as string,
        data: row.data as string,
        mime: row.mime as string,
        sizeBytes: Number(row.sizeBytes),
        createdAt: new Date(row.createdAt as string),
        updatedAt: new Date(row.updatedAt as string),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_AGENT_AVATAR', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { agentId },
        },
        error,
      );
    }
  }

  async delete(agentId: string): Promise<void> {
    try {
      await this.#client.execute({
        sql: `DELETE FROM "${TABLE_AGENT_AVATARS}" WHERE "agentId" = ?`,
        args: [agentId],
      });
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'DELETE_AGENT_AVATAR', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { agentId },
        },
        error,
      );
    }
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#client.execute(`DELETE FROM "${TABLE_AGENT_AVATARS}"`);
  }
}
