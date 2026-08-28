import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  FavoritesStorage,
  createStorageErrorId,
  TABLE_AGENTS,
  TABLE_SKILLS,
  TABLE_FAVORITES,
  FAVORITES_SCHEMA,
} from '@mastra/core/storage';
import type {
  StorageDeleteFavoritesForEntityInput,
  StorageIsFavoritedBatchInput,
  StorageListFavoritesInput,
  StorageFavoriteEntityType,
  StorageFavoriteKey,
} from '@mastra/core/storage';
import type { FavoriteToggleResult } from '@mastra/core/storage/domains/favorites';

import { LibSQLDB, resolveClient } from '../../db';
import type { LibSQLDomainConfig } from '../../db';
import type { SqliteClient as Client, SqliteInValue as InValue } from '../../db/client';

/**
 * Maps a favorite entity type to its parent entity table.
 */
const ENTITY_TABLE: Record<StorageFavoriteEntityType, typeof TABLE_AGENTS | typeof TABLE_SKILLS> = {
  agent: TABLE_AGENTS,
  skill: TABLE_SKILLS,
};

export class FavoritesLibSQL extends FavoritesStorage {
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
      tableName: TABLE_FAVORITES,
      schema: FAVORITES_SCHEMA,
      compositePrimaryKey: ['userId', 'entityType', 'entityId'],
    });

    // Lookup index for entity-scoped queries (cascade delete, count rebuild).
    await this.#client.execute(
      `CREATE INDEX IF NOT EXISTS idx_favorites_entity ON "${TABLE_FAVORITES}" ("entityType", "entityId")`,
    );
  }

  async dangerouslyClearAll(): Promise<void> {
    const tx = await this.#client.transaction('write');
    try {
      await tx.execute(`DELETE FROM "${TABLE_FAVORITES}"`);
      // Reset denormalized counters on parent entities so reads don't return stale counts.
      await tx.execute(`UPDATE "${TABLE_AGENTS}" SET "favoriteCount" = 0 WHERE "favoriteCount" > 0`);
      await tx.execute(`UPDATE "${TABLE_SKILLS}" SET "favoriteCount" = 0 WHERE "favoriteCount" > 0`);
      await tx.commit();
    } catch (error) {
      if (!tx.closed) {
        await tx.rollback();
      }
      throw error;
    }
  }

  async favorite(input: StorageFavoriteKey): Promise<FavoriteToggleResult> {
    const { userId, entityType, entityId } = input;
    const entityTable = ENTITY_TABLE[entityType];

    try {
      const tx = await this.#client.transaction('write');
      try {
        // Verify entity exists; throw before any mutation if not.
        const entityRow = await tx.execute({
          sql: `SELECT "favoriteCount" FROM "${entityTable}" WHERE id = ?`,
          args: [entityId],
        });
        if (!entityRow.rows?.[0]) {
          throw new MastraError({
            id: createStorageErrorId('LIBSQL', 'FAVORITE', 'ENTITY_NOT_FOUND'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            text: `${entityType} ${entityId} not found`,
            details: { entityType, entityId },
          });
        }

        // Idempotent insert.
        const inserted = await tx.execute({
          sql: `INSERT OR IGNORE INTO "${TABLE_FAVORITES}" ("userId", "entityType", "entityId", "createdAt") VALUES (?, ?, ?, ?)`,
          args: [userId, entityType, entityId, new Date().toISOString()],
        });

        // Only bump counter when we actually inserted a new row.
        if ((inserted.rowsAffected ?? 0) > 0) {
          await tx.execute({
            sql: `UPDATE "${entityTable}" SET "favoriteCount" = COALESCE("favoriteCount", 0) + 1 WHERE id = ?`,
            args: [entityId],
          });
        }

        const after = await tx.execute({
          sql: `SELECT "favoriteCount" FROM "${entityTable}" WHERE id = ?`,
          args: [entityId],
        });
        const favoriteCount = Number(after.rows?.[0]?.favoriteCount ?? 0);

        await tx.commit();
        return { favorited: true, favoriteCount };
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
          id: createStorageErrorId('LIBSQL', 'FAVORITE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { entityType, entityId },
        },
        error,
      );
    }
  }

  async unfavorite(input: StorageFavoriteKey): Promise<FavoriteToggleResult> {
    const { userId, entityType, entityId } = input;
    const entityTable = ENTITY_TABLE[entityType];

    try {
      const tx = await this.#client.transaction('write');
      try {
        const entityRow = await tx.execute({
          sql: `SELECT "favoriteCount" FROM "${entityTable}" WHERE id = ?`,
          args: [entityId],
        });
        if (!entityRow.rows?.[0]) {
          throw new MastraError({
            id: createStorageErrorId('LIBSQL', 'UNFAVORITE', 'ENTITY_NOT_FOUND'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            text: `${entityType} ${entityId} not found`,
            details: { entityType, entityId },
          });
        }

        const deleted = await tx.execute({
          sql: `DELETE FROM "${TABLE_FAVORITES}" WHERE "userId" = ? AND "entityType" = ? AND "entityId" = ?`,
          args: [userId, entityType, entityId],
        });

        // Only decrement when we actually removed a row, clamp at 0.
        if ((deleted.rowsAffected ?? 0) > 0) {
          await tx.execute({
            sql: `UPDATE "${entityTable}" SET "favoriteCount" = MAX(COALESCE("favoriteCount", 0) - 1, 0) WHERE id = ?`,
            args: [entityId],
          });
        }

        const after = await tx.execute({
          sql: `SELECT "favoriteCount" FROM "${entityTable}" WHERE id = ?`,
          args: [entityId],
        });
        const favoriteCount = Number(after.rows?.[0]?.favoriteCount ?? 0);

        await tx.commit();
        return { favorited: false, favoriteCount };
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
          id: createStorageErrorId('LIBSQL', 'UNFAVORITE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { entityType, entityId },
        },
        error,
      );
    }
  }

  async isFavorited(input: StorageFavoriteKey): Promise<boolean> {
    try {
      const result = await this.#client.execute({
        sql: `SELECT 1 FROM "${TABLE_FAVORITES}" WHERE "userId" = ? AND "entityType" = ? AND "entityId" = ? LIMIT 1`,
        args: [input.userId, input.entityType, input.entityId],
      });
      return (result.rows?.length ?? 0) > 0;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'IS_FAVORITED', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async isFavoritedBatch(input: StorageIsFavoritedBatchInput): Promise<Set<string>> {
    const { userId, entityType, entityIds } = input;
    if (entityIds.length === 0) {
      return new Set();
    }

    try {
      const placeholders = entityIds.map(() => '?').join(', ');
      const args: InValue[] = [userId, entityType, ...entityIds];
      const result = await this.#client.execute({
        sql: `SELECT "entityId" FROM "${TABLE_FAVORITES}" WHERE "userId" = ? AND "entityType" = ? AND "entityId" IN (${placeholders})`,
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
          id: createStorageErrorId('LIBSQL', 'IS_FAVORITED_BATCH', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async listFavoritedIds(input: StorageListFavoritesInput): Promise<string[]> {
    try {
      const result = await this.#client.execute({
        sql: `SELECT "entityId" FROM "${TABLE_FAVORITES}" WHERE "userId" = ? AND "entityType" = ? ORDER BY "createdAt" DESC, "entityId" ASC`,
        args: [input.userId, input.entityType],
      });
      return (result.rows ?? []).map(row => row.entityId as string);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'LIST_FAVORITED_IDS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async deleteFavoritesForEntity(input: StorageDeleteFavoritesForEntityInput): Promise<number> {
    const entityTable = ENTITY_TABLE[input.entityType];
    try {
      const tx = await this.#client.transaction('write');
      try {
        const result = await tx.execute({
          sql: `DELETE FROM "${TABLE_FAVORITES}" WHERE "entityType" = ? AND "entityId" = ?`,
          args: [input.entityType, input.entityId],
        });
        // Reset the parent entity's favoriteCount so stale counts don't linger
        // when the entity itself isn't being deleted in the same operation.
        await tx.execute({
          sql: `UPDATE "${entityTable}" SET "favoriteCount" = 0 WHERE id = ?`,
          args: [input.entityId],
        });
        await tx.commit();
        return Number(result.rowsAffected ?? 0);
      } catch (txError) {
        if (!tx.closed) {
          await tx.rollback();
        }
        throw txError;
      }
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'DELETE_FAVORITES_FOR_ENTITY', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { entityType: input.entityType, entityId: input.entityId },
        },
        error,
      );
    }
  }
}
