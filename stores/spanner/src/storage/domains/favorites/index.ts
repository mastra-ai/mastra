import type { Database, Transaction } from '@google-cloud/spanner';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  createStorageErrorId,
  FavoritesStorage,
  TABLE_AGENTS,
  TABLE_FAVORITES,
  TABLE_SKILLS,
  TABLE_SCHEMAS,
} from '@mastra/core/storage';
import type {
  CreateIndexOptions,
  FavoriteToggleResult,
  StorageDeleteFavoritesForEntityInput,
  StorageFavoriteEntityType,
  StorageFavoriteKey,
  StorageIsFavoritedBatchInput,
  StorageListFavoritesInput,
  TABLE_NAMES,
} from '@mastra/core/storage';
import { SpannerDB, resolveSpannerConfig } from '../../db';
import type { SpannerDomainConfig } from '../../db';
import { quoteIdent } from '../../db/utils';

/**
 * Maps a favorite entity type to the parent table whose denormalized
 * `favoriteCount` column the favorites domain keeps in sync.
 */
const ENTITY_TABLE: Record<StorageFavoriteEntityType, TABLE_NAMES> = {
  agent: TABLE_AGENTS,
  skill: TABLE_SKILLS,
};

/**
 * Spanner-backed storage for user favorites.
 *
 * Persists `(userId, entityType, entityId)` rows in `mastra_favorites` (composite
 * primary key) and keeps the denormalized `favoriteCount` on the parent entity
 * (`mastra_agents` / `mastra_skills`) in sync. All mutating operations run inside
 * a single read-write transaction so the favorite row and the counter never drift.
 */
export class FavoritesSpanner extends FavoritesStorage {
  private database: Database;
  private db: SpannerDB;
  private readonly skipDefaultIndexes?: boolean;
  private readonly indexes?: CreateIndexOptions[];

  static readonly MANAGED_TABLES = [TABLE_FAVORITES] as const;

  constructor(config: SpannerDomainConfig) {
    super();
    const { database, indexes, skipDefaultIndexes, initMode } = resolveSpannerConfig(config);
    this.database = database;
    this.db = new SpannerDB({ database, skipDefaultIndexes, initMode });
    this.skipDefaultIndexes = skipDefaultIndexes;
    this.indexes = indexes?.filter(idx => (FavoritesSpanner.MANAGED_TABLES as readonly string[]).includes(idx.table));
  }

  async init(): Promise<void> {
    await this.db.createTable({ tableName: TABLE_FAVORITES, schema: TABLE_SCHEMAS[TABLE_FAVORITES] });
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    return [
      {
        // Supports deleteFavoritesForEntity / counting by entity, and the
        // entity-scoped lookups used by the agents/skills favorited-first JOIN.
        name: 'mastra_favorites_entity_idx',
        table: TABLE_FAVORITES,
        columns: ['entityType', 'entityId'],
      },
    ];
  }

  async createDefaultIndexes(): Promise<void> {
    if (this.skipDefaultIndexes) return;
    await this.db.createIndexes(this.getDefaultIndexDefinitions());
  }

  async createCustomIndexes(): Promise<void> {
    if (!this.indexes || this.indexes.length === 0) return;
    await this.db.createIndexes(this.indexes);
  }

  /**
   * Reads the current `favoriteCount` for the parent entity inside `tx`.
   * Returns `null` when the entity row does not exist.
   */
  private async readEntityCount(tx: Transaction, entityTable: TABLE_NAMES, entityId: string): Promise<number | null> {
    const [rows] = await tx.run({
      sql: `SELECT ${quoteIdent('favoriteCount', 'column name')} AS count
            FROM ${quoteIdent(entityTable, 'table name')}
            WHERE ${quoteIdent('id', 'column name')} = @id LIMIT 1`,
      params: { id: entityId },
      json: true,
    });
    const row = (rows as Array<{ count: number | string | null }>)[0];
    if (!row) return null;
    return Number(row.count ?? 0);
  }

  async favorite(input: StorageFavoriteKey): Promise<FavoriteToggleResult> {
    const { userId, entityType, entityId } = input;
    const entityTable = ENTITY_TABLE[entityType];
    try {
      let favoriteCount = 0;
      await this.db.runWithAbortRetry(() =>
        this.database.runTransactionAsync(async tx => {
          try {
            const existingCount = await this.readEntityCount(tx, entityTable, entityId);
            if (existingCount === null) {
              throw new MastraError({
                id: createStorageErrorId('SPANNER', 'FAVORITE', 'ENTITY_NOT_FOUND'),
                domain: ErrorDomain.STORAGE,
                category: ErrorCategory.USER,
                text: `Cannot favorite ${entityType} "${entityId}": entity does not exist`,
                details: { entityType, entityId },
              });
            }

            const [favRows] = await tx.run({
              sql: `SELECT 1 AS found FROM ${quoteIdent(TABLE_FAVORITES, 'table name')}
                    WHERE ${quoteIdent('userId', 'column name')} = @userId
                      AND ${quoteIdent('entityType', 'column name')} = @entityType
                      AND ${quoteIdent('entityId', 'column name')} = @entityId LIMIT 1`,
              params: { userId, entityType, entityId },
              json: true,
            });

            if ((favRows as unknown[]).length === 0) {
              await this.db.insert({
                tableName: TABLE_FAVORITES,
                record: { userId, entityType, entityId, createdAt: new Date() },
                transaction: tx,
              });
              await tx.runUpdate({
                sql: `UPDATE ${quoteIdent(entityTable, 'table name')}
                      SET ${quoteIdent('favoriteCount', 'column name')} = COALESCE(${quoteIdent('favoriteCount', 'column name')}, 0) + 1
                      WHERE ${quoteIdent('id', 'column name')} = @id`,
                params: { id: entityId },
              });
            }

            favoriteCount = (await this.readEntityCount(tx, entityTable, entityId)) ?? 0;
            await tx.commit();
          } catch (err) {
            await tx.rollback().catch(e => {
              console.warn('Rollback failed', e);
            });
            throw err;
          }
        }),
      );
      return { favorited: true, favoriteCount };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'FAVORITE', 'FAILED'),
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
      let favoriteCount = 0;
      await this.db.runWithAbortRetry(() =>
        this.database.runTransactionAsync(async tx => {
          try {
            const existingCount = await this.readEntityCount(tx, entityTable, entityId);
            if (existingCount === null) {
              throw new MastraError({
                id: createStorageErrorId('SPANNER', 'UNFAVORITE', 'ENTITY_NOT_FOUND'),
                domain: ErrorDomain.STORAGE,
                category: ErrorCategory.USER,
                text: `Cannot unfavorite ${entityType} "${entityId}": entity does not exist`,
                details: { entityType, entityId },
              });
            }

            const [deleted] = await tx.runUpdate({
              sql: `DELETE FROM ${quoteIdent(TABLE_FAVORITES, 'table name')}
                    WHERE ${quoteIdent('userId', 'column name')} = @userId
                      AND ${quoteIdent('entityType', 'column name')} = @entityType
                      AND ${quoteIdent('entityId', 'column name')} = @entityId`,
              params: { userId, entityType, entityId },
            });

            if (Number(deleted ?? 0) > 0) {
              await tx.runUpdate({
                sql: `UPDATE ${quoteIdent(entityTable, 'table name')}
                      SET ${quoteIdent('favoriteCount', 'column name')} = GREATEST(COALESCE(${quoteIdent('favoriteCount', 'column name')}, 0) - 1, 0)
                      WHERE ${quoteIdent('id', 'column name')} = @id`,
                params: { id: entityId },
              });
            }

            favoriteCount = (await this.readEntityCount(tx, entityTable, entityId)) ?? 0;
            await tx.commit();
          } catch (err) {
            await tx.rollback().catch(e => {
              console.warn('Rollback failed', e);
            });
            throw err;
          }
        }),
      );
      return { favorited: false, favoriteCount };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'UNFAVORITE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { entityType, entityId },
        },
        error,
      );
    }
  }

  async isFavorited(input: StorageFavoriteKey): Promise<boolean> {
    const { userId, entityType, entityId } = input;
    try {
      const [rows] = await this.database.run({
        sql: `SELECT 1 AS found FROM ${quoteIdent(TABLE_FAVORITES, 'table name')}
              WHERE ${quoteIdent('userId', 'column name')} = @userId
                AND ${quoteIdent('entityType', 'column name')} = @entityType
                AND ${quoteIdent('entityId', 'column name')} = @entityId LIMIT 1`,
        params: { userId, entityType, entityId },
        json: true,
      });
      return (rows as unknown[]).length > 0;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'IS_FAVORITED', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { entityType, entityId },
        },
        error,
      );
    }
  }

  async isFavoritedBatch(input: StorageIsFavoritedBatchInput): Promise<Set<string>> {
    const { userId, entityType, entityIds } = input;
    if (entityIds.length === 0) return new Set();
    try {
      const params: Record<string, any> = { userId, entityType };
      const placeholders = entityIds.map((id, i) => {
        const param = `e${i}`;
        params[param] = id;
        return `@${param}`;
      });
      const [rows] = await this.database.run({
        sql: `SELECT ${quoteIdent('entityId', 'column name')} AS entityId
              FROM ${quoteIdent(TABLE_FAVORITES, 'table name')}
              WHERE ${quoteIdent('userId', 'column name')} = @userId
                AND ${quoteIdent('entityType', 'column name')} = @entityType
                AND ${quoteIdent('entityId', 'column name')} IN (${placeholders.join(', ')})`,
        params,
        json: true,
      });
      return new Set((rows as Array<{ entityId: string }>).map(r => r.entityId));
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'IS_FAVORITED_BATCH', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { entityType },
        },
        error,
      );
    }
  }

  async listFavoritedIds(input: StorageListFavoritesInput): Promise<string[]> {
    const { userId, entityType } = input;
    try {
      const [rows] = await this.database.run({
        sql: `SELECT ${quoteIdent('entityId', 'column name')} AS entityId
              FROM ${quoteIdent(TABLE_FAVORITES, 'table name')}
              WHERE ${quoteIdent('userId', 'column name')} = @userId
                AND ${quoteIdent('entityType', 'column name')} = @entityType
              ORDER BY ${quoteIdent('createdAt', 'column name')} DESC, ${quoteIdent('entityId', 'column name')} ASC`,
        params: { userId, entityType },
        json: true,
      });
      return (rows as Array<{ entityId: string }>).map(r => r.entityId);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'LIST_FAVORITED_IDS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { entityType },
        },
        error,
      );
    }
  }

  async deleteFavoritesForEntity(input: StorageDeleteFavoritesForEntityInput): Promise<number> {
    const { entityType, entityId } = input;
    const entityTable = ENTITY_TABLE[entityType];
    try {
      let removed = 0;
      await this.db.runWithAbortRetry(() =>
        this.database.runTransactionAsync(async tx => {
          try {
            const [count] = await tx.runUpdate({
              sql: `DELETE FROM ${quoteIdent(TABLE_FAVORITES, 'table name')}
                    WHERE ${quoteIdent('entityType', 'column name')} = @entityType
                      AND ${quoteIdent('entityId', 'column name')} = @entityId`,
              params: { entityType, entityId },
            });
            removed = Number(count ?? 0);
            // Reset the denormalized counter; no-ops when the entity row is gone.
            await tx.runUpdate({
              sql: `UPDATE ${quoteIdent(entityTable, 'table name')}
                    SET ${quoteIdent('favoriteCount', 'column name')} = 0
                    WHERE ${quoteIdent('id', 'column name')} = @id`,
              params: { id: entityId },
            });
            await tx.commit();
          } catch (err) {
            await tx.rollback().catch(e => {
              console.warn('Rollback failed', e);
            });
            throw err;
          }
        }),
      );
      return removed;
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'DELETE_FAVORITES_FOR_ENTITY', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { entityType, entityId },
        },
        error,
      );
    }
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.db.clearTable({ tableName: TABLE_FAVORITES });
    // Reset denormalized counters on parent entities. These tables may not exist
    // when favorites is used standalone, so failures are swallowed.
    for (const table of [TABLE_AGENTS, TABLE_SKILLS]) {
      try {
        await this.db.runDml({
          sql: `UPDATE ${quoteIdent(table, 'table name')}
                SET ${quoteIdent('favoriteCount', 'column name')} = 0
                WHERE ${quoteIdent('favoriteCount', 'column name')} > 0`,
        });
      } catch {
        // Parent table absent in standalone favorites usage — nothing to reset.
      }
    }
  }
}
