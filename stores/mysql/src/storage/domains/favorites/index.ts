import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  FavoritesStorage,
  createStorageErrorId,
  TABLE_AGENTS,
  TABLE_SKILLS,
  TABLE_FAVORITES,
  TABLE_SCHEMAS,
  FAVORITES_SCHEMA,
} from '@mastra/core/storage';
import type {
  CreateIndexOptions,
  StorageDeleteFavoritesForEntityInput,
  StorageIsFavoritedBatchInput,
  StorageListFavoritesInput,
  StorageFavoriteEntityType,
  StorageFavoriteKey,
} from '@mastra/core/storage';
import type { FavoriteToggleResult } from '@mastra/core/storage/domains/favorites';
import type { Pool, RowDataPacket, ResultSetHeader } from 'mysql2/promise';

import type { StoreOperationsMySQL } from '../operations';
import { generateTableSQL } from '../operations';
import { formatTableName, quoteIdentifier } from '../utils';

/**
 * Maps a favorite entity type to its parent entity table.
 */
const ENTITY_TABLE: Record<StorageFavoriteEntityType, typeof TABLE_AGENTS | typeof TABLE_SKILLS> = {
  agent: TABLE_AGENTS,
  skill: TABLE_SKILLS,
};

export class FavoritesMySQL extends FavoritesStorage {
  private pool: Pool;
  private operations: StoreOperationsMySQL;
  #skipDefaultIndexes?: boolean;
  #indexes?: CreateIndexOptions[];

  /** Tables managed by this domain */
  static readonly MANAGED_TABLES = [TABLE_FAVORITES] as const;

  /**
   * Returns default index definitions for the favorites domain tables.
   * Currently no default indexes are defined for favorites.
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
        tableName: TABLE_FAVORITES,
        schema: TABLE_SCHEMAS[TABLE_FAVORITES],
        compositePrimaryKey: ['userId', 'entityType', 'entityId'],
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
    this.#indexes = indexes?.filter(idx => (FavoritesMySQL.MANAGED_TABLES as readonly string[]).includes(idx.table));
  }

  /**
   * Returns default index definitions for the favorites domain tables.
   */
  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    return FavoritesMySQL.getDefaultIndexDefs('');
  }

  /**
   * Creates default indexes for optimal query performance.
   * Currently no default indexes are defined for favorites.
   */
  async createDefaultIndexes(): Promise<void> {
    if (this.#skipDefaultIndexes) return;
    // No default indexes for favorites domain
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
      tableName: TABLE_FAVORITES,
      schema: FAVORITES_SCHEMA,
    });

    // The composite PRIMARY KEY (userId, entityType, entityId) created by createTable
    // already enforces uniqueness for INSERT IGNORE idempotency. No extra unique index needed.

    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.operations.withTransaction(async connection => {
      await connection.execute(`DELETE FROM ${formatTableName(TABLE_FAVORITES)}`);
      // Reset denormalized counters on parent entities
      await connection.execute(
        `UPDATE ${formatTableName(TABLE_AGENTS)} SET ${quoteIdentifier('favoriteCount', 'column name')} = 0 WHERE ${quoteIdentifier('favoriteCount', 'column name')} > 0`,
      );
      await connection.execute(
        `UPDATE ${formatTableName(TABLE_SKILLS)} SET ${quoteIdentifier('favoriteCount', 'column name')} = 0 WHERE ${quoteIdentifier('favoriteCount', 'column name')} > 0`,
      );
    });
  }

  async favorite(input: StorageFavoriteKey): Promise<FavoriteToggleResult> {
    const { userId, entityType, entityId } = input;
    const entityTable = ENTITY_TABLE[entityType];

    try {
      return await this.operations.withTransaction(async connection => {
        // Verify entity exists
        const [entityRows] = await connection.execute<RowDataPacket[]>(
          `SELECT ${quoteIdentifier('favoriteCount', 'column name')} FROM ${formatTableName(entityTable)} WHERE ${quoteIdentifier('id', 'column name')} = ?`,
          [entityId],
        );
        if (!entityRows[0]) {
          throw new MastraError({
            id: createStorageErrorId('MYSQL', 'FAVORITE', 'ENTITY_NOT_FOUND'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            text: `${entityType} ${entityId} not found`,
            details: { entityType, entityId },
          });
        }

        // Idempotent insert using INSERT IGNORE
        const [insertResult] = await connection.execute<ResultSetHeader>(
          `INSERT IGNORE INTO ${formatTableName(TABLE_FAVORITES)} (${quoteIdentifier('userId', 'column name')}, ${quoteIdentifier('entityType', 'column name')}, ${quoteIdentifier('entityId', 'column name')}, ${quoteIdentifier('createdAt', 'column name')}) VALUES (?, ?, ?, ?)`,
          [userId, entityType, entityId, new Date().toISOString()],
        );

        // Only bump counter when we actually inserted a new row
        if (insertResult.affectedRows > 0) {
          await connection.execute(
            `UPDATE ${formatTableName(entityTable)} SET ${quoteIdentifier('favoriteCount', 'column name')} = COALESCE(${quoteIdentifier('favoriteCount', 'column name')}, 0) + 1 WHERE ${quoteIdentifier('id', 'column name')} = ?`,
            [entityId],
          );
        }

        const [afterRows] = await connection.execute<RowDataPacket[]>(
          `SELECT ${quoteIdentifier('favoriteCount', 'column name')} FROM ${formatTableName(entityTable)} WHERE ${quoteIdentifier('id', 'column name')} = ?`,
          [entityId],
        );
        const favoriteCount = Number(afterRows[0]?.favoriteCount ?? 0);

        return { favorited: true, favoriteCount };
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('MYSQL', 'FAVORITE', 'FAILED'),
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
      return await this.operations.withTransaction(async connection => {
        const [entityRows] = await connection.execute<RowDataPacket[]>(
          `SELECT ${quoteIdentifier('favoriteCount', 'column name')} FROM ${formatTableName(entityTable)} WHERE ${quoteIdentifier('id', 'column name')} = ?`,
          [entityId],
        );
        if (!entityRows[0]) {
          throw new MastraError({
            id: createStorageErrorId('MYSQL', 'UNFAVORITE', 'ENTITY_NOT_FOUND'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            text: `${entityType} ${entityId} not found`,
            details: { entityType, entityId },
          });
        }

        const [deleteResult] = await connection.execute<ResultSetHeader>(
          `DELETE FROM ${formatTableName(TABLE_FAVORITES)} WHERE ${quoteIdentifier('userId', 'column name')} = ? AND ${quoteIdentifier('entityType', 'column name')} = ? AND ${quoteIdentifier('entityId', 'column name')} = ?`,
          [userId, entityType, entityId],
        );

        // Only decrement when we actually removed a row, clamp at 0
        if (deleteResult.affectedRows > 0) {
          await connection.execute(
            `UPDATE ${formatTableName(entityTable)} SET ${quoteIdentifier('favoriteCount', 'column name')} = GREATEST(COALESCE(${quoteIdentifier('favoriteCount', 'column name')}, 0) - 1, 0) WHERE ${quoteIdentifier('id', 'column name')} = ?`,
            [entityId],
          );
        }

        const [afterRows] = await connection.execute<RowDataPacket[]>(
          `SELECT ${quoteIdentifier('favoriteCount', 'column name')} FROM ${formatTableName(entityTable)} WHERE ${quoteIdentifier('id', 'column name')} = ?`,
          [entityId],
        );
        const favoriteCount = Number(afterRows[0]?.favoriteCount ?? 0);

        return { favorited: false, favoriteCount };
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('MYSQL', 'UNFAVORITE', 'FAILED'),
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
      const [rows] = await this.pool.execute<RowDataPacket[]>(
        `SELECT 1 FROM ${formatTableName(TABLE_FAVORITES)} WHERE ${quoteIdentifier('userId', 'column name')} = ? AND ${quoteIdentifier('entityType', 'column name')} = ? AND ${quoteIdentifier('entityId', 'column name')} = ? LIMIT 1`,
        [input.userId, input.entityType, input.entityId],
      );
      return rows.length > 0;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('MYSQL', 'IS_FAVORITED', 'FAILED'),
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
      const args = [userId, entityType, ...entityIds];
      const [rows] = await this.pool.execute<RowDataPacket[]>(
        `SELECT ${quoteIdentifier('entityId', 'column name')} FROM ${formatTableName(TABLE_FAVORITES)} WHERE ${quoteIdentifier('userId', 'column name')} = ? AND ${quoteIdentifier('entityType', 'column name')} = ? AND ${quoteIdentifier('entityId', 'column name')} IN (${placeholders})`,
        args,
      );
      const set = new Set<string>();
      for (const row of rows) {
        set.add(row.entityId as string);
      }
      return set;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('MYSQL', 'IS_FAVORITED_BATCH', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async listFavoritedIds(input: StorageListFavoritesInput): Promise<string[]> {
    try {
      const [rows] = await this.pool.execute<RowDataPacket[]>(
        `SELECT ${quoteIdentifier('entityId', 'column name')} FROM ${formatTableName(TABLE_FAVORITES)} WHERE ${quoteIdentifier('userId', 'column name')} = ? AND ${quoteIdentifier('entityType', 'column name')} = ? ORDER BY ${quoteIdentifier('createdAt', 'column name')} DESC, ${quoteIdentifier('entityId', 'column name')} ASC`,
        [input.userId, input.entityType],
      );
      return rows.map(row => row.entityId as string);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('MYSQL', 'LIST_FAVORITED_IDS', 'FAILED'),
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
      return await this.operations.withTransaction(async connection => {
        const [result] = await connection.execute<ResultSetHeader>(
          `DELETE FROM ${formatTableName(TABLE_FAVORITES)} WHERE ${quoteIdentifier('entityType', 'column name')} = ? AND ${quoteIdentifier('entityId', 'column name')} = ?`,
          [input.entityType, input.entityId],
        );
        // Reset the parent entity's favoriteCount
        await connection.execute(
          `UPDATE ${formatTableName(entityTable)} SET ${quoteIdentifier('favoriteCount', 'column name')} = 0 WHERE ${quoteIdentifier('id', 'column name')} = ?`,
          [input.entityId],
        );
        return result.affectedRows;
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('MYSQL', 'DELETE_FAVORITES_FOR_ENTITY', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { entityType: input.entityType, entityId: input.entityId },
        },
        error,
      );
    }
  }
}
