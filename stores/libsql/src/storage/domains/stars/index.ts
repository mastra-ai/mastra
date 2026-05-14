import type { Client, InValue } from '@libsql/client';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  StarsStorage,
  createStorageErrorId,
  TABLE_AGENTS,
  TABLE_SKILLS,
  TABLE_STARS,
  STARS_SCHEMA,
} from '@mastra/core/storage';
import type {
  StorageDeleteStarsForEntityInput,
  StorageIsStarredBatchInput,
  StorageListStarsInput,
  StorageStarEntityType,
  StorageStarKey,
} from '@mastra/core/storage';
import type { StarToggleResult } from '@mastra/core/storage/domains/stars';

import { LibSQLDB, resolveClient } from '../../db';
import type { LibSQLDomainConfig } from '../../db';

/**
 * Maps a star entity type to its parent entity table.
 */
const ENTITY_TABLE: Record<StorageStarEntityType, typeof TABLE_AGENTS | typeof TABLE_SKILLS> = {
  agent: TABLE_AGENTS,
  skill: TABLE_SKILLS,
};

export class StarsLibSQL extends StarsStorage {
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
      tableName: TABLE_STARS,
      schema: STARS_SCHEMA,
      compositePrimaryKey: ['userId', 'entityType', 'entityId'],
    });

    // Lookup index for entity-scoped queries (cascade delete, count rebuild).
    await this.#client.execute(
      `CREATE INDEX IF NOT EXISTS idx_stars_entity ON "${TABLE_STARS}" ("entityType", "entityId")`,
    );
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.deleteData({ tableName: TABLE_STARS });
  }

  async star(input: StorageStarKey): Promise<StarToggleResult> {
    const { userId, entityType, entityId } = input;
    const entityTable = ENTITY_TABLE[entityType];

    try {
      const tx = await this.#client.transaction('write');
      try {
        // Verify entity exists; throw before any mutation if not.
        const entityRow = await tx.execute({
          sql: `SELECT "starCount" FROM "${entityTable}" WHERE id = ?`,
          args: [entityId],
        });
        if (!entityRow.rows?.[0]) {
          throw new MastraError({
            id: createStorageErrorId('LIBSQL', 'STAR', 'ENTITY_NOT_FOUND'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            text: `${entityType} ${entityId} not found`,
            details: { entityType, entityId },
          });
        }

        // Idempotent insert.
        const inserted = await tx.execute({
          sql: `INSERT OR IGNORE INTO "${TABLE_STARS}" ("userId", "entityType", "entityId", "createdAt") VALUES (?, ?, ?, ?)`,
          args: [userId, entityType, entityId, new Date().toISOString()],
        });

        // Only bump counter when we actually inserted a new row.
        if ((inserted.rowsAffected ?? 0) > 0) {
          await tx.execute({
            sql: `UPDATE "${entityTable}" SET "starCount" = COALESCE("starCount", 0) + 1 WHERE id = ?`,
            args: [entityId],
          });
        }

        const after = await tx.execute({
          sql: `SELECT "starCount" FROM "${entityTable}" WHERE id = ?`,
          args: [entityId],
        });
        const starCount = Number(after.rows?.[0]?.starCount ?? 0);

        await tx.commit();
        return { starred: true, starCount };
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
          id: createStorageErrorId('LIBSQL', 'STAR', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { entityType, entityId },
        },
        error,
      );
    }
  }

  async unstar(input: StorageStarKey): Promise<StarToggleResult> {
    const { userId, entityType, entityId } = input;
    const entityTable = ENTITY_TABLE[entityType];

    try {
      const tx = await this.#client.transaction('write');
      try {
        const entityRow = await tx.execute({
          sql: `SELECT "starCount" FROM "${entityTable}" WHERE id = ?`,
          args: [entityId],
        });
        if (!entityRow.rows?.[0]) {
          throw new MastraError({
            id: createStorageErrorId('LIBSQL', 'UNSTAR', 'ENTITY_NOT_FOUND'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            text: `${entityType} ${entityId} not found`,
            details: { entityType, entityId },
          });
        }

        const deleted = await tx.execute({
          sql: `DELETE FROM "${TABLE_STARS}" WHERE "userId" = ? AND "entityType" = ? AND "entityId" = ?`,
          args: [userId, entityType, entityId],
        });

        // Only decrement when we actually removed a row, clamp at 0.
        if ((deleted.rowsAffected ?? 0) > 0) {
          await tx.execute({
            sql: `UPDATE "${entityTable}" SET "starCount" = MAX(COALESCE("starCount", 0) - 1, 0) WHERE id = ?`,
            args: [entityId],
          });
        }

        const after = await tx.execute({
          sql: `SELECT "starCount" FROM "${entityTable}" WHERE id = ?`,
          args: [entityId],
        });
        const starCount = Number(after.rows?.[0]?.starCount ?? 0);

        await tx.commit();
        return { starred: false, starCount };
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
          id: createStorageErrorId('LIBSQL', 'UNSTAR', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { entityType, entityId },
        },
        error,
      );
    }
  }

  async isStarred(input: StorageStarKey): Promise<boolean> {
    try {
      const result = await this.#client.execute({
        sql: `SELECT 1 FROM "${TABLE_STARS}" WHERE "userId" = ? AND "entityType" = ? AND "entityId" = ? LIMIT 1`,
        args: [input.userId, input.entityType, input.entityId],
      });
      return (result.rows?.length ?? 0) > 0;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'IS_STARRED', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async isStarredBatch(input: StorageIsStarredBatchInput): Promise<Set<string>> {
    const { userId, entityType, entityIds } = input;
    if (entityIds.length === 0) {
      return new Set();
    }

    try {
      const placeholders = entityIds.map(() => '?').join(', ');
      const args: InValue[] = [userId, entityType, ...entityIds];
      const result = await this.#client.execute({
        sql: `SELECT "entityId" FROM "${TABLE_STARS}" WHERE "userId" = ? AND "entityType" = ? AND "entityId" IN (${placeholders})`,
        args,
      });
      const set = new Set<string>();
      for (const row of result.rows ?? []) {
        set.add(row.entityId as string);
      }
      return set;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'IS_STARRED_BATCH', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async listStarredIds(input: StorageListStarsInput): Promise<string[]> {
    try {
      const result = await this.#client.execute({
        sql: `SELECT "entityId" FROM "${TABLE_STARS}" WHERE "userId" = ? AND "entityType" = ? ORDER BY "createdAt" DESC, "entityId" ASC`,
        args: [input.userId, input.entityType],
      });
      return (result.rows ?? []).map(row => row.entityId as string);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'LIST_STARRED_IDS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async deleteStarsForEntity(input: StorageDeleteStarsForEntityInput): Promise<number> {
    try {
      const result = await this.#client.execute({
        sql: `DELETE FROM "${TABLE_STARS}" WHERE "entityType" = ? AND "entityId" = ?`,
        args: [input.entityType, input.entityId],
      });
      return Number(result.rowsAffected ?? 0);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'DELETE_STARS_FOR_ENTITY', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { entityType: input.entityType, entityId: input.entityId },
        },
        error,
      );
    }
  }
}
