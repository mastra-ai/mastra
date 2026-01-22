import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  StoredScorersStorage,
  createStorageErrorId,
  normalizePerPage,
  calculatePagination,
  TABLE_STORED_SCORERS,
  TABLE_STORED_SCORER_VERSIONS,
  TABLE_SCHEMAS,
} from '@mastra/core/storage';
import type {
  StoredScorerType,
  StorageCreateScorerInput,
  StorageUpdateScorerInput,
  StorageListScorersInput,
  StorageListScorersOutput,
  CreateIndexOptions,
  StoredScorerVersionType,
  StorageCreateScorerVersionInput,
  ListScorerVersionsInput,
  ListScorerVersionsOutput,
} from '@mastra/core/storage';
import { PgDB, resolvePgConfig } from '../../db';
import type { PgDomainConfig } from '../../db';
import { getTableName, getSchemaName } from '../utils';

export class StoredScorersPG extends StoredScorersStorage {
  #db: PgDB;
  #schema: string;
  #skipDefaultIndexes?: boolean;
  #indexes?: CreateIndexOptions[];

  /** Tables managed by this domain */
  static readonly MANAGED_TABLES = [TABLE_STORED_SCORERS, TABLE_STORED_SCORER_VERSIONS] as const;

  constructor(config: PgDomainConfig) {
    super();
    const { client, schemaName, skipDefaultIndexes, indexes } = resolvePgConfig(config);
    this.#db = new PgDB({ client, schemaName, skipDefaultIndexes });
    this.#schema = schemaName || 'public';
    this.#skipDefaultIndexes = skipDefaultIndexes;
    // Filter indexes to only those for tables managed by this domain
    this.#indexes = indexes?.filter(idx => (StoredScorersPG.MANAGED_TABLES as readonly string[]).includes(idx.table));
  }

  /**
   * Returns default index definitions for the stored scorers domain tables.
   */
  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    return [
      {
        name: 'idx_stored_scorers_owner_id',
        table: TABLE_STORED_SCORERS,
        columns: ['ownerId'],
      },
      {
        name: 'idx_stored_scorer_versions_scorer_id',
        table: TABLE_STORED_SCORER_VERSIONS,
        columns: ['scorerId'],
      },
      {
        name: 'idx_stored_scorer_versions_scorer_version',
        table: TABLE_STORED_SCORER_VERSIONS,
        columns: ['scorerId', 'versionNumber'],
        unique: true,
      },
    ];
  }

  /**
   * Creates default indexes for optimal query performance.
   */
  async createDefaultIndexes(): Promise<void> {
    if (this.#skipDefaultIndexes) {
      return;
    }

    const defaultIndexes = this.getDefaultIndexDefinitions();
    for (const indexDef of defaultIndexes) {
      try {
        await this.#db.createIndex(indexDef);
      } catch (error) {
        // Log but continue - indexes are performance optimizations
        this.logger?.warn?.(`Failed to create default index ${indexDef.name}:`, error);
      }
    }
  }

  async init(): Promise<void> {
    // Create stored scorers table
    await this.#db.createTable({
      tableName: TABLE_STORED_SCORERS,
      schema: TABLE_SCHEMAS[TABLE_STORED_SCORERS],
    });

    // Create stored scorer versions table
    await this.#db.createTable({
      tableName: TABLE_STORED_SCORER_VERSIONS,
      schema: TABLE_SCHEMAS[TABLE_STORED_SCORER_VERSIONS],
    });

    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  /**
   * Creates custom user-defined indexes for this domain's tables.
   */
  async createCustomIndexes(): Promise<void> {
    if (!this.#indexes || this.#indexes.length === 0) {
      return;
    }

    for (const indexDef of this.#indexes) {
      try {
        await this.#db.createIndex(indexDef);
      } catch (error) {
        // Log but continue - indexes are performance optimizations
        this.logger?.warn?.(`Failed to create custom index ${indexDef.name}:`, error);
      }
    }
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.clearTable({ tableName: TABLE_STORED_SCORER_VERSIONS });
    await this.#db.clearTable({ tableName: TABLE_STORED_SCORERS });
  }

  private parseJson(value: any, fieldName?: string): any {
    if (!value) return undefined;
    if (typeof value !== 'string') return value;

    try {
      return JSON.parse(value);
    } catch (error) {
      const details: Record<string, string> = {
        value: value.length > 100 ? value.substring(0, 100) + '...' : value,
      };
      if (fieldName) {
        details.field = fieldName;
      }

      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'PARSE_JSON', 'INVALID_JSON'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.SYSTEM,
          text: `Failed to parse JSON${fieldName ? ` for field "${fieldName}"` : ''}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          details,
        },
        error,
      );
    }
  }

  private parseScorerRow(row: any): StoredScorerType {
    return {
      id: row.id as string,
      name: row.name as string,
      description: row.description as string | undefined,
      model: this.parseJson(row.model, 'model'),
      prompt: row.prompt as string,
      scoreRange: this.parseJson(row.scoreRange, 'scoreRange'),
      metadata: this.parseJson(row.metadata, 'metadata'),
      ownerId: row.ownerId as string | undefined,
      activeVersionId: row.activeVersionId as string | undefined,
      createdAt: new Date(row.createdAtZ || row.createdAt),
      updatedAt: new Date(row.updatedAtZ || row.updatedAt),
    };
  }

  private parseScorerVersionRow(row: any): StoredScorerVersionType {
    return {
      id: row.id as string,
      scorerId: row.scorerId as string,
      versionNumber: row.versionNumber as number,
      name: row.name as string | undefined,
      snapshot: this.parseJson(row.snapshot, 'snapshot'),
      changedFields: this.parseJson(row.changedFields, 'changedFields'),
      changeMessage: row.changeMessage as string | undefined,
      createdAt: new Date(row.createdAtZ || row.createdAt),
    };
  }

  async createScorer({ scorer }: { scorer: StorageCreateScorerInput }): Promise<StoredScorerType> {
    try {
      const tableName = getTableName({
        indexName: TABLE_STORED_SCORERS,
        schemaName: getSchemaName(this.#schema),
      });

      const now = new Date();
      const result = await this.#db.client.one(
        `
        INSERT INTO ${tableName} (
          id, name, description, model, prompt, "scoreRange", metadata, "ownerId", "createdAt", "updatedAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `,
        [
          scorer.id,
          scorer.name,
          scorer.description || null,
          JSON.stringify(scorer.model),
          scorer.prompt,
          JSON.stringify(scorer.scoreRange),
          scorer.metadata ? JSON.stringify(scorer.metadata) : null,
          scorer.ownerId || null,
          now,
          now,
        ],
      );

      return this.parseScorerRow(result);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'CREATE_SCORER', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { scorerId: scorer.id },
        },
        error,
      );
    }
  }

  async getScorerById({ id }: { id: string }): Promise<StoredScorerType | null> {
    try {
      const tableName = getTableName({
        indexName: TABLE_STORED_SCORERS,
        schemaName: getSchemaName(this.#schema),
      });

      const result = await this.#db.client.oneOrNone(`SELECT * FROM ${tableName} WHERE id = $1`, [id]);

      if (!result) {
        return null;
      }

      return this.parseScorerRow(result);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'GET_SCORER', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { scorerId: id },
        },
        error,
      );
    }
  }

  async updateScorer({ id, ...updates }: StorageUpdateScorerInput): Promise<StoredScorerType> {
    try {
      const tableName = getTableName({
        indexName: TABLE_STORED_SCORERS,
        schemaName: getSchemaName(this.#schema),
      });

      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;

      if (updates.name !== undefined) {
        updateFields.push(`name = $${paramIndex++}`);
        updateValues.push(updates.name);
      }
      if (updates.description !== undefined) {
        updateFields.push(`description = $${paramIndex++}`);
        updateValues.push(updates.description);
      }
      if (updates.model !== undefined) {
        updateFields.push(`model = $${paramIndex++}`);
        updateValues.push(JSON.stringify(updates.model));
      }
      if (updates.prompt !== undefined) {
        updateFields.push(`prompt = $${paramIndex++}`);
        updateValues.push(updates.prompt);
      }
      if (updates.scoreRange !== undefined) {
        updateFields.push(`"scoreRange" = $${paramIndex++}`);
        updateValues.push(JSON.stringify(updates.scoreRange));
      }
      if (updates.metadata !== undefined) {
        updateFields.push(`metadata = $${paramIndex++}`);
        updateValues.push(JSON.stringify(updates.metadata));
      }
      if (updates.ownerId !== undefined) {
        updateFields.push(`"ownerId" = $${paramIndex++}`);
        updateValues.push(updates.ownerId);
      }
      if (updates.activeVersionId !== undefined) {
        updateFields.push(`"activeVersionId" = $${paramIndex++}`);
        updateValues.push(updates.activeVersionId);
      }

      // Always update updatedAt
      updateFields.push(`"updatedAt" = $${paramIndex++}`);
      updateValues.push(new Date());

      // Add WHERE clause parameter
      updateValues.push(id);

      if (updateFields.length === 1) {
        // Only updatedAt was set, just return the existing scorer
        return (await this.getScorerById({ id }))!;
      }

      const result = await this.#db.client.one(
        `
        UPDATE ${tableName}
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `,
        updateValues,
      );

      return this.parseScorerRow(result);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'UPDATE_SCORER', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { scorerId: id },
        },
        error,
      );
    }
  }

  async deleteScorer({ id }: { id: string }): Promise<void> {
    try {
      const tableName = getTableName({
        indexName: TABLE_STORED_SCORERS,
        schemaName: getSchemaName(this.#schema),
      });

      // Delete versions first (cascade)
      await this.deleteScorerVersionsByScorerId(id);

      await this.#db.client.none(`DELETE FROM ${tableName} WHERE id = $1`, [id]);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'DELETE_SCORER', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { scorerId: id },
        },
        error,
      );
    }
  }

  async listScorers(args?: StorageListScorersInput): Promise<StorageListScorersOutput> {
    const { page = 0, perPage: perPageInput, orderBy, ownerId, metadata } = args || {};
    const { field: orderByField, direction: orderDirection } = this.parseOrderBy(orderBy);

    try {
      const tableName = getTableName({
        indexName: TABLE_STORED_SCORERS,
        schemaName: getSchemaName(this.#schema),
      });

      const normalizedPerPage = normalizePerPage(perPageInput, 100);
      const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, normalizedPerPage);

      // Build WHERE clause
      const whereClauses: string[] = [];
      const whereValues: any[] = [];
      let paramIndex = 1;

      if (ownerId) {
        whereClauses.push(`"ownerId" = $${paramIndex++}`);
        whereValues.push(ownerId);
      }

      if (metadata) {
        Object.entries(metadata).forEach(([key, value]) => {
          whereClauses.push(`metadata->>'${key}' = $${paramIndex++}`);
          whereValues.push(value);
        });
      }

      const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

      // Build ORDER BY clause
      const orderByClause = `ORDER BY "${orderByField}" ${orderDirection.toUpperCase()}`;

      // Get total count
      const countResult = await this.#db.client.one<{ count: string }>(
        `SELECT COUNT(*) as count FROM ${tableName} ${whereClause}`,
        whereValues,
      );
      const total = parseInt(countResult.count, 10);

      // Get paginated results
      const limitValue = perPageInput === false ? total : normalizedPerPage;
      const results = await this.#db.client.manyOrNone(
        `SELECT * FROM ${tableName} ${whereClause} ${orderByClause} LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
        [...whereValues, limitValue, offset],
      );

      const scorers = results.map(row => this.parseScorerRow(row));

      return {
        scorers,
        total,
        page,
        perPage: perPageForResponse,
        hasMore: offset + normalizedPerPage < total,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'LIST_SCORERS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  // Version methods

  async createScorerVersion(input: StorageCreateScorerVersionInput): Promise<StoredScorerVersionType> {
    try {
      const tableName = getTableName({
        indexName: TABLE_STORED_SCORER_VERSIONS,
        schemaName: getSchemaName(this.#schema),
      });

      const now = new Date();
      const result = await this.#db.client.one(
        `
        INSERT INTO ${tableName} (
          id, "scorerId", "versionNumber", name, snapshot, "changedFields", "changeMessage", "createdAt"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `,
        [
          input.id,
          input.scorerId,
          input.versionNumber,
          input.name || null,
          JSON.stringify(input.snapshot),
          input.changedFields ? JSON.stringify(input.changedFields) : null,
          input.changeMessage || null,
          now,
        ],
      );

      return this.parseScorerVersionRow(result);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'CREATE_SCORER_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { scorerId: input.scorerId, versionNumber: input.versionNumber },
        },
        error,
      );
    }
  }

  async getScorerVersion(id: string): Promise<StoredScorerVersionType | null> {
    try {
      const tableName = getTableName({
        indexName: TABLE_STORED_SCORER_VERSIONS,
        schemaName: getSchemaName(this.#schema),
      });

      const result = await this.#db.client.oneOrNone(`SELECT * FROM ${tableName} WHERE id = $1`, [id]);

      if (!result) {
        return null;
      }

      return this.parseScorerVersionRow(result);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'GET_SCORER_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { versionId: id },
        },
        error,
      );
    }
  }

  async getScorerVersionByNumber(scorerId: string, versionNumber: number): Promise<StoredScorerVersionType | null> {
    try {
      const tableName = getTableName({
        indexName: TABLE_STORED_SCORER_VERSIONS,
        schemaName: getSchemaName(this.#schema),
      });

      const result = await this.#db.client.oneOrNone(
        `SELECT * FROM ${tableName} WHERE "scorerId" = $1 AND "versionNumber" = $2`,
        [scorerId, versionNumber],
      );

      if (!result) {
        return null;
      }

      return this.parseScorerVersionRow(result);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'GET_SCORER_VERSION_BY_NUMBER', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { scorerId, versionNumber },
        },
        error,
      );
    }
  }

  async getLatestScorerVersion(scorerId: string): Promise<StoredScorerVersionType | null> {
    try {
      const tableName = getTableName({
        indexName: TABLE_STORED_SCORER_VERSIONS,
        schemaName: getSchemaName(this.#schema),
      });

      const result = await this.#db.client.oneOrNone(
        `SELECT * FROM ${tableName} WHERE "scorerId" = $1 ORDER BY "versionNumber" DESC LIMIT 1`,
        [scorerId],
      );

      if (!result) {
        return null;
      }

      return this.parseScorerVersionRow(result);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'GET_LATEST_SCORER_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { scorerId },
        },
        error,
      );
    }
  }

  async listScorerVersions(input: ListScorerVersionsInput): Promise<ListScorerVersionsOutput> {
    const { scorerId, page = 0, perPage: perPageInput, orderBy } = input;
    const { field: orderByField, direction: orderDirection } = this.parseScorerVersionOrderBy(orderBy);

    try {
      const tableName = getTableName({
        indexName: TABLE_STORED_SCORER_VERSIONS,
        schemaName: getSchemaName(this.#schema),
      });

      const normalizedPerPage = normalizePerPage(perPageInput, 20);
      const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, normalizedPerPage);

      // Get total count
      const countResult = await this.#db.client.one<{ count: string }>(
        `SELECT COUNT(*) as count FROM ${tableName} WHERE "scorerId" = $1`,
        [scorerId],
      );
      const total = parseInt(countResult.count, 10);

      // Build ORDER BY clause
      const orderByClause = `ORDER BY "${orderByField}" ${orderDirection.toUpperCase()}`;

      // Get paginated results
      const limitValue = perPageInput === false ? total : normalizedPerPage;
      const results = await this.#db.client.manyOrNone(
        `SELECT * FROM ${tableName} WHERE "scorerId" = $1 ${orderByClause} LIMIT $2 OFFSET $3`,
        [scorerId, limitValue, offset],
      );

      const versions = results.map(row => this.parseScorerVersionRow(row));

      return {
        versions,
        total,
        page,
        perPage: perPageForResponse,
        hasMore: offset + normalizedPerPage < total,
      };
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'LIST_SCORER_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { scorerId },
        },
        error,
      );
    }
  }

  async deleteScorerVersion(id: string): Promise<void> {
    try {
      const tableName = getTableName({
        indexName: TABLE_STORED_SCORER_VERSIONS,
        schemaName: getSchemaName(this.#schema),
      });

      await this.#db.client.none(`DELETE FROM ${tableName} WHERE id = $1`, [id]);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'DELETE_SCORER_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { versionId: id },
        },
        error,
      );
    }
  }

  async deleteScorerVersionsByScorerId(scorerId: string): Promise<void> {
    try {
      const tableName = getTableName({
        indexName: TABLE_STORED_SCORER_VERSIONS,
        schemaName: getSchemaName(this.#schema),
      });

      await this.#db.client.none(`DELETE FROM ${tableName} WHERE "scorerId" = $1`, [scorerId]);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'DELETE_SCORER_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { scorerId },
        },
        error,
      );
    }
  }

  async countScorerVersions(scorerId: string): Promise<number> {
    try {
      const tableName = getTableName({
        indexName: TABLE_STORED_SCORER_VERSIONS,
        schemaName: getSchemaName(this.#schema),
      });

      const result = await this.#db.client.one<{ count: string }>(
        `SELECT COUNT(*) as count FROM ${tableName} WHERE "scorerId" = $1`,
        [scorerId],
      );

      return parseInt(result.count, 10);
    } catch (error) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'COUNT_SCORER_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { scorerId },
        },
        error,
      );
    }
  }
}
