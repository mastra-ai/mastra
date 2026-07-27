import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  FavoritesStorage,
  createStorageErrorId,
  TABLE_AGENTS,
  TABLE_SKILLS,
  TABLE_FAVORITES,
  TABLE_SCHEMAS,
} from '@mastra/core/storage';
import type {
  StorageDeleteFavoritesForEntityInput,
  StorageIsFavoritedBatchInput,
  StorageListFavoritesInput,
  StorageFavoriteEntityType,
  StorageFavoriteKey,
} from '@mastra/core/storage';
import type { FavoriteToggleResult } from '@mastra/core/storage/domains/favorites';

import { PgDB, resolvePgConfig, generateTableSQL } from '../../db';
import type { PgDomainConfig } from '../../db';
import { getTableName, getSchemaName } from '../utils';

/**
 * Maps a favorite entity type to its parent entity table.
 */
const ENTITY_TABLE: Record<StorageFavoriteEntityType, typeof TABLE_AGENTS | typeof TABLE_SKILLS> = {
  agent: TABLE_AGENTS,
  skill: TABLE_SKILLS,
};

export class FavoritesPG extends FavoritesStorage {
  #db: PgDB;
  #schema: string;

  static readonly MANAGED_TABLES = [TABLE_FAVORITES] as const;

  constructor(config: PgDomainConfig) {
    super();
    const { client, schemaName, skipDefaultIndexes } = resolvePgConfig(config);
    this.#db = new PgDB({ client, schemaName, skipDefaultIndexes });
    this.#schema = schemaName || 'public';
  }

  static getExportDDL(schemaName?: string): string[] {
    const statements: string[] = [];
    for (const tableName of FavoritesPG.MANAGED_TABLES) {
      statements.push(
        generateTableSQL({
          tableName,
          schema: TABLE_SCHEMAS[tableName],
          schemaName,
          compositePrimaryKey: ['userId', 'entityType', 'entityId'],
          includeAllConstraints: true,
        }),
      );
    }
    // Lookup index for entity-scoped queries — must mirror init().
    const fullFavoritesTable = getTableName({ indexName: TABLE_FAVORITES, schemaName: getSchemaName(schemaName) });
    statements.push(
      `CREATE INDEX IF NOT EXISTS idx_favorites_entity ON ${fullFavoritesTable} ("entityType", "entityId");`,
    );
    return statements;
  }

  async init(): Promise<void> {
    await this.#db.createTable({
      tableName: TABLE_FAVORITES,
      schema: TABLE_SCHEMAS[TABLE_FAVORITES],
      compositePrimaryKey: ['userId', 'entityType', 'entityId'],
    });

    // Lookup index for entity-scoped queries (cascade delete, count rebuild).
    const fullTableName = getTableName({ indexName: TABLE_FAVORITES, schemaName: getSchemaName(this.#schema) });
    await this.#db.client.none(
      `CREATE INDEX IF NOT EXISTS idx_favorites_entity ON ${fullTableName} ("entityType", "entityId")`,
    );
  }

  async dangerouslyClearAll(): Promise<void> {
    const fullTableName = getTableName({ indexName: TABLE_FAVORITES, schemaName: getSchemaName(this.#schema) });
    const fullAgentsTable = getTableName({ indexName: TABLE_AGENTS, schemaName: getSchemaName(this.#schema) });
    const fullSkillsTable = getTableName({ indexName: TABLE_SKILLS, schemaName: getSchemaName(this.#schema) });
    await this.#db.client.tx(async t => {
      await t.none(`DELETE FROM ${fullTableName}`);
      // Reset denormalized counters on parent entities so reads don't return stale counts.
      await t.none(`UPDATE ${fullAgentsTable} SET "favoriteCount" = 0 WHERE "favoriteCount" > 0`);
      await t.none(`UPDATE ${fullSkillsTable} SET "favoriteCount" = 0 WHERE "favoriteCount" > 0`);
    });
  }

  async favorite(input: StorageFavoriteKey): Promise<FavoriteToggleResult> {
    const { userId, entityType, entityId } = input;
    const entityTable = ENTITY_TABLE[entityType];
    const fullFavoritesTable = getTableName({ indexName: TABLE_FAVORITES, schemaName: getSchemaName(this.#schema) });
    const fullEntityTable = getTableName({ indexName: entityTable, schemaName: getSchemaName(this.#schema) });

    try {
      return await this.#db.client.tx(async t => {
        // Verify entity exists; throw before any mutation if not.
        const entityRow = await t.oneOrNone(`SELECT "favoriteCount" FROM ${fullEntityTable} WHERE id = $1`, [entityId]);
        if (!entityRow) {
          throw new MastraError({
            id: createStorageErrorId('PG', 'FAVORITE', 'ENTITY_NOT_FOUND'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            text: `${entityType} ${entityId} not found`,
            details: { entityType, entityId },
          });
        }

        // Idempotent insert.
        const inserted = await t.oneOrNone(
          `INSERT INTO ${fullFavoritesTable} ("userId", "entityType", "entityId", "createdAt", "createdAtZ")
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT ("userId", "entityType", "entityId") DO NOTHING
           RETURNING "userId"`,
          [userId, entityType, entityId, new Date().toISOString(), new Date().toISOString()],
        );

        if (inserted) {
          await t.none(
            `UPDATE ${fullEntityTable} SET "favoriteCount" = COALESCE("favoriteCount", 0) + 1 WHERE id = $1`,
            [entityId],
          );
        }

        const after = await t.one(`SELECT "favoriteCount" FROM ${fullEntityTable} WHERE id = $1`, [entityId]);
        const favoriteCount = Number(after.favoriteCount ?? 0);
        return { favorited: true, favoriteCount };
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'FAVORITE', 'FAILED'),
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
    const fullFavoritesTable = getTableName({ indexName: TABLE_FAVORITES, schemaName: getSchemaName(this.#schema) });
    const fullEntityTable = getTableName({ indexName: entityTable, schemaName: getSchemaName(this.#schema) });

    try {
      return await this.#db.client.tx(async t => {
        const entityRow = await t.oneOrNone(`SELECT "favoriteCount" FROM ${fullEntityTable} WHERE id = $1`, [entityId]);
        if (!entityRow) {
          throw new MastraError({
            id: createStorageErrorId('PG', 'UNFAVORITE', 'ENTITY_NOT_FOUND'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            text: `${entityType} ${entityId} not found`,
            details: { entityType, entityId },
          });
        }

        const deleted = await t.oneOrNone(
          `DELETE FROM ${fullFavoritesTable} WHERE "userId" = $1 AND "entityType" = $2 AND "entityId" = $3 RETURNING "userId"`,
          [userId, entityType, entityId],
        );

        if (deleted) {
          await t.none(
            `UPDATE ${fullEntityTable} SET "favoriteCount" = GREATEST(COALESCE("favoriteCount", 0) - 1, 0) WHERE id = $1`,
            [entityId],
          );
        }

        const after = await t.one(`SELECT "favoriteCount" FROM ${fullEntityTable} WHERE id = $1`, [entityId]);
        const favoriteCount = Number(after.favoriteCount ?? 0);
        return { favorited: false, favoriteCount };
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'UNFAVORITE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { entityType, entityId },
        },
        error,
      );
    }
  }

  async isFavorited(input: StorageFavoriteKey): Promise<boolean> {
    const fullFavoritesTable = getTableName({ indexName: TABLE_FAVORITES, schemaName: getSchemaName(this.#schema) });
    try {
      const result = await this.#db.client.oneOrNone(
        `SELECT 1 FROM ${fullFavoritesTable} WHERE "userId" = $1 AND "entityType" = $2 AND "entityId" = $3 LIMIT 1`,
        [input.userId, input.entityType, input.entityId],
      );
      return result !== null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'IS_FAVORITED', 'FAILED'),
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
    const fullFavoritesTable = getTableName({ indexName: TABLE_FAVORITES, schemaName: getSchemaName(this.#schema) });
    try {
      const placeholders = entityIds.map((_, i) => `$${i + 3}`).join(', ');
      const rows = await this.#db.client.manyOrNone<{ entityId: string }>(
        `SELECT "entityId" FROM ${fullFavoritesTable} WHERE "userId" = $1 AND "entityType" = $2 AND "entityId" IN (${placeholders})`,
        [userId, entityType, ...entityIds],
      );
      const set = new Set<string>();
      for (const row of rows ?? []) {
        set.add(row.entityId);
      }
      return set;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'IS_FAVORITED_BATCH', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async listFavoritedIds(input: StorageListFavoritesInput): Promise<string[]> {
    const fullFavoritesTable = getTableName({ indexName: TABLE_FAVORITES, schemaName: getSchemaName(this.#schema) });
    try {
      const rows = await this.#db.client.manyOrNone<{ entityId: string }>(
        `SELECT "entityId" FROM ${fullFavoritesTable} WHERE "userId" = $1 AND "entityType" = $2 ORDER BY "createdAt" DESC, "entityId" ASC`,
        [input.userId, input.entityType],
      );
      return (rows ?? []).map(row => row.entityId);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'LIST_FAVORITED_IDS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async deleteFavoritesForEntity(input: StorageDeleteFavoritesForEntityInput): Promise<number> {
    const fullFavoritesTable = getTableName({ indexName: TABLE_FAVORITES, schemaName: getSchemaName(this.#schema) });
    const entityTable = ENTITY_TABLE[input.entityType];
    const fullEntityTable = getTableName({ indexName: entityTable, schemaName: getSchemaName(this.#schema) });
    try {
      return await this.#db.client.tx(async t => {
        // Use a CTE so the server returns the count without materializing each
        // deleted row. For a hot cascade path this is meaningfully cheaper than
        // round-tripping every userId back to the client.
        const result = await t.one<{ count: string }>(
          `WITH deleted AS (
             DELETE FROM ${fullFavoritesTable} WHERE "entityType" = $1 AND "entityId" = $2 RETURNING 1
           )
           SELECT COUNT(*)::text AS count FROM deleted`,
          [input.entityType, input.entityId],
        );
        // Reset the parent entity's favoriteCount so stale counts don't linger
        // when the entity itself isn't being deleted in the same operation.
        await t.none(`UPDATE ${fullEntityTable} SET "favoriteCount" = 0 WHERE id = $1`, [input.entityId]);
        return Number(result.count);
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'DELETE_FAVORITES_FOR_ENTITY', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { entityType: input.entityType, entityId: input.entityId },
        },
        error,
      );
    }
  }
}
