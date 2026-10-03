import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { AgentAvatarsStorage, createStorageErrorId, TABLE_AGENT_AVATARS, TABLE_SCHEMAS } from '@mastra/core/storage';
import type { StorageAgentAvatarType, StoragePutAgentAvatarInput } from '@mastra/core/storage';

import { PgDB, resolvePgConfig, generateTableSQL } from '../../db';
import type { PgDomainConfig } from '../../db';
import { getSchemaName, getTableName } from '../utils';

/**
 * PostgreSQL implementation of {@link AgentAvatarsStorage}.
 *
 * Stores one avatar per agent in `mastra_agent_avatars`, keyed by `agentId`.
 * Bytes are stored base64-encoded in a text column.
 */
export class AgentAvatarsPG extends AgentAvatarsStorage {
  #db: PgDB;
  #schema: string;

  static readonly MANAGED_TABLES = [TABLE_AGENT_AVATARS] as const;

  constructor(config: PgDomainConfig) {
    super();
    const { client, readClient, schemaName, skipDefaultIndexes } = resolvePgConfig(config);
    this.#db = new PgDB({ client, readClient, schemaName, skipDefaultIndexes });
    this.#schema = schemaName || 'public';
  }

  static getExportDDL(schemaName?: string): string[] {
    return [
      generateTableSQL({
        tableName: TABLE_AGENT_AVATARS,
        schema: TABLE_SCHEMAS[TABLE_AGENT_AVATARS],
        schemaName,
        includeAllConstraints: true,
      }),
    ];
  }

  async init(): Promise<void> {
    await this.#db.createTable({
      tableName: TABLE_AGENT_AVATARS,
      schema: TABLE_SCHEMAS[TABLE_AGENT_AVATARS],
    });
  }

  get #table(): string {
    return getTableName({ indexName: TABLE_AGENT_AVATARS, schemaName: getSchemaName(this.#schema) });
  }

  async put({ agentId, data, mime }: StoragePutAgentAvatarInput): Promise<void> {
    const now = new Date().toISOString();
    const sizeBytes = Buffer.byteLength(data, 'base64');
    try {
      // Single-statement upsert: `createdAt` keeps meaning "first written".
      await this.#db.client.none(
        `INSERT INTO ${this.#table} ("agentId", "data", "mime", "sizeBytes", "createdAt", "createdAtZ", "updatedAt", "updatedAtZ")
         VALUES ($1, $2, $3, $4, $5::timestamp, $6::timestamptz, $5::timestamp, $6::timestamptz)
         ON CONFLICT ("agentId")
         DO UPDATE SET "data" = EXCLUDED."data",
                       "mime" = EXCLUDED."mime",
                       "sizeBytes" = EXCLUDED."sizeBytes",
                       "updatedAt" = EXCLUDED."updatedAt",
                       "updatedAtZ" = EXCLUDED."updatedAtZ"`,
        [agentId, data, mime, sizeBytes, now, now],
      );
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'PUT_AGENT_AVATAR', 'FAILED'),
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
      const row = await this.#db.client.oneOrNone<{
        agentId: string;
        data: string;
        mime: string;
        sizeBytes: number | string;
        createdAt: Date | string;
        updatedAt: Date | string;
      }>(
        `SELECT "agentId", "data", "mime", "sizeBytes", "createdAt", "updatedAt" FROM ${this.#table} WHERE "agentId" = $1 LIMIT 1`,
        [agentId],
      );
      if (!row) return null;
      return {
        agentId: row.agentId,
        data: row.data,
        mime: row.mime,
        sizeBytes: Number(row.sizeBytes),
        createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
        updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt),
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'GET_AGENT_AVATAR', 'FAILED'),
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
      await this.#db.client.none(`DELETE FROM ${this.#table} WHERE "agentId" = $1`, [agentId]);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'DELETE_AGENT_AVATAR', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { agentId },
        },
        error,
      );
    }
  }

  async dangerouslyClearAll(): Promise<void> {
    try {
      await this.#db.client.none(`DELETE FROM ${this.#table}`);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'AGENT_AVATARS_CLEAR_ALL', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }
}
