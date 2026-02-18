import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  ScorerDefinitionsStorage,
  createStorageErrorId,
  normalizePerPage,
  calculatePagination,
  TABLE_SCORER_DEFINITIONS,
  TABLE_SCORER_DEFINITION_VERSIONS,
  TABLE_SCHEMAS,
} from '@mastra/core/storage';
import type {
  StorageScorerDefinitionType,
  StorageCreateScorerDefinitionInput,
  StorageUpdateScorerDefinitionInput,
  StorageListScorerDefinitionsInput,
  StorageListScorerDefinitionsOutput,
  CreateIndexOptions,
} from '@mastra/core/storage';
import type {
  ScorerDefinitionVersion,
  CreateScorerDefinitionVersionInput,
  ListScorerDefinitionVersionsInput,
  ListScorerDefinitionVersionsOutput,
} from '@mastra/core/storage/domains/scorer-definitions';
import { parseSqlIdentifier } from '@mastra/core/utils';
import { PgDB, resolvePgConfig, generateTableSQL, generateIndexSQL } from '../../db';
import type { PgDomainConfig } from '../../db';
import { getTableName, getSchemaName } from '../utils';

const SNAPSHOT_FIELDS = [
  'name',
  'description',
  'type',
  'model',
  'instructions',
  'scoreRange',
  'presetConfig',
  'defaultSampling',
] as const;

export class ScorerDefinitionsPG extends ScorerDefinitionsStorage {
  #db: PgDB;
  #schema: string;
  #skipDefaultIndexes?: boolean;
  #indexes?: CreateIndexOptions[];

  static readonly MANAGED_TABLES = [TABLE_SCORER_DEFINITIONS, TABLE_SCORER_DEFINITION_VERSIONS] as const;

  constructor(config: PgDomainConfig) {
    super();
    const { client, schemaName, skipDefaultIndexes, indexes } = resolvePgConfig(config);
    this.#db = new PgDB({ client, schemaName, skipDefaultIndexes });
    this.#schema = schemaName || 'public';
    this.#skipDefaultIndexes = skipDefaultIndexes;
    this.#indexes = indexes?.filter(idx =>
      (ScorerDefinitionsPG.MANAGED_TABLES as readonly string[]).includes(idx.table),
    );
  }

  /**
   * Returns default index definitions for the scorer definitions domain tables.
   * @param schemaPrefix - Prefix for index names (e.g. "my_schema_" or "")
   */
  static getDefaultIndexDefs(schemaPrefix: string): CreateIndexOptions[] {
    return [
      {
        name: `${schemaPrefix}idx_scorer_definition_versions_def_version`,
        table: TABLE_SCORER_DEFINITION_VERSIONS,
        columns: ['scorerDefinitionId', 'versionNumber'],
        unique: true,
      },
    ];
  }

  /**
   * Returns all DDL statements for this domain: tables and indexes.
   * Used by exportSchemas to produce a complete, reproducible schema export.
   */
  static getExportDDL(schemaName?: string): string[] {
    const statements: string[] = [];
    const parsedSchema = schemaName ? parseSqlIdentifier(schemaName, 'schema name') : '';
    const schemaPrefix = parsedSchema && parsedSchema !== 'public' ? `${parsedSchema}_` : '';

    // Tables
    for (const tableName of ScorerDefinitionsPG.MANAGED_TABLES) {
      statements.push(
        generateTableSQL({
          tableName,
          schema: TABLE_SCHEMAS[tableName],
          schemaName,
          includeAllConstraints: true,
        }),
      );
    }

    // Indexes
    for (const idx of ScorerDefinitionsPG.getDefaultIndexDefs(schemaPrefix)) {
      statements.push(generateIndexSQL(idx, schemaName));
    }

    return statements;
  }

  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    const schemaPrefix = this.#schema !== 'public' ? `${this.#schema}_` : '';
    return ScorerDefinitionsPG.getDefaultIndexDefs(schemaPrefix);
  }

  async createDefaultIndexes(): Promise<void> {
    if (this.#skipDefaultIndexes) {
      return;
    }
    for (const indexDef of this.getDefaultIndexDefinitions()) {
      try {
        await this.#db.createIndex(indexDef);
      } catch {
        // Indexes are performance optimizations, continue on failure
      }
    }
  }

  async init(): Promise<void> {
    await this.#db.createTable({
      tableName: TABLE_SCORER_DEFINITIONS,
      schema: TABLE_SCHEMAS[TABLE_SCORER_DEFINITIONS],
    });
    await this.#db.createTable({
      tableName: TABLE_SCORER_DEFINITION_VERSIONS,
      schema: TABLE_SCHEMAS[TABLE_SCORER_DEFINITION_VERSIONS],
    });
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
  }

  async createCustomIndexes(): Promise<void> {
    if (!this.#indexes || this.#indexes.length === 0) {
      return;
    }
    for (const indexDef of this.#indexes) {
      try {
        await this.#db.createIndex(indexDef);
      } catch (error) {
        this.logger?.warn?.(`Failed to create custom index ${indexDef.name}:`, error);
      }
    }
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.clearTable({ tableName: TABLE_SCORER_DEFINITION_VERSIONS });
    await this.#db.clearTable({ tableName: TABLE_SCORER_DEFINITIONS });
  }

  // ==========================================================================
  // Scorer Definition CRUD Methods
  // ==========================================================================

  async getById(id: string): Promise<StorageScorerDefinitionType | null> {
    try {
      const tableName = getTableName({ indexName: TABLE_SCORER_DEFINITIONS, schemaName: getSchemaName(this.#schema) });
      const result = await this.#db.client.oneOrNone(`SELECT * FROM ${tableName} WHERE id = $1`, [id]);

      if (!result) {
        return null;
      }

      return this.parseScorerRow(result);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'GET_SCORER_DEFINITION_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { scorerDefinitionId: id },
        },
        error,
      );
    }
  }

  async create(input: { scorerDefinition: StorageCreateScorerDefinitionInput }): Promise<StorageScorerDefinitionType> {
    const { scorerDefinition } = input;
    try {
      const tableName = getTableName({ indexName: TABLE_SCORER_DEFINITIONS, schemaName: getSchemaName(this.#schema) });
      const now = new Date();
      const nowIso = now.toISOString();

      // 1. Create the thin scorer definition record
      await this.#db.client.none(
        `INSERT INTO ${tableName} (
          id, status, "activeVersionId", "authorId", metadata,
          "createdAt", "createdAtZ", "updatedAt", "updatedAtZ"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          scorerDefinition.id,
          'draft',
          null,
          scorerDefinition.authorId ?? null,
          scorerDefinition.metadata ? JSON.stringify(scorerDefinition.metadata) : null,
          nowIso,
          nowIso,
          nowIso,
          nowIso,
        ],
      );

      // 2. Extract snapshot fields and create version 1
      const { id: _id, authorId: _authorId, metadata: _metadata, ...snapshotConfig } = scorerDefinition;
      const versionId = crypto.randomUUID();
      await this.createVersion({
        id: versionId,
        scorerDefinitionId: scorerDefinition.id,
        versionNumber: 1,
        ...snapshotConfig,
        changedFields: [...SNAPSHOT_FIELDS],
        changeMessage: 'Initial version',
      });

      return {
        id: scorerDefinition.id,
        status: 'draft',
        activeVersionId: undefined,
        authorId: scorerDefinition.authorId,
        metadata: scorerDefinition.metadata,
        createdAt: now,
        updatedAt: now,
      };
    } catch (error) {
      // Best-effort cleanup
      try {
        const tableName = getTableName({
          indexName: TABLE_SCORER_DEFINITIONS,
          schemaName: getSchemaName(this.#schema),
        });
        await this.#db.client.none(
          `DELETE FROM ${tableName} WHERE id = $1 AND status = 'draft' AND "activeVersionId" IS NULL`,
          [scorerDefinition.id],
        );
      } catch {
        // Ignore cleanup errors
      }

      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'CREATE_SCORER_DEFINITION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { scorerDefinitionId: scorerDefinition.id },
        },
        error,
      );
    }
  }

  async update(input: StorageUpdateScorerDefinitionInput): Promise<StorageScorerDefinitionType> {
    const { id, ...updates } = input;
    try {
      const tableName = getTableName({ indexName: TABLE_SCORER_DEFINITIONS, schemaName: getSchemaName(this.#schema) });

      const existingScorer = await this.getById(id);
      if (!existingScorer) {
        throw new MastraError({
          id: createStorageErrorId('PG', 'UPDATE_SCORER_DEFINITION', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: `Scorer definition ${id} not found`,
          details: { scorerDefinitionId: id },
        });
      }

      const { authorId, activeVersionId, metadata, status } = updates;

      // Update metadata fields on the scorer definition record
      const setClauses: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (authorId !== undefined) {
        setClauses.push(`"authorId" = $${paramIndex++}`);
        values.push(authorId);
      }

      if (activeVersionId !== undefined) {
        setClauses.push(`"activeVersionId" = $${paramIndex++}`);
        values.push(activeVersionId);
      }

      if (status !== undefined) {
        setClauses.push(`status = $${paramIndex++}`);
        values.push(status);
      }

      if (metadata !== undefined) {
        const mergedMetadata = { ...(existingScorer.metadata || {}), ...metadata };
        setClauses.push(`metadata = $${paramIndex++}`);
        values.push(JSON.stringify(mergedMetadata));
      }

      // Always update timestamps
      const now = new Date().toISOString();
      setClauses.push(`"updatedAt" = $${paramIndex++}`);
      values.push(now);
      setClauses.push(`"updatedAtZ" = $${paramIndex++}`);
      values.push(now);

      values.push(id);

      // Always update the record (at minimum updatedAt/updatedAtZ are set)
      await this.#db.client.none(`UPDATE ${tableName} SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`, values);

      const updatedScorer = await this.getById(id);
      if (!updatedScorer) {
        throw new MastraError({
          id: createStorageErrorId('PG', 'UPDATE_SCORER_DEFINITION', 'NOT_FOUND_AFTER_UPDATE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.SYSTEM,
          text: `Scorer definition ${id} not found after update`,
          details: { scorerDefinitionId: id },
        });
      }
      return updatedScorer;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'UPDATE_SCORER_DEFINITION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { scorerDefinitionId: id },
        },
        error,
      );
    }
  }

  async delete(id: string): Promise<void> {
    try {
      const tableName = getTableName({ indexName: TABLE_SCORER_DEFINITIONS, schemaName: getSchemaName(this.#schema) });
      await this.deleteVersionsByParentId(id);
      await this.#db.client.none(`DELETE FROM ${tableName} WHERE id = $1`, [id]);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'DELETE_SCORER_DEFINITION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { scorerDefinitionId: id },
        },
        error,
      );
    }
  }

  async list(args?: StorageListScorerDefinitionsInput): Promise<StorageListScorerDefinitionsOutput> {
    const { page = 0, perPage: perPageInput, orderBy, authorId, metadata, status = 'published' } = args || {};
    const { field, direction } = this.parseOrderBy(orderBy);

    if (page < 0) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'LIST_SCORER_DEFINITIONS', 'INVALID_PAGE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { page },
        },
        new Error('page must be >= 0'),
      );
    }

    const perPage = normalizePerPage(perPageInput, 100);
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    try {
      const tableName = getTableName({ indexName: TABLE_SCORER_DEFINITIONS, schemaName: getSchemaName(this.#schema) });

      // Build WHERE conditions
      const conditions: string[] = [];
      const queryParams: any[] = [];
      let paramIdx = 1;

      conditions.push(`status = $${paramIdx++}`);
      queryParams.push(status);

      if (authorId !== undefined) {
        conditions.push(`"authorId" = $${paramIdx++}`);
        queryParams.push(authorId);
      }

      if (metadata && Object.keys(metadata).length > 0) {
        conditions.push(`metadata @> $${paramIdx++}::jsonb`);
        queryParams.push(JSON.stringify(metadata));
      }

      const whereClause = `WHERE ${conditions.join(' AND ')}`;

      // Get total count
      const countResult = await this.#db.client.one(
        `SELECT COUNT(*) as count FROM ${tableName} ${whereClause}`,
        queryParams,
      );
      const total = parseInt(countResult.count, 10);

      if (total === 0) {
        return {
          scorerDefinitions: [],
          total: 0,
          page,
          perPage: perPageForResponse,
          hasMore: false,
        };
      }

      const limitValue = perPageInput === false ? total : perPage;
      const dataResult = await this.#db.client.manyOrNone(
        `SELECT * FROM ${tableName} ${whereClause} ORDER BY "${field}" ${direction} LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
        [...queryParams, limitValue, offset],
      );

      const scorerDefinitions = (dataResult || []).map(row => this.parseScorerRow(row));

      return {
        scorerDefinitions,
        total,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : offset + perPage < total,
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'LIST_SCORER_DEFINITIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  // ==========================================================================
  // Scorer Definition Version Methods
  // ==========================================================================

  async createVersion(input: CreateScorerDefinitionVersionInput): Promise<ScorerDefinitionVersion> {
    try {
      const tableName = getTableName({
        indexName: TABLE_SCORER_DEFINITION_VERSIONS,
        schemaName: getSchemaName(this.#schema),
      });
      const now = new Date();
      const nowIso = now.toISOString();

      await this.#db.client.none(
        `INSERT INTO ${tableName} (
          id, "scorerDefinitionId", "versionNumber",
          name, description, type, model, instructions, "scoreRange", "presetConfig", "defaultSampling",
          "changedFields", "changeMessage",
          "createdAt", "createdAtZ"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          input.id,
          input.scorerDefinitionId,
          input.versionNumber,
          input.name,
          input.description ?? null,
          input.type,
          input.model ? JSON.stringify(input.model) : null,
          input.instructions ?? null,
          input.scoreRange ? JSON.stringify(input.scoreRange) : null,
          input.presetConfig ? JSON.stringify(input.presetConfig) : null,
          input.defaultSampling ? JSON.stringify(input.defaultSampling) : null,
          input.changedFields ? JSON.stringify(input.changedFields) : null,
          input.changeMessage ?? null,
          nowIso,
          nowIso,
        ],
      );

      return {
        ...input,
        createdAt: now,
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'CREATE_SCORER_DEFINITION_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { versionId: input.id, scorerDefinitionId: input.scorerDefinitionId },
        },
        error,
      );
    }
  }

  async getVersion(id: string): Promise<ScorerDefinitionVersion | null> {
    try {
      const tableName = getTableName({
        indexName: TABLE_SCORER_DEFINITION_VERSIONS,
        schemaName: getSchemaName(this.#schema),
      });
      const result = await this.#db.client.oneOrNone(`SELECT * FROM ${tableName} WHERE id = $1`, [id]);

      if (!result) {
        return null;
      }

      return this.parseVersionRow(result);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'GET_SCORER_DEFINITION_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { versionId: id },
        },
        error,
      );
    }
  }

  async getVersionByNumber(scorerDefinitionId: string, versionNumber: number): Promise<ScorerDefinitionVersion | null> {
    try {
      const tableName = getTableName({
        indexName: TABLE_SCORER_DEFINITION_VERSIONS,
        schemaName: getSchemaName(this.#schema),
      });
      const result = await this.#db.client.oneOrNone(
        `SELECT * FROM ${tableName} WHERE "scorerDefinitionId" = $1 AND "versionNumber" = $2`,
        [scorerDefinitionId, versionNumber],
      );

      if (!result) {
        return null;
      }

      return this.parseVersionRow(result);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'GET_SCORER_DEFINITION_VERSION_BY_NUMBER', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { scorerDefinitionId, versionNumber },
        },
        error,
      );
    }
  }

  async getLatestVersion(scorerDefinitionId: string): Promise<ScorerDefinitionVersion | null> {
    try {
      const tableName = getTableName({
        indexName: TABLE_SCORER_DEFINITION_VERSIONS,
        schemaName: getSchemaName(this.#schema),
      });
      const result = await this.#db.client.oneOrNone(
        `SELECT * FROM ${tableName} WHERE "scorerDefinitionId" = $1 ORDER BY "versionNumber" DESC LIMIT 1`,
        [scorerDefinitionId],
      );

      if (!result) {
        return null;
      }

      return this.parseVersionRow(result);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'GET_LATEST_SCORER_DEFINITION_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { scorerDefinitionId },
        },
        error,
      );
    }
  }

  async listVersions(input: ListScorerDefinitionVersionsInput): Promise<ListScorerDefinitionVersionsOutput> {
    const { scorerDefinitionId, page = 0, perPage: perPageInput, orderBy } = input;

    if (page < 0) {
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'LIST_SCORER_DEFINITION_VERSIONS', 'INVALID_PAGE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          details: { page },
        },
        new Error('page must be >= 0'),
      );
    }

    const perPage = normalizePerPage(perPageInput, 20);
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    try {
      const { field, direction } = this.parseVersionOrderBy(orderBy);
      const tableName = getTableName({
        indexName: TABLE_SCORER_DEFINITION_VERSIONS,
        schemaName: getSchemaName(this.#schema),
      });

      const countResult = await this.#db.client.one(
        `SELECT COUNT(*) as count FROM ${tableName} WHERE "scorerDefinitionId" = $1`,
        [scorerDefinitionId],
      );
      const total = parseInt(countResult.count, 10);

      if (total === 0) {
        return {
          versions: [],
          total: 0,
          page,
          perPage: perPageForResponse,
          hasMore: false,
        };
      }

      const limitValue = perPageInput === false ? total : perPage;
      const dataResult = await this.#db.client.manyOrNone(
        `SELECT * FROM ${tableName} WHERE "scorerDefinitionId" = $1 ORDER BY "${field}" ${direction} LIMIT $2 OFFSET $3`,
        [scorerDefinitionId, limitValue, offset],
      );

      const versions = (dataResult || []).map(row => this.parseVersionRow(row));

      return {
        versions,
        total,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : offset + perPage < total,
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'LIST_SCORER_DEFINITION_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { scorerDefinitionId },
        },
        error,
      );
    }
  }

  async deleteVersion(id: string): Promise<void> {
    try {
      const tableName = getTableName({
        indexName: TABLE_SCORER_DEFINITION_VERSIONS,
        schemaName: getSchemaName(this.#schema),
      });
      await this.#db.client.none(`DELETE FROM ${tableName} WHERE id = $1`, [id]);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'DELETE_SCORER_DEFINITION_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { versionId: id },
        },
        error,
      );
    }
  }

  async deleteVersionsByParentId(entityId: string): Promise<void> {
    try {
      const tableName = getTableName({
        indexName: TABLE_SCORER_DEFINITION_VERSIONS,
        schemaName: getSchemaName(this.#schema),
      });
      await this.#db.client.none(`DELETE FROM ${tableName} WHERE "scorerDefinitionId" = $1`, [entityId]);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'DELETE_SCORER_DEFINITION_VERSIONS_BY_SCORER_DEFINITION_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { scorerDefinitionId: entityId },
        },
        error,
      );
    }
  }

  async countVersions(scorerDefinitionId: string): Promise<number> {
    try {
      const tableName = getTableName({
        indexName: TABLE_SCORER_DEFINITION_VERSIONS,
        schemaName: getSchemaName(this.#schema),
      });
      const result = await this.#db.client.one(
        `SELECT COUNT(*) as count FROM ${tableName} WHERE "scorerDefinitionId" = $1`,
        [scorerDefinitionId],
      );
      return parseInt(result.count, 10);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'COUNT_SCORER_DEFINITION_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { scorerDefinitionId },
        },
        error,
      );
    }
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  private parseJson(value: any, fieldName?: string): any {
    if (!value) return undefined;
    if (typeof value !== 'string') return value;

    try {
      return JSON.parse(value);
    } catch (error) {
      if (error instanceof MastraError) throw error;
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

  private parseScorerRow(row: any): StorageScorerDefinitionType {
    return {
      id: row.id as string,
      status: row.status as StorageScorerDefinitionType['status'],
      activeVersionId: row.activeVersionId as string | undefined,
      authorId: row.authorId as string | undefined,
      metadata: this.parseJson(row.metadata, 'metadata'),
      createdAt: new Date(row.createdAtZ || row.createdAt),
      updatedAt: new Date(row.updatedAtZ || row.updatedAt),
    };
  }

  private parseVersionRow(row: any): ScorerDefinitionVersion {
    return {
      id: row.id as string,
      scorerDefinitionId: row.scorerDefinitionId as string,
      versionNumber: row.versionNumber as number,
      name: row.name as string,
      description: row.description as string | undefined,
      type: row.type as ScorerDefinitionVersion['type'],
      model: this.parseJson(row.model, 'model'),
      instructions: row.instructions as string | undefined,
      scoreRange: this.parseJson(row.scoreRange, 'scoreRange'),
      presetConfig: this.parseJson(row.presetConfig, 'presetConfig'),
      defaultSampling: this.parseJson(row.defaultSampling, 'defaultSampling'),
      changedFields: this.parseJson(row.changedFields, 'changedFields'),
      changeMessage: row.changeMessage as string | undefined,
      createdAt: new Date(row.createdAtZ || row.createdAt),
    };
  }
}
