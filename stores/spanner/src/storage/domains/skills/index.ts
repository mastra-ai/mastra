import type { Database } from '@google-cloud/spanner';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  calculatePagination,
  createStorageErrorId,
  normalizePerPage,
  SkillsStorage,
  SKILLS_SCHEMA,
  SKILL_VERSIONS_SCHEMA,
  TABLE_FAVORITES,
  TABLE_SKILLS,
  TABLE_SKILL_VERSIONS,
} from '@mastra/core/storage';
import type {
  CreateIndexOptions,
  StorageSkillType,
  StorageCreateSkillInput,
  StorageListSkillsInput,
  StorageListSkillsOutput,
  StorageUpdateSkillInput,
} from '@mastra/core/storage';
import type {
  CreateSkillVersionInput,
  ListSkillVersionsInput,
  ListSkillVersionsOutput,
  SkillVersion,
} from '@mastra/core/storage/domains/skills';
import { SpannerDB, resolveSpannerConfig } from '../../db';
import type { SpannerDomainConfig } from '../../db';
import { quoteIdent } from '../../db/utils';
import { transformFromSpannerRow } from '../utils';

/**
 * Spanner-backed storage for skills and their immutable versions.
 * Mirrors the thin-record + versions pattern used by agents/prompt-blocks/scorer-definitions.
 */
export class SkillsSpanner extends SkillsStorage {
  private database: Database;
  private db: SpannerDB;
  private readonly skipDefaultIndexes?: boolean;
  private readonly indexes?: CreateIndexOptions[];

  static readonly MANAGED_TABLES = [TABLE_SKILLS, TABLE_SKILL_VERSIONS] as const;

  constructor(config: SpannerDomainConfig) {
    super();
    const { database, indexes, skipDefaultIndexes, initMode, cleanupStaleDraftsOnStartup } =
      resolveSpannerConfig(config);
    this.database = database;
    this.db = new SpannerDB({ database, skipDefaultIndexes, initMode, cleanupStaleDraftsOnStartup });
    this.skipDefaultIndexes = skipDefaultIndexes;
    this.indexes = indexes?.filter(idx => (SkillsSpanner.MANAGED_TABLES as readonly string[]).includes(idx.table));
  }

  /** Creates the skill tables, indexes, and (when opted in) sweeps stale drafts. */
  async init(): Promise<void> {
    await this.db.createTable({ tableName: TABLE_SKILLS, schema: SKILLS_SCHEMA });
    await this.db.createTable({ tableName: TABLE_SKILL_VERSIONS, schema: SKILL_VERSIONS_SCHEMA });
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
        sql: `DELETE FROM ${quoteIdent(TABLE_SKILLS, 'table name')}
              WHERE ${quoteIdent('status', 'column name')} = 'draft'
                AND ${quoteIdent('activeVersionId', 'column name')} IS NULL
                AND id NOT IN (
                  SELECT ${quoteIdent('skillId', 'column name')}
                  FROM ${quoteIdent(TABLE_SKILL_VERSIONS, 'table name')}
                  WHERE ${quoteIdent('skillId', 'column name')} IS NOT NULL
                )`,
      });
    } catch (error) {
      this.logger?.warn?.('Failed to clean up stale draft skills:', error);
    }
  }

  /** Returns the default index set this domain creates during `init()`. */
  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    return [
      {
        name: 'mastra_skills_status_createdat_idx',
        table: TABLE_SKILLS,
        columns: ['status', 'createdAt DESC'],
      },
      {
        name: 'mastra_skills_authorid_idx',
        table: TABLE_SKILLS,
        columns: ['authorId'],
      },
      // Unique index on (skillId, versionNumber) prevents duplicate versions
      // from concurrent createVersion calls.
      {
        name: 'mastra_skill_versions_unique_idx',
        table: TABLE_SKILL_VERSIONS,
        columns: ['skillId', 'versionNumber'],
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
    await this.db.clearTable({ tableName: TABLE_SKILL_VERSIONS });
    await this.db.clearTable({ tableName: TABLE_SKILLS });
  }

  /** Decodes a raw Spanner thin-row into the public skill shape. */
  private parseSkillRow(row: Record<string, any>): StorageSkillType {
    const transformed = transformFromSpannerRow<Record<string, any>>({ tableName: TABLE_SKILLS, row });
    return {
      id: transformed.id,
      status: transformed.status,
      activeVersionId: transformed.activeVersionId ?? undefined,
      authorId: transformed.authorId ?? undefined,
      visibility: (transformed.visibility as 'private' | 'public' | undefined) ?? undefined,
      // Denormalized favorite counter maintained by the favorites domain. Surface
      // it as 0 when absent so list/get responses carry a stable numeric value.
      favoriteCount:
        transformed.favoriteCount === null || transformed.favoriteCount === undefined
          ? 0
          : Number(transformed.favoriteCount),
      createdAt: transformed.createdAt,
      updatedAt: transformed.updatedAt,
    } as StorageSkillType;
  }

  /** Decodes a raw Spanner version row into the public version shape. */
  private parseVersionRow(row: Record<string, any>): SkillVersion {
    const transformed = transformFromSpannerRow<Record<string, any>>({
      tableName: TABLE_SKILL_VERSIONS,
      row,
    });
    return {
      id: transformed.id,
      skillId: transformed.skillId,
      versionNumber: Number(transformed.versionNumber),
      name: transformed.name,
      description: transformed.description ?? '',
      instructions: transformed.instructions ?? '',
      license: transformed.license ?? undefined,
      compatibility: transformed.compatibility ?? undefined,
      source: transformed.source ?? undefined,
      references: transformed.references ?? undefined,
      scripts: transformed.scripts ?? undefined,
      assets: transformed.assets ?? undefined,
      metadata: transformed.metadata ?? undefined,
      tree: transformed.tree ?? undefined,
      changedFields: transformed.changedFields ?? undefined,
      changeMessage: transformed.changeMessage ?? undefined,
      createdAt: transformed.createdAt,
    };
  }

  /** Fetches the thin skill record by id, or `null` when absent. */
  async getById(id: string): Promise<StorageSkillType | null> {
    try {
      const [rows] = await this.database.run({
        sql: `SELECT * FROM ${quoteIdent(TABLE_SKILLS, 'table name')} WHERE id = @id LIMIT 1`,
        params: { id },
        json: true,
      });
      const row = (rows as Array<Record<string, any>>)[0];
      return row ? this.parseSkillRow(row) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'GET_SKILL_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { skillId: id },
        },
        error,
      );
    }
  }

  /** Atomically inserts a draft thin row + version 1 in a single Spanner transaction. */
  async create(input: { skill: StorageCreateSkillInput }): Promise<StorageSkillType> {
    const { skill } = input;
    try {
      const now = new Date();
      const { id: _id, authorId: _authorId, visibility: _visibility, ...snapshot } = skill as any;
      const visibility = (skill as any).visibility ?? (skill.authorId ? 'private' : null);
      const versionId = globalThis.crypto?.randomUUID
        ? globalThis.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      // Wrap the thin-record insert and the seed-version insert in a single
      // Spanner read-write transaction so they commit or roll back together,
      // making orphaned drafts impossible. runWithAbortRetry handles the
      // ABORTED retry loop; the inner block must be idempotent.
      await this.db.runWithAbortRetry(() =>
        this.database.runTransactionAsync(async tx => {
          try {
            await this.db.insert({
              tableName: TABLE_SKILLS,
              record: {
                id: skill.id,
                status: 'draft',
                activeVersionId: null,
                authorId: skill.authorId ?? null,
                visibility,
                createdAt: now,
                updatedAt: now,
              },
              transaction: tx,
            });
            await this.db.insert({
              tableName: TABLE_SKILL_VERSIONS,
              record: {
                id: versionId,
                skillId: skill.id,
                versionNumber: 1,
                name: (snapshot as any).name,
                description: (snapshot as any).description ?? null,
                instructions: (snapshot as any).instructions ?? null,
                license: (snapshot as any).license ?? null,
                compatibility: (snapshot as any).compatibility ?? null,
                source: (snapshot as any).source ?? null,
                references: (snapshot as any).references ?? null,
                scripts: (snapshot as any).scripts ?? null,
                assets: (snapshot as any).assets ?? null,
                metadata: (snapshot as any).metadata ?? null,
                tree: (snapshot as any).tree ?? null,
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
            await tx.rollback().catch(rollbackErr => {
              throw new AggregateError([err, rollbackErr], 'Transaction and rollback both failed');
            });
            throw err;
          }
        }),
      );

      const created = await this.getById(skill.id);
      if (!created) {
        throw new MastraError({
          id: createStorageErrorId('SPANNER', 'CREATE_SKILL', 'NOT_FOUND_AFTER_CREATE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.SYSTEM,
          text: `Skill ${skill.id} not found after creation`,
          details: { skillId: skill.id },
        });
      }
      return created;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'CREATE_SKILL', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { skillId: skill.id },
        },
        error,
      );
    }
  }

  /** Updates thin-record fields (status, activeVersionId, authorId). */
  async update(input: StorageUpdateSkillInput): Promise<StorageSkillType> {
    const { id, ...updates } = input;
    try {
      const existing = await this.getById(id);
      if (!existing) {
        throw new MastraError({
          id: createStorageErrorId('SPANNER', 'UPDATE_SKILL', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: `Skill ${id} not found`,
          details: { skillId: id },
        });
      }

      // Only thin-record fields land on the entity row; content updates create
      // a new version through the server's auto-versioning layer.
      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (updates.authorId !== undefined) updateData.authorId = updates.authorId;
      if ((updates as any).visibility !== undefined) updateData.visibility = (updates as any).visibility;
      if (updates.activeVersionId !== undefined) updateData.activeVersionId = updates.activeVersionId;
      if (updates.status !== undefined) updateData.status = updates.status;

      await this.db.update({ tableName: TABLE_SKILLS, keys: { id }, data: updateData });

      const updated = await this.getById(id);
      if (!updated) {
        throw new MastraError({
          id: createStorageErrorId('SPANNER', 'UPDATE_SKILL', 'NOT_FOUND_AFTER_UPDATE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.SYSTEM,
          text: `Skill ${id} not found after update`,
          details: { skillId: id },
        });
      }
      return updated;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'UPDATE_SKILL', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { skillId: id },
        },
        error,
      );
    }
  }

  /** Removes a skill and all its versions atomically in a single transaction. */
  async delete(id: string): Promise<void> {
    try {
      await this.db.runWithAbortRetry(() =>
        this.database.runTransactionAsync(async tx => {
          try {
            await tx.runUpdate({
              sql: `DELETE FROM ${quoteIdent(TABLE_SKILL_VERSIONS, 'table name')} WHERE ${quoteIdent('skillId', 'column name')} = @skillId`,
              params: { skillId: id },
            });
            await tx.runUpdate({
              sql: `DELETE FROM ${quoteIdent(TABLE_SKILLS, 'table name')} WHERE id = @id`,
              params: { id },
            });
            await tx.commit();
          } catch (err) {
            await tx.rollback().catch(rollbackErr => {
              throw new AggregateError([err, rollbackErr], 'Transaction and rollback both failed');
            });
            throw err;
          }
        }),
      );
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'DELETE_SKILL', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { skillId: id },
        },
        error,
      );
    }
  }

  /** Paginated listing with optional authorId filter. */
  async list(args?: StorageListSkillsInput): Promise<StorageListSkillsOutput> {
    const {
      page = 0,
      perPage: perPageInput,
      orderBy,
      authorId,
      status,
      visibility,
      entityIds,
      pinFavoritedFor,
      favoritedOnly,
    } = args || {};
    const { field, direction } = this.parseOrderBy(orderBy);

    if (page < 0) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'LIST_SKILLS', 'INVALID_PAGE'),
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
      // Empty entityIds can never match a row — short-circuit before querying.
      if (entityIds && entityIds.length === 0) {
        return { skills: [], total: 0, page, perPage: perPageForResponse, hasMore: false };
      }

      const tableName = quoteIdent(TABLE_SKILLS, 'table name');
      const favoritesTable = quoteIdent(TABLE_FAVORITES, 'table name');
      const conditions: string[] = [];
      const params: Record<string, any> = {};

      const useJoin = Boolean(pinFavoritedFor);
      if (useJoin) params.pinUserId = pinFavoritedFor;

      if (status !== undefined) {
        conditions.push(`a.${quoteIdent('status', 'column name')} = @status`);
        params.status = status;
      }
      if (visibility !== undefined) {
        conditions.push(`a.${quoteIdent('visibility', 'column name')} = @visibility`);
        params.visibility = visibility;
      }
      if (authorId !== undefined) {
        conditions.push(`a.${quoteIdent('authorId', 'column name')} = @authorId`);
        params.authorId = authorId;
      }
      if (entityIds && entityIds.length > 0) {
        const placeholders = entityIds.map((id, i) => {
          const param = `eid${i}`;
          params[param] = id;
          return `@${param}`;
        });
        conditions.push(`a.${quoteIdent('id', 'column name')} IN (${placeholders.join(', ')})`);
      }
      if (useJoin && favoritedOnly) {
        conditions.push(`s.${quoteIdent('userId', 'column name')} IS NOT NULL`);
      } else if (favoritedOnly) {
        conditions.push('1 = 0');
      }

      const joinClause = useJoin
        ? `LEFT JOIN ${favoritesTable} s ON s.${quoteIdent('entityType', 'column name')} = 'skill'` +
          ` AND s.${quoteIdent('entityId', 'column name')} = a.${quoteIdent('id', 'column name')}` +
          ` AND s.${quoteIdent('userId', 'column name')} = @pinUserId`
        : '';
      const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const [countRows] = await this.database.run({
        sql: `SELECT COUNT(*) AS count FROM ${tableName} a ${joinClause} ${whereSql}`,
        params,
        json: true,
      });
      const total = Number((countRows as Array<{ count: number | string }>)[0]?.count ?? 0);
      if (total === 0) {
        return { skills: [], total: 0, page, perPage: perPageForResponse, hasMore: false };
      }

      const limit = perPageInput === false ? total : perPage;
      const dirSql = (direction || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      const orderParts: string[] = [];
      if (useJoin) {
        orderParts.push(`(s.${quoteIdent('userId', 'column name')} IS NOT NULL) DESC`);
      }
      orderParts.push(`a.${quoteIdent(field, 'column name')} ${dirSql}`);
      orderParts.push(`a.${quoteIdent('id', 'column name')} ${dirSql}`);
      const [rows] = await this.database.run({
        sql: `SELECT a.* FROM ${tableName} a ${joinClause} ${whereSql}
              ORDER BY ${orderParts.join(', ')}
              LIMIT @limit OFFSET @offset`,
        params: { ...params, limit, offset },
        json: true,
      });
      const skills = (rows as Array<Record<string, any>>).map(r => this.parseSkillRow(r));
      return {
        skills,
        total,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : offset + perPage < total,
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'LIST_SKILLS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  /** Inserts a new immutable version row for an existing skill. */
  async createVersion(input: CreateSkillVersionInput): Promise<SkillVersion> {
    try {
      const now = new Date();
      await this.db.insert({
        tableName: TABLE_SKILL_VERSIONS,
        record: {
          id: input.id,
          skillId: input.skillId,
          versionNumber: input.versionNumber,
          name: input.name,
          description: input.description ?? null,
          instructions: input.instructions ?? null,
          license: input.license ?? null,
          compatibility: input.compatibility ?? null,
          source: input.source ?? null,
          references: input.references ?? null,
          scripts: input.scripts ?? null,
          assets: input.assets ?? null,
          metadata: input.metadata ?? null,
          tree: input.tree ?? null,
          changedFields: input.changedFields ?? null,
          changeMessage: input.changeMessage ?? null,
          createdAt: now,
        },
      });
      return { ...input, createdAt: now } as SkillVersion;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'CREATE_SKILL_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { versionId: input.id, skillId: input.skillId },
        },
        error,
      );
    }
  }

  /** Fetches a version row by its id, or `null` when absent. */
  async getVersion(id: string): Promise<SkillVersion | null> {
    try {
      const [rows] = await this.database.run({
        sql: `SELECT * FROM ${quoteIdent(TABLE_SKILL_VERSIONS, 'table name')} WHERE id = @id LIMIT 1`,
        params: { id },
        json: true,
      });
      const row = (rows as Array<Record<string, any>>)[0];
      return row ? this.parseVersionRow(row) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'GET_SKILL_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { versionId: id },
        },
        error,
      );
    }
  }

  /** Fetches a specific version by `(skillId, versionNumber)`. */
  async getVersionByNumber(skillId: string, versionNumber: number): Promise<SkillVersion | null> {
    try {
      const [rows] = await this.database.run({
        sql: `SELECT * FROM ${quoteIdent(TABLE_SKILL_VERSIONS, 'table name')}
              WHERE ${quoteIdent('skillId', 'column name')} = @skillId
                AND ${quoteIdent('versionNumber', 'column name')} = @versionNumber
              LIMIT 1`,
        params: { skillId, versionNumber },
        json: true,
      });
      const row = (rows as Array<Record<string, any>>)[0];
      return row ? this.parseVersionRow(row) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'GET_SKILL_VERSION_BY_NUMBER', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { skillId, versionNumber },
        },
        error,
      );
    }
  }

  /** Returns the highest-numbered version for a skill. */
  async getLatestVersion(skillId: string): Promise<SkillVersion | null> {
    try {
      const [rows] = await this.database.run({
        sql: `SELECT * FROM ${quoteIdent(TABLE_SKILL_VERSIONS, 'table name')}
              WHERE ${quoteIdent('skillId', 'column name')} = @skillId
              ORDER BY ${quoteIdent('versionNumber', 'column name')} DESC
              LIMIT 1`,
        params: { skillId },
        json: true,
      });
      const row = (rows as Array<Record<string, any>>)[0];
      return row ? this.parseVersionRow(row) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'GET_SKILL_LATEST_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { skillId },
        },
        error,
      );
    }
  }

  /** Paginated listing of versions for a single skill. */
  async listVersions(input: ListSkillVersionsInput): Promise<ListSkillVersionsOutput> {
    const { skillId, page = 0, perPage: perPageInput, orderBy } = input;
    if (page < 0) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'LIST_SKILL_VERSIONS', 'INVALID_PAGE'),
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
      const tableName = quoteIdent(TABLE_SKILL_VERSIONS, 'table name');

      const [countRows] = await this.database.run({
        sql: `SELECT COUNT(*) AS count FROM ${tableName} WHERE ${quoteIdent('skillId', 'column name')} = @skillId`,
        params: { skillId },
        json: true,
      });
      const total = Number((countRows as Array<{ count: number | string }>)[0]?.count ?? 0);
      if (total === 0) {
        return { versions: [], total: 0, page, perPage: perPageForResponse, hasMore: false };
      }

      const limit = perPageInput === false ? total : perPage;
      const [rows] = await this.database.run({
        sql: `SELECT * FROM ${tableName}
              WHERE ${quoteIdent('skillId', 'column name')} = @skillId
              ORDER BY ${quoteIdent(field, 'column name')} ${dirSql}, id ${dirSql}
              LIMIT @limit OFFSET @offset`,
        params: { skillId, limit, offset },
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
          id: createStorageErrorId('SPANNER', 'LIST_SKILL_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { skillId },
        },
        error,
      );
    }
  }

  /** Deletes a single version row by id. */
  async deleteVersion(id: string): Promise<void> {
    try {
      await this.db.runDml({
        sql: `DELETE FROM ${quoteIdent(TABLE_SKILL_VERSIONS, 'table name')} WHERE id = @id`,
        params: { id },
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'DELETE_SKILL_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { versionId: id },
        },
        error,
      );
    }
  }

  /** Deletes every version row belonging to the given skill. */
  async deleteVersionsByParentId(entityId: string): Promise<void> {
    try {
      await this.db.runDml({
        sql: `DELETE FROM ${quoteIdent(TABLE_SKILL_VERSIONS, 'table name')} WHERE ${quoteIdent('skillId', 'column name')} = @skillId`,
        params: { skillId: entityId },
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'DELETE_SKILL_VERSIONS_BY_PARENT_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { skillId: entityId },
        },
        error,
      );
    }
  }

  /** Returns the total number of version rows for the given skill. */
  async countVersions(skillId: string): Promise<number> {
    try {
      const [rows] = await this.database.run({
        sql: `SELECT COUNT(*) AS count FROM ${quoteIdent(TABLE_SKILL_VERSIONS, 'table name')} WHERE ${quoteIdent('skillId', 'column name')} = @skillId`,
        params: { skillId },
        json: true,
      });
      return Number((rows as Array<{ count: number | string }>)[0]?.count ?? 0);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'COUNT_SKILL_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { skillId },
        },
        error,
      );
    }
  }
}
