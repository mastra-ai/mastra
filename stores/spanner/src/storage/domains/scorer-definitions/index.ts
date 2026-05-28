import type { Database } from '@google-cloud/spanner';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  calculatePagination,
  createStorageErrorId,
  normalizePerPage,
  ScorerDefinitionsStorage,
  SCORER_DEFINITIONS_SCHEMA,
  SCORER_DEFINITION_VERSIONS_SCHEMA,
  TABLE_SCORER_DEFINITIONS,
  TABLE_SCORER_DEFINITION_VERSIONS,
} from '@mastra/core/storage';
import type {
  CreateIndexOptions,
  StorageScorerDefinitionType,
  StorageCreateScorerDefinitionInput,
  StorageListScorerDefinitionsInput,
  StorageListScorerDefinitionsOutput,
  StorageUpdateScorerDefinitionInput,
} from '@mastra/core/storage';
import type {
  CreateScorerDefinitionVersionInput,
  ListScorerDefinitionVersionsInput,
  ListScorerDefinitionVersionsOutput,
  ScorerDefinitionVersion,
} from '@mastra/core/storage/domains/scorer-definitions';
import { SpannerDB, resolveSpannerConfig } from '../../db';
import type { SpannerDomainConfig } from '../../db';
import { quoteIdent } from '../../db/utils';
import { transformFromSpannerRow } from '../utils';

/**
 * Spanner-backed storage for scorer definitions and their immutable versions.
 * Mirrors the thin-record + versions pattern used by agents/skills/prompt-blocks.
 */
export class ScorerDefinitionsSpanner extends ScorerDefinitionsStorage {
  private database: Database;
  private db: SpannerDB;
  private skipDefaultIndexes?: boolean;
  private indexes?: CreateIndexOptions[];

  static readonly MANAGED_TABLES = [TABLE_SCORER_DEFINITIONS, TABLE_SCORER_DEFINITION_VERSIONS] as const;

  constructor(config: SpannerDomainConfig) {
    super();
    const { database, indexes, skipDefaultIndexes, initMode, cleanupStaleDraftsOnStartup } =
      resolveSpannerConfig(config);
    this.database = database;
    this.db = new SpannerDB({ database, skipDefaultIndexes, initMode, cleanupStaleDraftsOnStartup });
    this.skipDefaultIndexes = skipDefaultIndexes;
    this.indexes = indexes?.filter(idx =>
      (ScorerDefinitionsSpanner.MANAGED_TABLES as readonly string[]).includes(idx.table),
    );
  }

  /** Creates the scorer-definition tables, indexes, and (when opted in) sweeps stale drafts. */
  async init(): Promise<void> {
    await this.db.createTable({ tableName: TABLE_SCORER_DEFINITIONS, schema: SCORER_DEFINITIONS_SCHEMA });
    await this.db.createTable({
      tableName: TABLE_SCORER_DEFINITION_VERSIONS,
      schema: SCORER_DEFINITION_VERSIONS_SCHEMA,
    });
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
    // Sweep any orphaned drafts left behind by previous partial create() calls.
    await this.cleanupStaleDrafts();
  }

  /**
   * Sweeps orphaned draft thin-rows whose paired version row was never written.
   * Skipped under `initMode: 'validate'` (no destructive DML in validate mode).
   */
  private async cleanupStaleDrafts(): Promise<void> {
    if (this.db.initMode === 'validate') return;
    if (!this.db.cleanupStaleDraftsOnStartup) return;
    try {
      await this.db.runDml({
        sql: `DELETE FROM ${quoteIdent(TABLE_SCORER_DEFINITIONS, 'table name')}
              WHERE ${quoteIdent('status', 'column name')} = 'draft'
                AND ${quoteIdent('activeVersionId', 'column name')} IS NULL
                AND id NOT IN (
                  SELECT ${quoteIdent('scorerDefinitionId', 'column name')}
                  FROM ${quoteIdent(TABLE_SCORER_DEFINITION_VERSIONS, 'table name')}
                  WHERE ${quoteIdent('scorerDefinitionId', 'column name')} IS NOT NULL
                )`,
      });
    } catch (error) {
      this.logger?.warn?.('Failed to clean up stale draft scorer definitions:', error);
    }
  }

  /** Returns the default index set this domain creates during `init()`. */
  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    return [
      {
        name: 'mastra_scorer_definitions_status_createdat_idx',
        table: TABLE_SCORER_DEFINITIONS,
        columns: ['status', 'createdAt DESC'],
      },
      {
        name: 'mastra_scorer_definitions_authorid_idx',
        table: TABLE_SCORER_DEFINITIONS,
        columns: ['authorId'],
      },
      // Unique index on (scorerDefinitionId, versionNumber) prevents duplicate
      // versions from concurrent createVersion calls.
      {
        name: 'mastra_scorer_definition_versions_unique_idx',
        table: TABLE_SCORER_DEFINITION_VERSIONS,
        columns: ['scorerDefinitionId', 'versionNumber'],
        unique: true,
      },
    ];
  }

  /** Creates the default indexes; no-op when `skipDefaultIndexes` was set. */
  async createDefaultIndexes(): Promise<void> {
    if (this.skipDefaultIndexes) return;
    await this.db.createIndexes(this.getDefaultIndexDefinitions());
  }

  /** Creates custom indexes routed to this domain's tables; no-op when none supplied. */
  async createCustomIndexes(): Promise<void> {
    if (!this.indexes || this.indexes.length === 0) return;
    await this.db.createIndexes(this.indexes);
  }

  /** Removes every row from this domain's tables. Intended for tests. */
  async dangerouslyClearAll(): Promise<void> {
    await this.db.clearTable({ tableName: TABLE_SCORER_DEFINITION_VERSIONS });
    await this.db.clearTable({ tableName: TABLE_SCORER_DEFINITIONS });
  }

  /** Decodes a raw Spanner thin-row into the public scorer-definition shape. */
  private parseScorerRow(row: Record<string, any>): StorageScorerDefinitionType {
    const transformed = transformFromSpannerRow<Record<string, any>>({
      tableName: TABLE_SCORER_DEFINITIONS,
      row,
    });
    return {
      id: transformed.id,
      status: transformed.status,
      activeVersionId: transformed.activeVersionId ?? undefined,
      authorId: transformed.authorId ?? undefined,
      metadata: transformed.metadata ?? undefined,
      createdAt: transformed.createdAt,
      updatedAt: transformed.updatedAt,
    };
  }

  /** Decodes a raw Spanner version row into the public version shape. */
  private parseVersionRow(row: Record<string, any>): ScorerDefinitionVersion {
    const transformed = transformFromSpannerRow<Record<string, any>>({
      tableName: TABLE_SCORER_DEFINITION_VERSIONS,
      row,
    });
    return {
      id: transformed.id,
      scorerDefinitionId: transformed.scorerDefinitionId,
      versionNumber: Number(transformed.versionNumber),
      name: transformed.name,
      description: transformed.description ?? undefined,
      type: transformed.type,
      model: transformed.model ?? undefined,
      instructions: transformed.instructions ?? undefined,
      scoreRange: transformed.scoreRange ?? undefined,
      presetConfig: transformed.presetConfig ?? undefined,
      defaultSampling: transformed.defaultSampling ?? undefined,
      changedFields: transformed.changedFields ?? undefined,
      changeMessage: transformed.changeMessage ?? undefined,
      createdAt: transformed.createdAt,
    };
  }

  /** Fetches the thin scorer-definition record by id, or `null` when absent. */
  async getById(id: string): Promise<StorageScorerDefinitionType | null> {
    try {
      const [rows] = await this.database.run({
        sql: `SELECT * FROM ${quoteIdent(TABLE_SCORER_DEFINITIONS, 'table name')} WHERE id = @id LIMIT 1`,
        params: { id },
        json: true,
      });
      const row = (rows as Array<Record<string, any>>)[0];
      return row ? this.parseScorerRow(row) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'GET_SCORER_DEFINITION_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { scorerDefinitionId: id },
        },
        error,
      );
    }
  }

  /** Atomically inserts a draft thin row + version 1 in a single Spanner transaction. */
  async create(input: { scorerDefinition: StorageCreateScorerDefinitionInput }): Promise<StorageScorerDefinitionType> {
    const { scorerDefinition } = input;
    try {
      const now = new Date();
      const { id: _id, authorId: _authorId, metadata: _metadata, ...snapshot } = scorerDefinition;
      const versionId = globalThis.crypto?.randomUUID
        ? globalThis.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      await this.db.runWithAbortRetry(() =>
        this.database.runTransactionAsync(async tx => {
          try {
            await this.db.insert({
              tableName: TABLE_SCORER_DEFINITIONS,
              record: {
                id: scorerDefinition.id,
                status: 'draft',
                activeVersionId: null,
                authorId: scorerDefinition.authorId ?? null,
                metadata: scorerDefinition.metadata ?? null,
                createdAt: now,
                updatedAt: now,
              },
              transaction: tx,
            });
            await this.db.insert({
              tableName: TABLE_SCORER_DEFINITION_VERSIONS,
              record: {
                id: versionId,
                scorerDefinitionId: scorerDefinition.id,
                versionNumber: 1,
                name: (snapshot as any).name,
                description: (snapshot as any).description ?? null,
                type: (snapshot as any).type,
                model: (snapshot as any).model ?? null,
                instructions: (snapshot as any).instructions ?? null,
                scoreRange: (snapshot as any).scoreRange ?? null,
                presetConfig: (snapshot as any).presetConfig ?? null,
                defaultSampling: (snapshot as any).defaultSampling ?? null,
                changedFields: Object.keys(snapshot),
                changeMessage: 'Initial version',
                createdAt: now,
              },
              transaction: tx,
            });
            await tx.commit();
          } catch (err) {
            // The Spanner client does NOT auto-rollback when the runFn throws
            // the transaction (and its row locks) stay pending on the server
            // until explicitly released. Without this rollback, a failed
            // create() blocks subsequent reads/writes against the same rows.
            await tx.rollback().catch(() => {});
            throw err;
          }
        }),
      );

      const created = await this.getById(scorerDefinition.id);
      if (!created) {
        throw new MastraError({
          id: createStorageErrorId('SPANNER', 'CREATE_SCORER_DEFINITION', 'NOT_FOUND_AFTER_CREATE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.SYSTEM,
          text: `Scorer definition ${scorerDefinition.id} not found after creation`,
          details: { scorerDefinitionId: scorerDefinition.id },
        });
      }
      return created;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'CREATE_SCORER_DEFINITION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { scorerDefinitionId: scorerDefinition.id },
        },
        error,
      );
    }
  }

  /** Updates thin-record fields (status, activeVersionId, authorId, metadata). */
  async update(input: StorageUpdateScorerDefinitionInput): Promise<StorageScorerDefinitionType> {
    const { id, ...updates } = input;
    try {
      const existing = await this.getById(id);
      if (!existing) {
        throw new MastraError({
          id: createStorageErrorId('SPANNER', 'UPDATE_SCORER_DEFINITION', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: `Scorer definition ${id} not found`,
          details: { scorerDefinitionId: id },
        });
      }

      // Only thin-record fields land on the entity row; content updates create
      // a new version through the server's auto-versioning layer.
      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (updates.authorId !== undefined) updateData.authorId = updates.authorId;
      if (updates.activeVersionId !== undefined) updateData.activeVersionId = updates.activeVersionId;
      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.metadata !== undefined) updateData.metadata = updates.metadata ?? null;

      await this.db.update({ tableName: TABLE_SCORER_DEFINITIONS, keys: { id }, data: updateData });

      const updated = await this.getById(id);
      if (!updated) {
        throw new MastraError({
          id: createStorageErrorId('SPANNER', 'UPDATE_SCORER_DEFINITION', 'NOT_FOUND_AFTER_UPDATE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.SYSTEM,
          text: `Scorer definition ${id} not found after update`,
          details: { scorerDefinitionId: id },
        });
      }
      return updated;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'UPDATE_SCORER_DEFINITION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { scorerDefinitionId: id },
        },
        error,
      );
    }
  }

  /** Removes a scorer definition and all its versions atomically in a single transaction. */
  async delete(id: string): Promise<void> {
    try {
      await this.db.runWithAbortRetry(() =>
        this.database.runTransactionAsync(async tx => {
          try {
            await tx.runUpdate({
              sql: `DELETE FROM ${quoteIdent(TABLE_SCORER_DEFINITION_VERSIONS, 'table name')} WHERE ${quoteIdent('scorerDefinitionId', 'column name')} = @scorerDefinitionId`,
              params: { scorerDefinitionId: id },
            });
            await tx.runUpdate({
              sql: `DELETE FROM ${quoteIdent(TABLE_SCORER_DEFINITIONS, 'table name')} WHERE id = @id`,
              params: { id },
            });
            await tx.commit();
          } catch (err) {
            await tx.rollback().catch(() => {});
            throw err;
          }
        }),
      );
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'DELETE_SCORER_DEFINITION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { scorerDefinitionId: id },
        },
        error,
      );
    }
  }

  /** Paginated listing with optional status / authorId / metadata filters. */
  async list(args?: StorageListScorerDefinitionsInput): Promise<StorageListScorerDefinitionsOutput> {
    const { page = 0, perPage: perPageInput, orderBy, authorId, metadata, status } = args || {};
    const { field, direction } = this.parseOrderBy(orderBy);

    if (page < 0) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'LIST_SCORER_DEFINITIONS', 'INVALID_PAGE'),
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
      const tableName = quoteIdent(TABLE_SCORER_DEFINITIONS, 'table name');
      const conditions: string[] = [];
      const params: Record<string, any> = {};

      if (status) {
        conditions.push(`${quoteIdent('status', 'column name')} = @status`);
        params.status = status;
      }
      if (authorId !== undefined) {
        conditions.push(`${quoteIdent('authorId', 'column name')} = @authorId`);
        params.authorId = authorId;
      }
      if (metadata && Object.keys(metadata).length > 0) {
        let i = 0;
        for (const [key, value] of Object.entries(metadata)) {
          // SECURITY: the JSON path inside `JSON_VALUE(metadata, '$.<key>')`
          // must be a string literal, Spanner does NOT accept a parameter
          // for the JSON path expression, so the key is concatenated into
          // SQL.
          if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
            throw new MastraError({
              id: createStorageErrorId('SPANNER', 'LIST_SCORER_DEFINITIONS', 'INVALID_METADATA_KEY'),
              domain: ErrorDomain.STORAGE,
              category: ErrorCategory.USER,
              text: `Invalid metadata key: ${key}. Keys must be alphanumeric with underscores.`,
              details: { key },
            });
          }
          const param = `m${i++}`;
          conditions.push(`JSON_VALUE(metadata, '$.${key}') = @${param}`);
          params[param] = typeof value === 'string' ? value : JSON.stringify(value);
        }
      }

      const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const [countRows] = await this.database.run({
        sql: `SELECT COUNT(*) AS count FROM ${tableName} ${whereSql}`,
        params,
        json: true,
      });
      const total = Number((countRows as Array<{ count: number | string }>)[0]?.count ?? 0);
      if (total === 0) {
        return { scorerDefinitions: [], total: 0, page, perPage: perPageForResponse, hasMore: false };
      }

      const limit = perPageInput === false ? total : perPage;
      const dirSql = (direction || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      const [rows] = await this.database.run({
        sql: `SELECT * FROM ${tableName} ${whereSql}
              ORDER BY ${quoteIdent(field, 'column name')} ${dirSql}, id ${dirSql}
              LIMIT @limit OFFSET @offset`,
        params: { ...params, limit, offset },
        json: true,
      });
      const scorerDefinitions = (rows as Array<Record<string, any>>).map(r => this.parseScorerRow(r));
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
          id: createStorageErrorId('SPANNER', 'LIST_SCORER_DEFINITIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  /** Inserts a new immutable version row for an existing scorer definition. */
  async createVersion(input: CreateScorerDefinitionVersionInput): Promise<ScorerDefinitionVersion> {
    try {
      const now = new Date();
      await this.db.insert({
        tableName: TABLE_SCORER_DEFINITION_VERSIONS,
        record: {
          id: input.id,
          scorerDefinitionId: input.scorerDefinitionId,
          versionNumber: input.versionNumber,
          name: input.name,
          description: input.description ?? null,
          type: input.type,
          model: input.model ?? null,
          instructions: input.instructions ?? null,
          scoreRange: input.scoreRange ?? null,
          presetConfig: input.presetConfig ?? null,
          defaultSampling: input.defaultSampling ?? null,
          changedFields: input.changedFields ?? null,
          changeMessage: input.changeMessage ?? null,
          createdAt: now,
        },
      });
      return { ...input, createdAt: now } as ScorerDefinitionVersion;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'CREATE_SCORER_DEFINITION_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { versionId: input.id, scorerDefinitionId: input.scorerDefinitionId },
        },
        error,
      );
    }
  }

  /** Fetches a version row by its id, or `null` when absent. */
  async getVersion(id: string): Promise<ScorerDefinitionVersion | null> {
    try {
      const [rows] = await this.database.run({
        sql: `SELECT * FROM ${quoteIdent(TABLE_SCORER_DEFINITION_VERSIONS, 'table name')} WHERE id = @id LIMIT 1`,
        params: { id },
        json: true,
      });
      const row = (rows as Array<Record<string, any>>)[0];
      return row ? this.parseVersionRow(row) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'GET_SCORER_DEFINITION_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { versionId: id },
        },
        error,
      );
    }
  }

  /** Fetches a specific version by `(scorerDefinitionId, versionNumber)`. */
  async getVersionByNumber(scorerDefinitionId: string, versionNumber: number): Promise<ScorerDefinitionVersion | null> {
    try {
      const [rows] = await this.database.run({
        sql: `SELECT * FROM ${quoteIdent(TABLE_SCORER_DEFINITION_VERSIONS, 'table name')}
              WHERE ${quoteIdent('scorerDefinitionId', 'column name')} = @scorerDefinitionId
                AND ${quoteIdent('versionNumber', 'column name')} = @versionNumber
              LIMIT 1`,
        params: { scorerDefinitionId, versionNumber },
        json: true,
      });
      const row = (rows as Array<Record<string, any>>)[0];
      return row ? this.parseVersionRow(row) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'GET_SCORER_DEFINITION_VERSION_BY_NUMBER', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { scorerDefinitionId, versionNumber },
        },
        error,
      );
    }
  }

  /** Returns the highest-numbered version for a scorer definition. */
  async getLatestVersion(scorerDefinitionId: string): Promise<ScorerDefinitionVersion | null> {
    try {
      const [rows] = await this.database.run({
        sql: `SELECT * FROM ${quoteIdent(TABLE_SCORER_DEFINITION_VERSIONS, 'table name')}
              WHERE ${quoteIdent('scorerDefinitionId', 'column name')} = @scorerDefinitionId
              ORDER BY ${quoteIdent('versionNumber', 'column name')} DESC
              LIMIT 1`,
        params: { scorerDefinitionId },
        json: true,
      });
      const row = (rows as Array<Record<string, any>>)[0];
      return row ? this.parseVersionRow(row) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'GET_SCORER_DEFINITION_LATEST_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { scorerDefinitionId },
        },
        error,
      );
    }
  }

  /** Paginated listing of versions for a single scorer definition. */
  async listVersions(input: ListScorerDefinitionVersionsInput): Promise<ListScorerDefinitionVersionsOutput> {
    const { scorerDefinitionId, page = 0, perPage: perPageInput, orderBy } = input;
    if (page < 0) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'LIST_SCORER_DEFINITION_VERSIONS', 'INVALID_PAGE'),
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
      const dirSql = direction === 'ASC' ? 'ASC' : 'DESC';
      const tableName = quoteIdent(TABLE_SCORER_DEFINITION_VERSIONS, 'table name');

      const [countRows] = await this.database.run({
        sql: `SELECT COUNT(*) AS count FROM ${tableName} WHERE ${quoteIdent('scorerDefinitionId', 'column name')} = @scorerDefinitionId`,
        params: { scorerDefinitionId },
        json: true,
      });
      const total = Number((countRows as Array<{ count: number | string }>)[0]?.count ?? 0);
      if (total === 0) {
        return { versions: [], total: 0, page, perPage: perPageForResponse, hasMore: false };
      }

      const limit = perPageInput === false ? total : perPage;
      const [rows] = await this.database.run({
        sql: `SELECT * FROM ${tableName}
              WHERE ${quoteIdent('scorerDefinitionId', 'column name')} = @scorerDefinitionId
              ORDER BY ${quoteIdent(field, 'column name')} ${dirSql}, id ${dirSql}
              LIMIT @limit OFFSET @offset`,
        params: { scorerDefinitionId, limit, offset },
        json: true,
      });
      const versions = (rows as Array<Record<string, any>>).map(r => this.parseVersionRow(r));
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
          id: createStorageErrorId('SPANNER', 'LIST_SCORER_DEFINITION_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { scorerDefinitionId },
        },
        error,
      );
    }
  }

  /** Deletes a single version row by id. */
  async deleteVersion(id: string): Promise<void> {
    try {
      await this.db.runDml({
        sql: `DELETE FROM ${quoteIdent(TABLE_SCORER_DEFINITION_VERSIONS, 'table name')} WHERE id = @id`,
        params: { id },
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'DELETE_SCORER_DEFINITION_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { versionId: id },
        },
        error,
      );
    }
  }

  /** Deletes every version row belonging to the given scorer definition. */
  async deleteVersionsByParentId(entityId: string): Promise<void> {
    try {
      await this.db.runDml({
        sql: `DELETE FROM ${quoteIdent(TABLE_SCORER_DEFINITION_VERSIONS, 'table name')} WHERE ${quoteIdent('scorerDefinitionId', 'column name')} = @scorerDefinitionId`,
        params: { scorerDefinitionId: entityId },
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'DELETE_SCORER_DEFINITION_VERSIONS_BY_PARENT_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { scorerDefinitionId: entityId },
        },
        error,
      );
    }
  }

  /** Returns the total number of version rows for the given scorer definition. */
  async countVersions(scorerDefinitionId: string): Promise<number> {
    try {
      const [rows] = await this.database.run({
        sql: `SELECT COUNT(*) AS count FROM ${quoteIdent(TABLE_SCORER_DEFINITION_VERSIONS, 'table name')} WHERE ${quoteIdent('scorerDefinitionId', 'column name')} = @scorerDefinitionId`,
        params: { scorerDefinitionId },
        json: true,
      });
      return Number((rows as Array<{ count: number | string }>)[0]?.count ?? 0);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'COUNT_SCORER_DEFINITION_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { scorerDefinitionId },
        },
        error,
      );
    }
  }
}
