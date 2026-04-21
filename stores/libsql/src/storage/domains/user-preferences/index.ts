import type { Client } from '@libsql/client';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  UserPreferencesStorage,
  createStorageErrorId,
  TABLE_SCHEMAS,
  TABLE_USER_PREFERENCES,
} from '@mastra/core/storage';
import type {
  StorageUpdateUserPreferencesInput,
  StorageUserPreferencesAgentStudio,
  StorageUserPreferencesType,
} from '@mastra/core/storage';
import { LibSQLDB, resolveClient } from '../../db';
import type { LibSQLDomainConfig } from '../../db';
import { buildSelectColumns } from '../../db/utils';

export class UserPreferencesLibSQL extends UserPreferencesStorage {
  #db: LibSQLDB;
  #client: Client;

  constructor(config: LibSQLDomainConfig) {
    super();
    const client = resolveClient(config);
    this.#client = client;
    this.#db = new LibSQLDB({ client, maxRetries: config.maxRetries, initialBackoffMs: config.initialBackoffMs });
  }

  override async init(): Promise<void> {
    await this.#db.createTable({
      tableName: TABLE_USER_PREFERENCES,
      schema: TABLE_SCHEMAS[TABLE_USER_PREFERENCES],
    });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.deleteData({ tableName: TABLE_USER_PREFERENCES });
  }

  async get(userId: string): Promise<StorageUserPreferencesType | null> {
    try {
      const result = await this.#client.execute({
        sql: `SELECT ${buildSelectColumns(TABLE_USER_PREFERENCES)} FROM "${TABLE_USER_PREFERENCES}" WHERE "userId" = ?`,
        args: [userId],
      });
      const row = result.rows?.[0];
      return row ? parseRow(row) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_USER_PREFERENCES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async update(userId: string, patch: StorageUpdateUserPreferencesInput): Promise<StorageUserPreferencesType> {
    try {
      const existing = await this.get(userId);
      const now = new Date();

      const merged: StorageUserPreferencesType = existing
        ? {
            ...existing,
            agentStudio: mergeAgentStudio(existing.agentStudio, patch.agentStudio),
            metadata:
              patch.metadata !== undefined ? { ...(existing.metadata ?? {}), ...patch.metadata } : existing.metadata,
            updatedAt: now,
          }
        : {
            userId,
            agentStudio: mergeAgentStudio({}, patch.agentStudio),
            metadata: patch.metadata,
            createdAt: now,
            updatedAt: now,
          };

      await this.#db.insert({
        tableName: TABLE_USER_PREFERENCES,
        record: {
          userId: merged.userId,
          agentStudio: merged.agentStudio,
          metadata: merged.metadata ?? null,
          createdAt: merged.createdAt.toISOString(),
          updatedAt: merged.updatedAt.toISOString(),
        },
      });

      return merged;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'UPDATE_USER_PREFERENCES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async delete(userId: string): Promise<void> {
    try {
      await this.#db.delete({ tableName: TABLE_USER_PREFERENCES, keys: { userId } });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'DELETE_USER_PREFERENCES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }
}

function mergeAgentStudio(
  existing: StorageUserPreferencesAgentStudio,
  patch: Partial<StorageUserPreferencesAgentStudio> | undefined,
): StorageUserPreferencesAgentStudio {
  if (!patch) return { ...existing };
  return { ...existing, ...patch };
}

function parseRow(row: Record<string, any>): StorageUserPreferencesType {
  return {
    userId: String(row.userId),
    agentStudio: parseJson(row.agentStudio) ?? {},
    metadata: parseJson(row.metadata) ?? undefined,
    createdAt: new Date(String(row.createdAt)),
    updatedAt: new Date(String(row.updatedAt)),
  };
}

function parseJson(val: unknown): any {
  if (val == null) return undefined;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  }
  return val;
}
