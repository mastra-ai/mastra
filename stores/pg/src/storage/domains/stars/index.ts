import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  StarsStorage,
  createStorageErrorId,
  TABLE_AGENTS,
  TABLE_SKILLS,
  TABLE_STARS,
  TABLE_SCHEMAS,
} from '@mastra/core/storage';
import type {
  StorageDeleteStarsForEntityInput,
  StorageIsStarredBatchInput,
  StorageListStarsInput,
  StorageStarEntityType,
  StorageStarKey,
} from '@mastra/core/storage';
import type { StarToggleResult } from '@mastra/core/storage/domains/stars';

import { PgDB, resolvePgConfig, generateTableSQL } from '../../db';
import type { PgDomainConfig } from '../../db';
import { getTableName, getSchemaName } from '../utils';

/**
 * Maps a star entity type to its parent entity table.
 */
const ENTITY_TABLE: Record<StorageStarEntityType, typeof TABLE_AGENTS | typeof TABLE_SKILLS> = {
  agent: TABLE_AGENTS,
  skill: TABLE_SKILLS,
};

export class StarsPG extends StarsStorage {
  #db: PgDB;
  #schema: string;

  static readonly MANAGED_TABLES = [TABLE_STARS] as const;

  constructor(config: PgDomainConfig) {
    super();
    const { client, schemaName, skipDefaultIndexes } = resolvePgConfig(config);
    this.#db = new PgDB({ client, schemaName, skipDefaultIndexes });
    this.#schema = schemaName || 'public';
  }

  static getExportDDL(schemaName?: string): string[] {
    const statements: string[] = [];
    for (const tableName of StarsPG.MANAGED_TABLES) {
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
    const fullStarsTable = getTableName({ indexName: TABLE_STARS, schemaName: getSchemaName(schemaName) });
    statements.push(`CREATE INDEX IF NOT EXISTS idx_stars_entity ON ${fullStarsTable} ("entityType", "entityId")`);
    return statements;
  }

  async init(): Promise<void> {
    await this.#db.createTable({
      tableName: TABLE_STARS,
      schema: TABLE_SCHEMAS[TABLE_STARS],
      compositePrimaryKey: ['userId', 'entityType', 'entityId'],
    });

    // Lookup index for entity-scoped queries (cascade delete, count rebuild).
    const fullTableName = getTableName({ indexName: TABLE_STARS, schemaName: getSchemaName(this.#schema) });
    await this.#db.client.none(
      `CREATE INDEX IF NOT EXISTS idx_stars_entity ON ${fullTableName} ("entityType", "entityId")`,
    );
  }

  async dangerouslyClearAll(): Promise<void> {
    const fullTableName = getTableName({ indexName: TABLE_STARS, schemaName: getSchemaName(this.#schema) });
    await this.#db.client.none(`DELETE FROM ${fullTableName}`);
  }

  async star(input: StorageStarKey): Promise<StarToggleResult> {
    const { userId, entityType, entityId } = input;
    const entityTable = ENTITY_TABLE[entityType];
    const fullStarsTable = getTableName({ indexName: TABLE_STARS, schemaName: getSchemaName(this.#schema) });
    const fullEntityTable = getTableName({ indexName: entityTable, schemaName: getSchemaName(this.#schema) });

    try {
      return await this.#db.client.tx(async t => {
        // Verify entity exists; throw before any mutation if not.
        const entityRow = await t.oneOrNone(`SELECT "starCount" FROM ${fullEntityTable} WHERE id = $1`, [entityId]);
        if (!entityRow) {
          throw new MastraError({
            id: createStorageErrorId('PG', 'STAR', 'ENTITY_NOT_FOUND'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            text: `${entityType} ${entityId} not found`,
            details: { entityType, entityId },
          });
        }

        // Idempotent insert.
        const inserted = await t.oneOrNone(
          `INSERT INTO ${fullStarsTable} ("userId", "entityType", "entityId", "createdAt", "createdAtZ")
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT ("userId", "entityType", "entityId") DO NOTHING
           RETURNING "userId"`,
          [userId, entityType, entityId, new Date().toISOString(), new Date().toISOString()],
        );

        if (inserted) {
          await t.none(`UPDATE ${fullEntityTable} SET "starCount" = COALESCE("starCount", 0) + 1 WHERE id = $1`, [
            entityId,
          ]);
        }

        const after = await t.one(`SELECT "starCount" FROM ${fullEntityTable} WHERE id = $1`, [entityId]);
        const starCount = Number(after.starCount ?? 0);
        return { starred: true, starCount };
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'STAR', 'FAILED'),
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
    const fullStarsTable = getTableName({ indexName: TABLE_STARS, schemaName: getSchemaName(this.#schema) });
    const fullEntityTable = getTableName({ indexName: entityTable, schemaName: getSchemaName(this.#schema) });

    try {
      return await this.#db.client.tx(async t => {
        const entityRow = await t.oneOrNone(`SELECT "starCount" FROM ${fullEntityTable} WHERE id = $1`, [entityId]);
        if (!entityRow) {
          throw new MastraError({
            id: createStorageErrorId('PG', 'UNSTAR', 'ENTITY_NOT_FOUND'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.USER,
            text: `${entityType} ${entityId} not found`,
            details: { entityType, entityId },
          });
        }

        const deleted = await t.oneOrNone(
          `DELETE FROM ${fullStarsTable} WHERE "userId" = $1 AND "entityType" = $2 AND "entityId" = $3 RETURNING "userId"`,
          [userId, entityType, entityId],
        );

        if (deleted) {
          await t.none(
            `UPDATE ${fullEntityTable} SET "starCount" = GREATEST(COALESCE("starCount", 0) - 1, 0) WHERE id = $1`,
            [entityId],
          );
        }

        const after = await t.one(`SELECT "starCount" FROM ${fullEntityTable} WHERE id = $1`, [entityId]);
        const starCount = Number(after.starCount ?? 0);
        return { starred: false, starCount };
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'UNSTAR', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { entityType, entityId },
        },
        error,
      );
    }
  }

  async isStarred(input: StorageStarKey): Promise<boolean> {
    const fullStarsTable = getTableName({ indexName: TABLE_STARS, schemaName: getSchemaName(this.#schema) });
    try {
      const result = await this.#db.client.oneOrNone(
        `SELECT 1 FROM ${fullStarsTable} WHERE "userId" = $1 AND "entityType" = $2 AND "entityId" = $3 LIMIT 1`,
        [input.userId, input.entityType, input.entityId],
      );
      return result !== null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'IS_STARRED', 'FAILED'),
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
    const fullStarsTable = getTableName({ indexName: TABLE_STARS, schemaName: getSchemaName(this.#schema) });
    try {
      const placeholders = entityIds.map((_, i) => `$${i + 3}`).join(', ');
      const rows = await this.#db.client.manyOrNone<{ entityId: string }>(
        `SELECT "entityId" FROM ${fullStarsTable} WHERE "userId" = $1 AND "entityType" = $2 AND "entityId" IN (${placeholders})`,
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
          id: createStorageErrorId('PG', 'IS_STARRED_BATCH', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async listStarredIds(input: StorageListStarsInput): Promise<string[]> {
    const fullStarsTable = getTableName({ indexName: TABLE_STARS, schemaName: getSchemaName(this.#schema) });
    try {
      const rows = await this.#db.client.manyOrNone<{ entityId: string }>(
        `SELECT "entityId" FROM ${fullStarsTable} WHERE "userId" = $1 AND "entityType" = $2 ORDER BY "createdAt" DESC, "entityId" ASC`,
        [input.userId, input.entityType],
      );
      return (rows ?? []).map(row => row.entityId);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'LIST_STARRED_IDS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async deleteStarsForEntity(input: StorageDeleteStarsForEntityInput): Promise<number> {
    const fullStarsTable = getTableName({ indexName: TABLE_STARS, schemaName: getSchemaName(this.#schema) });
    try {
      // Use a CTE so the server returns the count without materializing each
      // deleted row. For a hot cascade path this is meaningfully cheaper than
      // round-tripping every userId back to the client.
      const result = await this.#db.client.one<{ count: string }>(
        `WITH deleted AS (
           DELETE FROM ${fullStarsTable} WHERE "entityType" = $1 AND "entityId" = $2 RETURNING 1
         )
         SELECT COUNT(*)::text AS count FROM deleted`,
        [input.entityType, input.entityId],
      );
      return Number(result.count);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'DELETE_STARS_FOR_ENTITY', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { entityType: input.entityType, entityId: input.entityId },
        },
        error,
      );
    }
  }
}
