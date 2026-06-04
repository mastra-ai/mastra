import type { Database } from '@google-cloud/spanner';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  calculatePagination,
  createStorageErrorId,
  normalizePerPage,
  PromptBlocksStorage,
  PROMPT_BLOCKS_SCHEMA,
  PROMPT_BLOCK_VERSIONS_SCHEMA,
  TABLE_PROMPT_BLOCKS,
  TABLE_PROMPT_BLOCK_VERSIONS,
} from '@mastra/core/storage';
import type {
  CreateIndexOptions,
  StoragePromptBlockType,
  StorageCreatePromptBlockInput,
  StorageListPromptBlocksInput,
  StorageListPromptBlocksOutput,
  StorageUpdatePromptBlockInput,
} from '@mastra/core/storage';
import type {
  CreatePromptBlockVersionInput,
  ListPromptBlockVersionsInput,
  ListPromptBlockVersionsOutput,
  PromptBlockVersion,
} from '@mastra/core/storage/domains/prompt-blocks';
import { SpannerDB, resolveSpannerConfig } from '../../db';
import type { SpannerDomainConfig } from '../../db';
import { quoteIdent } from '../../db/utils';
import { transformFromSpannerRow } from '../utils';

/**
 * Spanner-backed storage for prompt blocks and their immutable versions.
 * Mirrors the thin-record + versions pattern used by agents/skills/scorer-definitions.
 */
export class PromptBlocksSpanner extends PromptBlocksStorage {
  private database: Database;
  private db: SpannerDB;
  private readonly skipDefaultIndexes?: boolean;
  private readonly indexes?: CreateIndexOptions[];

  static readonly MANAGED_TABLES = [TABLE_PROMPT_BLOCKS, TABLE_PROMPT_BLOCK_VERSIONS] as const;

  constructor(config: SpannerDomainConfig) {
    super();
    const { database, indexes, skipDefaultIndexes, initMode, cleanupStaleDraftsOnStartup } =
      resolveSpannerConfig(config);
    this.database = database;
    this.db = new SpannerDB({ database, skipDefaultIndexes, initMode, cleanupStaleDraftsOnStartup });
    this.skipDefaultIndexes = skipDefaultIndexes;
    this.indexes = indexes?.filter(idx =>
      (PromptBlocksSpanner.MANAGED_TABLES as readonly string[]).includes(idx.table),
    );
  }

  /** Creates the prompt-block tables, indexes, and (when opted in) sweeps stale drafts. */
  async init(): Promise<void> {
    await this.db.createTable({ tableName: TABLE_PROMPT_BLOCKS, schema: PROMPT_BLOCKS_SCHEMA });
    await this.db.createTable({ tableName: TABLE_PROMPT_BLOCK_VERSIONS, schema: PROMPT_BLOCK_VERSIONS_SCHEMA });
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
    // Sweep any orphaned drafts left behind by previous partial create() calls.
    await this.cleanupStaleDrafts();
  }

  /**
   * Removes orphaned draft prompt-block records where the paired version row
   * was never written. Skipped under `initMode: 'validate'` (no destructive
   * DML in validate mode).
   */
  private async cleanupStaleDrafts(): Promise<void> {
    if (this.db.initMode === 'validate') return;
    if (!this.db.cleanupStaleDraftsOnStartup) return;
    try {
      await this.db.runDml({
        sql: `DELETE FROM ${quoteIdent(TABLE_PROMPT_BLOCKS, 'table name')}
              WHERE ${quoteIdent('status', 'column name')} = 'draft'
                AND ${quoteIdent('activeVersionId', 'column name')} IS NULL
                AND id NOT IN (
                  SELECT ${quoteIdent('blockId', 'column name')}
                  FROM ${quoteIdent(TABLE_PROMPT_BLOCK_VERSIONS, 'table name')}
                  WHERE ${quoteIdent('blockId', 'column name')} IS NOT NULL
                )`,
      });
    } catch (error) {
      this.logger?.warn?.('Failed to clean up stale draft prompt blocks:', error);
    }
  }

  /** Returns the default index set this domain creates during `init()`. */
  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    return [
      {
        name: 'mastra_prompt_blocks_status_createdat_idx',
        table: TABLE_PROMPT_BLOCKS,
        columns: ['status', 'createdAt DESC'],
      },
      {
        name: 'mastra_prompt_blocks_authorid_idx',
        table: TABLE_PROMPT_BLOCKS,
        columns: ['authorId'],
      },
      // Unique index on (blockId, versionNumber) prevents duplicate versions
      // from concurrent createVersion calls.
      {
        name: 'mastra_prompt_block_versions_unique_idx',
        table: TABLE_PROMPT_BLOCK_VERSIONS,
        columns: ['blockId', 'versionNumber'],
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
    await this.db.clearTable({ tableName: TABLE_PROMPT_BLOCK_VERSIONS });
    await this.db.clearTable({ tableName: TABLE_PROMPT_BLOCKS });
  }

  /** Decodes a raw Spanner thin-row into the public prompt-block shape. */
  private parsePromptBlockRow(row: Record<string, any>): StoragePromptBlockType {
    const transformed = transformFromSpannerRow<Record<string, any>>({ tableName: TABLE_PROMPT_BLOCKS, row });
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
  private parseVersionRow(row: Record<string, any>): PromptBlockVersion {
    const transformed = transformFromSpannerRow<Record<string, any>>({
      tableName: TABLE_PROMPT_BLOCK_VERSIONS,
      row,
    });
    return {
      id: transformed.id,
      blockId: transformed.blockId,
      versionNumber: Number(transformed.versionNumber),
      name: transformed.name,
      description: transformed.description ?? undefined,
      content: transformed.content ?? '',
      rules: transformed.rules ?? undefined,
      requestContextSchema: transformed.requestContextSchema ?? undefined,
      changedFields: transformed.changedFields ?? undefined,
      changeMessage: transformed.changeMessage ?? undefined,
      createdAt: transformed.createdAt,
    };
  }

  /** Fetches the thin prompt-block record by id, or `null` when absent. */
  async getById(id: string): Promise<StoragePromptBlockType | null> {
    try {
      const [rows] = await this.database.run({
        sql: `SELECT * FROM ${quoteIdent(TABLE_PROMPT_BLOCKS, 'table name')} WHERE id = @id LIMIT 1`,
        params: { id },
        json: true,
      });
      const row = (rows as Array<Record<string, any>>)[0];
      return row ? this.parsePromptBlockRow(row) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'GET_PROMPT_BLOCK_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { blockId: id },
        },
        error,
      );
    }
  }

  /** Atomically inserts a draft thin row + version 1 in a single Spanner transaction. */
  async create(input: { promptBlock: StorageCreatePromptBlockInput }): Promise<StoragePromptBlockType> {
    const { promptBlock } = input;
    try {
      const now = new Date();
      const { id: _id, authorId: _authorId, metadata: _metadata, ...snapshot } = promptBlock;
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
              tableName: TABLE_PROMPT_BLOCKS,
              record: {
                id: promptBlock.id,
                status: 'draft',
                activeVersionId: null,
                authorId: promptBlock.authorId ?? null,
                metadata: promptBlock.metadata ?? null,
                createdAt: now,
                updatedAt: now,
              },
              transaction: tx,
            });
            await this.db.insert({
              tableName: TABLE_PROMPT_BLOCK_VERSIONS,
              record: {
                id: versionId,
                blockId: promptBlock.id,
                versionNumber: 1,
                name: (snapshot as any).name,
                description: (snapshot as any).description ?? null,
                content: (snapshot as any).content ?? '',
                rules: (snapshot as any).rules ?? null,
                requestContextSchema: (snapshot as any).requestContextSchema ?? null,
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

      const created = await this.getById(promptBlock.id);
      if (!created) {
        throw new MastraError({
          id: createStorageErrorId('SPANNER', 'CREATE_PROMPT_BLOCK', 'NOT_FOUND_AFTER_CREATE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.SYSTEM,
          text: `Prompt block ${promptBlock.id} not found after creation`,
          details: { blockId: promptBlock.id },
        });
      }
      return created;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'CREATE_PROMPT_BLOCK', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { blockId: promptBlock.id },
        },
        error,
      );
    }
  }

  /** Updates thin-record fields (status, activeVersionId, authorId, metadata). */
  async update(input: StorageUpdatePromptBlockInput): Promise<StoragePromptBlockType> {
    const { id, ...updates } = input;
    try {
      const existing = await this.getById(id);
      if (!existing) {
        throw new MastraError({
          id: createStorageErrorId('SPANNER', 'UPDATE_PROMPT_BLOCK', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: `Prompt block ${id} not found`,
          details: { blockId: id },
        });
      }

      // Only thin-record fields land on the entity row; content updates create
      // a new version through the server's auto-versioning layer.
      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (updates.authorId !== undefined) updateData.authorId = updates.authorId;
      if (updates.activeVersionId !== undefined) updateData.activeVersionId = updates.activeVersionId;
      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.metadata !== undefined) updateData.metadata = updates.metadata ?? null;

      await this.db.update({ tableName: TABLE_PROMPT_BLOCKS, keys: { id }, data: updateData });

      const updated = await this.getById(id);
      if (!updated) {
        throw new MastraError({
          id: createStorageErrorId('SPANNER', 'UPDATE_PROMPT_BLOCK', 'NOT_FOUND_AFTER_UPDATE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.SYSTEM,
          text: `Prompt block ${id} not found after update`,
          details: { blockId: id },
        });
      }
      return updated;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'UPDATE_PROMPT_BLOCK', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { blockId: id },
        },
        error,
      );
    }
  }

  /** Removes a prompt block and all its versions atomically in a single transaction. */
  async delete(id: string): Promise<void> {
    try {
      await this.db.runWithAbortRetry(() =>
        this.database.runTransactionAsync(async tx => {
          try {
            await tx.runUpdate({
              sql: `DELETE FROM ${quoteIdent(TABLE_PROMPT_BLOCK_VERSIONS, 'table name')} WHERE ${quoteIdent('blockId', 'column name')} = @blockId`,
              params: { blockId: id },
            });
            await tx.runUpdate({
              sql: `DELETE FROM ${quoteIdent(TABLE_PROMPT_BLOCKS, 'table name')} WHERE id = @id`,
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
          id: createStorageErrorId('SPANNER', 'DELETE_PROMPT_BLOCK', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { blockId: id },
        },
        error,
      );
    }
  }

  /** Paginated listing with optional status / authorId / metadata filters. */
  async list(args?: StorageListPromptBlocksInput): Promise<StorageListPromptBlocksOutput> {
    const { page = 0, perPage: perPageInput, orderBy, authorId, metadata, status } = args || {};
    const { field, direction } = this.parseOrderBy(orderBy);

    if (page < 0) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'LIST_PROMPT_BLOCKS', 'INVALID_PAGE'),
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
      const tableName = quoteIdent(TABLE_PROMPT_BLOCKS, 'table name');
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
          if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
            throw new MastraError({
              id: createStorageErrorId('SPANNER', 'LIST_PROMPT_BLOCKS', 'INVALID_METADATA_KEY'),
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
        return { promptBlocks: [], total: 0, page, perPage: perPageForResponse, hasMore: false };
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
      const promptBlocks = (rows as Array<Record<string, any>>).map(r => this.parsePromptBlockRow(r));
      return {
        promptBlocks,
        total,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : offset + perPage < total,
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'LIST_PROMPT_BLOCKS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  /** Inserts a new immutable version row for an existing prompt block. */
  async createVersion(input: CreatePromptBlockVersionInput): Promise<PromptBlockVersion> {
    try {
      const now = new Date();
      await this.db.insert({
        tableName: TABLE_PROMPT_BLOCK_VERSIONS,
        record: {
          id: input.id,
          blockId: input.blockId,
          versionNumber: input.versionNumber,
          name: input.name,
          description: input.description ?? null,
          content: input.content ?? '',
          rules: input.rules ?? null,
          requestContextSchema: input.requestContextSchema ?? null,
          changedFields: input.changedFields ?? null,
          changeMessage: input.changeMessage ?? null,
          createdAt: now,
        },
      });
      return { ...input, createdAt: now } as PromptBlockVersion;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'CREATE_PROMPT_BLOCK_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { versionId: input.id, blockId: input.blockId },
        },
        error,
      );
    }
  }

  /** Fetches a version row by its id, or `null` when absent. */
  async getVersion(id: string): Promise<PromptBlockVersion | null> {
    try {
      const [rows] = await this.database.run({
        sql: `SELECT * FROM ${quoteIdent(TABLE_PROMPT_BLOCK_VERSIONS, 'table name')} WHERE id = @id LIMIT 1`,
        params: { id },
        json: true,
      });
      const row = (rows as Array<Record<string, any>>)[0];
      return row ? this.parseVersionRow(row) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'GET_PROMPT_BLOCK_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { versionId: id },
        },
        error,
      );
    }
  }

  /** Fetches a specific version by `(blockId, versionNumber)`. */
  async getVersionByNumber(blockId: string, versionNumber: number): Promise<PromptBlockVersion | null> {
    try {
      const [rows] = await this.database.run({
        sql: `SELECT * FROM ${quoteIdent(TABLE_PROMPT_BLOCK_VERSIONS, 'table name')}
              WHERE ${quoteIdent('blockId', 'column name')} = @blockId
                AND ${quoteIdent('versionNumber', 'column name')} = @versionNumber
              LIMIT 1`,
        params: { blockId, versionNumber },
        json: true,
      });
      const row = (rows as Array<Record<string, any>>)[0];
      return row ? this.parseVersionRow(row) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'GET_PROMPT_BLOCK_VERSION_BY_NUMBER', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { blockId, versionNumber },
        },
        error,
      );
    }
  }

  /** Returns the highest-numbered version for a prompt block. */
  async getLatestVersion(blockId: string): Promise<PromptBlockVersion | null> {
    try {
      const [rows] = await this.database.run({
        sql: `SELECT * FROM ${quoteIdent(TABLE_PROMPT_BLOCK_VERSIONS, 'table name')}
              WHERE ${quoteIdent('blockId', 'column name')} = @blockId
              ORDER BY ${quoteIdent('versionNumber', 'column name')} DESC
              LIMIT 1`,
        params: { blockId },
        json: true,
      });
      const row = (rows as Array<Record<string, any>>)[0];
      return row ? this.parseVersionRow(row) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'GET_PROMPT_BLOCK_LATEST_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { blockId },
        },
        error,
      );
    }
  }

  /** Paginated listing of versions for a single prompt block. */
  async listVersions(input: ListPromptBlockVersionsInput): Promise<ListPromptBlockVersionsOutput> {
    const { blockId, page = 0, perPage: perPageInput, orderBy } = input;
    if (page < 0) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'LIST_PROMPT_BLOCK_VERSIONS', 'INVALID_PAGE'),
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
      const tableName = quoteIdent(TABLE_PROMPT_BLOCK_VERSIONS, 'table name');

      const [countRows] = await this.database.run({
        sql: `SELECT COUNT(*) AS count FROM ${tableName} WHERE ${quoteIdent('blockId', 'column name')} = @blockId`,
        params: { blockId },
        json: true,
      });
      const total = Number((countRows as Array<{ count: number | string }>)[0]?.count ?? 0);
      if (total === 0) {
        return { versions: [], total: 0, page, perPage: perPageForResponse, hasMore: false };
      }

      const limit = perPageInput === false ? total : perPage;
      const [rows] = await this.database.run({
        sql: `SELECT * FROM ${tableName}
              WHERE ${quoteIdent('blockId', 'column name')} = @blockId
              ORDER BY ${quoteIdent(field, 'column name')} ${dirSql}, id ${dirSql}
              LIMIT @limit OFFSET @offset`,
        params: { blockId, limit, offset },
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
          id: createStorageErrorId('SPANNER', 'LIST_PROMPT_BLOCK_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { blockId },
        },
        error,
      );
    }
  }

  /** Deletes a single version row by id. */
  async deleteVersion(id: string): Promise<void> {
    try {
      await this.db.runDml({
        sql: `DELETE FROM ${quoteIdent(TABLE_PROMPT_BLOCK_VERSIONS, 'table name')} WHERE id = @id`,
        params: { id },
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'DELETE_PROMPT_BLOCK_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { versionId: id },
        },
        error,
      );
    }
  }

  /** Deletes every version row belonging to the given prompt block. */
  async deleteVersionsByParentId(entityId: string): Promise<void> {
    try {
      await this.db.runDml({
        sql: `DELETE FROM ${quoteIdent(TABLE_PROMPT_BLOCK_VERSIONS, 'table name')} WHERE ${quoteIdent('blockId', 'column name')} = @blockId`,
        params: { blockId: entityId },
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'DELETE_PROMPT_BLOCK_VERSIONS_BY_PARENT_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { blockId: entityId },
        },
        error,
      );
    }
  }

  /** Returns the total number of version rows for the given prompt block. */
  async countVersions(blockId: string): Promise<number> {
    try {
      const [rows] = await this.database.run({
        sql: `SELECT COUNT(*) AS count FROM ${quoteIdent(TABLE_PROMPT_BLOCK_VERSIONS, 'table name')} WHERE ${quoteIdent('blockId', 'column name')} = @blockId`,
        params: { blockId },
        json: true,
      });
      return Number((rows as Array<{ count: number | string }>)[0]?.count ?? 0);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'COUNT_PROMPT_BLOCK_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { blockId },
        },
        error,
      );
    }
  }
}
