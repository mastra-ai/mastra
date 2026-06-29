import type { Database } from '@google-cloud/spanner';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  calculatePagination,
  createStorageErrorId,
  normalizePerPage,
  WorkspacesStorage,
  WORKSPACES_SCHEMA,
  WORKSPACE_VERSIONS_SCHEMA,
  TABLE_WORKSPACES,
  TABLE_WORKSPACE_VERSIONS,
} from '@mastra/core/storage';
import type {
  CreateIndexOptions,
  StorageCreateWorkspaceInput,
  StorageListWorkspacesInput,
  StorageListWorkspacesOutput,
  StorageUpdateWorkspaceInput,
  StorageWorkspaceType,
} from '@mastra/core/storage';
import type {
  CreateWorkspaceVersionInput,
  ListWorkspaceVersionsInput,
  ListWorkspaceVersionsOutput,
  WorkspaceVersion,
} from '@mastra/core/storage/domains/workspaces';
import { SpannerDB, resolveSpannerConfig } from '../../db';
import type { SpannerDomainConfig } from '../../db';
import { quoteIdent } from '../../db/utils';
import { transformFromSpannerRow } from '../utils';

/** Snapshot config fields that live exclusively on version rows. */
const SNAPSHOT_FIELDS = [
  'name',
  'description',
  'filesystem',
  'sandbox',
  'mounts',
  'search',
  'skills',
  'tools',
  'autoSync',
  'operationTimeout',
] as const;

/**
 * Spanner-backed storage for workspaces and their immutable version snapshots.
 * Mirrors the thin-record + versions pattern used by skills/agents: the
 * `mastra_workspaces` row holds only metadata (status, activeVersionId, authorId,
 * metadata) while all configuration lives in `mastra_workspace_versions`.
 */
export class WorkspacesSpanner extends WorkspacesStorage {
  private database: Database;
  private db: SpannerDB;
  private readonly skipDefaultIndexes?: boolean;
  private readonly indexes?: CreateIndexOptions[];

  static readonly MANAGED_TABLES = [TABLE_WORKSPACES, TABLE_WORKSPACE_VERSIONS] as const;

  constructor(config: SpannerDomainConfig) {
    super();
    const { database, indexes, skipDefaultIndexes, initMode, cleanupStaleDraftsOnStartup } =
      resolveSpannerConfig(config);
    this.database = database;
    this.db = new SpannerDB({ database, skipDefaultIndexes, initMode, cleanupStaleDraftsOnStartup });
    this.skipDefaultIndexes = skipDefaultIndexes;
    this.indexes = indexes?.filter(idx => (WorkspacesSpanner.MANAGED_TABLES as readonly string[]).includes(idx.table));
  }

  async init(): Promise<void> {
    await this.db.createTable({ tableName: TABLE_WORKSPACES, schema: WORKSPACES_SCHEMA });
    await this.db.createTable({ tableName: TABLE_WORKSPACE_VERSIONS, schema: WORKSPACE_VERSIONS_SCHEMA });
    await this.createDefaultIndexes();
    await this.createCustomIndexes();
    await this.cleanupStaleDrafts();
  }

  private async cleanupStaleDrafts(): Promise<void> {
    if (this.db.initMode === 'validate') return;
    if (!this.db.cleanupStaleDraftsOnStartup) return;
    try {
      await this.db.runDml({
        sql: `DELETE FROM ${quoteIdent(TABLE_WORKSPACES, 'table name')}
              WHERE ${quoteIdent('status', 'column name')} = 'draft'
                AND ${quoteIdent('activeVersionId', 'column name')} IS NULL
                AND id NOT IN (
                  SELECT ${quoteIdent('workspaceId', 'column name')}
                  FROM ${quoteIdent(TABLE_WORKSPACE_VERSIONS, 'table name')}
                  WHERE ${quoteIdent('workspaceId', 'column name')} IS NOT NULL
                )`,
      });
    } catch (error) {
      this.logger?.warn?.('Failed to clean up stale draft workspaces:', error);
    }
  }

  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    return [
      {
        name: 'mastra_workspaces_status_createdat_idx',
        table: TABLE_WORKSPACES,
        columns: ['status', 'createdAt DESC'],
      },
      {
        name: 'mastra_workspaces_authorid_idx',
        table: TABLE_WORKSPACES,
        columns: ['authorId'],
      },
      {
        name: 'mastra_workspace_versions_unique_idx',
        table: TABLE_WORKSPACE_VERSIONS,
        columns: ['workspaceId', 'versionNumber'],
        unique: true,
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

  async dangerouslyClearAll(): Promise<void> {
    await this.db.clearTable({ tableName: TABLE_WORKSPACE_VERSIONS });
    await this.db.clearTable({ tableName: TABLE_WORKSPACES });
  }

  private parseWorkspaceRow(row: Record<string, any>): StorageWorkspaceType {
    const t = transformFromSpannerRow<Record<string, any>>({ tableName: TABLE_WORKSPACES, row });
    return {
      id: t.id,
      status: t.status,
      activeVersionId: t.activeVersionId ?? undefined,
      authorId: t.authorId ?? undefined,
      metadata: t.metadata ?? undefined,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    };
  }

  private parseVersionRow(row: Record<string, any>): WorkspaceVersion {
    const t = transformFromSpannerRow<Record<string, any>>({ tableName: TABLE_WORKSPACE_VERSIONS, row });
    return {
      id: t.id,
      workspaceId: t.workspaceId,
      versionNumber: Number(t.versionNumber),
      name: t.name,
      description: t.description ?? undefined,
      filesystem: t.filesystem ?? undefined,
      sandbox: t.sandbox ?? undefined,
      mounts: t.mounts ?? undefined,
      search: t.search ?? undefined,
      skills: t.skills ?? undefined,
      tools: t.tools ?? undefined,
      autoSync: t.autoSync == null ? undefined : Boolean(t.autoSync),
      operationTimeout: t.operationTimeout == null ? undefined : Number(t.operationTimeout),
      changedFields: t.changedFields ?? undefined,
      changeMessage: t.changeMessage ?? undefined,
      createdAt: t.createdAt,
    };
  }

  async getById(id: string): Promise<StorageWorkspaceType | null> {
    try {
      const [rows] = await this.database.run({
        sql: `SELECT * FROM ${quoteIdent(TABLE_WORKSPACES, 'table name')} WHERE id = @id LIMIT 1`,
        params: { id },
        json: true,
      });
      const row = (rows as Array<Record<string, any>>)[0];
      return row ? this.parseWorkspaceRow(row) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'GET_WORKSPACE_BY_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { workspaceId: id },
        },
        error,
      );
    }
  }

  async create(input: { workspace: StorageCreateWorkspaceInput }): Promise<StorageWorkspaceType> {
    const { workspace } = input;
    try {
      const now = new Date();
      const { id: _id, authorId: _authorId, metadata: _metadata, ...snapshot } = workspace;
      const versionId = globalThis.crypto?.randomUUID
        ? globalThis.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      await this.db.runWithAbortRetry(() =>
        this.database.runTransactionAsync(async tx => {
          try {
            await this.db.insert({
              tableName: TABLE_WORKSPACES,
              record: {
                id: workspace.id,
                status: 'draft',
                activeVersionId: null,
                authorId: workspace.authorId ?? null,
                metadata: workspace.metadata ?? null,
                createdAt: now,
                updatedAt: now,
              },
              transaction: tx,
            });
            await this.db.insert({
              tableName: TABLE_WORKSPACE_VERSIONS,
              record: {
                id: versionId,
                workspaceId: workspace.id,
                versionNumber: 1,
                name: (snapshot as any).name,
                description: (snapshot as any).description ?? null,
                filesystem: (snapshot as any).filesystem ?? null,
                sandbox: (snapshot as any).sandbox ?? null,
                mounts: (snapshot as any).mounts ?? null,
                search: (snapshot as any).search ?? null,
                skills: (snapshot as any).skills ?? null,
                tools: (snapshot as any).tools ?? null,
                autoSync: (snapshot as any).autoSync ?? false,
                operationTimeout: (snapshot as any).operationTimeout ?? null,
                changedFields: [...SNAPSHOT_FIELDS],
                changeMessage: 'Initial version',
                createdAt: now,
              },
              transaction: tx,
            });
            await tx.commit();
          } catch (err) {
            await tx.rollback();
            throw err;
          }
        }),
      );

      const created = await this.getById(workspace.id);
      if (!created) {
        throw new MastraError({
          id: createStorageErrorId('SPANNER', 'CREATE_WORKSPACE', 'NOT_FOUND_AFTER_CREATE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.SYSTEM,
          text: `Workspace ${workspace.id} not found after creation`,
          details: { workspaceId: workspace.id },
        });
      }
      return created;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'CREATE_WORKSPACE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { workspaceId: workspace.id },
        },
        error,
      );
    }
  }

  async update(input: StorageUpdateWorkspaceInput): Promise<StorageWorkspaceType> {
    const { id, ...updates } = input;
    try {
      const existing = await this.getById(id);
      if (!existing) {
        throw new MastraError({
          id: createStorageErrorId('SPANNER', 'UPDATE_WORKSPACE', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: `Workspace ${id} not found`,
          details: { workspaceId: id },
        });
      }

      const { authorId, activeVersionId, metadata, status, ...rawConfigFields } = updates;

      // Strip undefined config keys so omitted PATCH fields don't overwrite values.
      const configFields: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(rawConfigFields)) {
        if (value !== undefined) configFields[key] = value;
      }

      const hasConfigUpdate = SNAPSHOT_FIELDS.some(field => field in configFields);
      if (hasConfigUpdate) {
        const latestVersion = await this.getLatestVersion(id);
        if (!latestVersion) {
          throw new MastraError({
            id: createStorageErrorId('SPANNER', 'UPDATE_WORKSPACE', 'NO_VERSIONS'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.SYSTEM,
            text: `No versions found for workspace ${id}`,
            details: { workspaceId: id },
          });
        }

        const {
          id: _vid,
          workspaceId: _wid,
          versionNumber: _vnum,
          changedFields: _cf,
          changeMessage: _cm,
          createdAt: _ca,
          ...latestConfig
        } = latestVersion;

        const newConfig = { ...latestConfig, ...configFields };
        const changedFields = SNAPSHOT_FIELDS.filter(
          field =>
            field in configFields &&
            JSON.stringify(configFields[field]) !== JSON.stringify((latestConfig as Record<string, unknown>)[field]),
        );

        if (changedFields.length > 0) {
          const newVersionId = globalThis.crypto?.randomUUID
            ? globalThis.crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
          await this.createVersion({
            id: newVersionId,
            workspaceId: id,
            versionNumber: latestVersion.versionNumber + 1,
            ...(newConfig as object),
            changedFields: [...changedFields],
            changeMessage: `Updated ${changedFields.join(', ')}`,
          } as CreateWorkspaceVersionInput);
        }
      }

      const data: Record<string, unknown> = { updatedAt: new Date() };
      if (authorId !== undefined) data.authorId = authorId;
      if (activeVersionId !== undefined) {
        data.activeVersionId = activeVersionId;
        // Auto-publish when an active version is set (consistent with other adapters).
        if (status === undefined) data.status = 'published';
      }
      if (status !== undefined) data.status = status;
      if (metadata !== undefined) {
        data.metadata = { ...(existing.metadata || {}), ...metadata };
      }

      await this.db.update({ tableName: TABLE_WORKSPACES, keys: { id }, data });

      const updated = await this.getById(id);
      if (!updated) {
        throw new MastraError({
          id: createStorageErrorId('SPANNER', 'UPDATE_WORKSPACE', 'NOT_FOUND_AFTER_UPDATE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.SYSTEM,
          text: `Workspace ${id} not found after update`,
          details: { workspaceId: id },
        });
      }
      return updated;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'UPDATE_WORKSPACE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { workspaceId: id },
        },
        error,
      );
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.db.runWithAbortRetry(() =>
        this.database.runTransactionAsync(async tx => {
          try {
            await tx.runUpdate({
              sql: `DELETE FROM ${quoteIdent(TABLE_WORKSPACE_VERSIONS, 'table name')} WHERE ${quoteIdent('workspaceId', 'column name')} = @workspaceId`,
              params: { workspaceId: id },
            });
            await tx.runUpdate({
              sql: `DELETE FROM ${quoteIdent(TABLE_WORKSPACES, 'table name')} WHERE id = @id`,
              params: { id },
            });
            await tx.commit();
          } catch (err) {
            await tx.rollback();
            throw err;
          }
        }),
      );
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'DELETE_WORKSPACE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { workspaceId: id },
        },
        error,
      );
    }
  }

  async list(args?: StorageListWorkspacesInput): Promise<StorageListWorkspacesOutput> {
    const { page = 0, perPage: perPageInput, orderBy, authorId, metadata } = args || {};
    const { field, direction } = this.parseOrderBy(orderBy);

    if (page < 0) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'LIST_WORKSPACES', 'INVALID_PAGE'),
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
      const tableName = quoteIdent(TABLE_WORKSPACES, 'table name');
      const conditions: string[] = [];
      const params: Record<string, any> = {};

      if (authorId !== undefined) {
        conditions.push(`${quoteIdent('authorId', 'column name')} = @authorId`);
        params.authorId = authorId;
      }
      if (metadata && Object.keys(metadata).length > 0) {
        let i = 0;
        for (const [key, value] of Object.entries(metadata)) {
          if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
            throw new MastraError({
              id: createStorageErrorId('SPANNER', 'LIST_WORKSPACES', 'INVALID_METADATA_KEY'),
              domain: ErrorDomain.STORAGE,
              category: ErrorCategory.USER,
              text: `Invalid metadata key: ${key}. Keys must be alphanumeric with underscores.`,
              details: { key },
            });
          }
          const param = `m${i++}`;
          conditions.push(`JSON_VALUE(${quoteIdent('metadata', 'column name')}, '$.${key}') = @${param}`);
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
        return { workspaces: [], total: 0, page, perPage: perPageForResponse, hasMore: false };
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
      const workspaces = (rows as Array<Record<string, any>>).map(r => this.parseWorkspaceRow(r));
      return {
        workspaces,
        total,
        page,
        perPage: perPageForResponse,
        hasMore: perPageInput === false ? false : offset + perPage < total,
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'LIST_WORKSPACES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async createVersion(input: CreateWorkspaceVersionInput): Promise<WorkspaceVersion> {
    try {
      const now = new Date();
      await this.db.insert({
        tableName: TABLE_WORKSPACE_VERSIONS,
        record: {
          id: input.id,
          workspaceId: input.workspaceId,
          versionNumber: input.versionNumber,
          name: input.name,
          description: input.description ?? null,
          filesystem: input.filesystem ?? null,
          sandbox: input.sandbox ?? null,
          mounts: input.mounts ?? null,
          search: input.search ?? null,
          skills: input.skills ?? null,
          tools: input.tools ?? null,
          autoSync: input.autoSync ?? false,
          operationTimeout: input.operationTimeout ?? null,
          changedFields: input.changedFields ?? null,
          changeMessage: input.changeMessage ?? null,
          createdAt: now,
        },
      });
      return { ...input, createdAt: now } as WorkspaceVersion;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'CREATE_WORKSPACE_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { versionId: input.id, workspaceId: input.workspaceId },
        },
        error,
      );
    }
  }

  async getVersion(id: string): Promise<WorkspaceVersion | null> {
    try {
      const [rows] = await this.database.run({
        sql: `SELECT * FROM ${quoteIdent(TABLE_WORKSPACE_VERSIONS, 'table name')} WHERE id = @id LIMIT 1`,
        params: { id },
        json: true,
      });
      const row = (rows as Array<Record<string, any>>)[0];
      return row ? this.parseVersionRow(row) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'GET_WORKSPACE_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { versionId: id },
        },
        error,
      );
    }
  }

  async getVersionByNumber(workspaceId: string, versionNumber: number): Promise<WorkspaceVersion | null> {
    try {
      const [rows] = await this.database.run({
        sql: `SELECT * FROM ${quoteIdent(TABLE_WORKSPACE_VERSIONS, 'table name')}
              WHERE ${quoteIdent('workspaceId', 'column name')} = @workspaceId
                AND ${quoteIdent('versionNumber', 'column name')} = @versionNumber
              LIMIT 1`,
        params: { workspaceId, versionNumber },
        json: true,
      });
      const row = (rows as Array<Record<string, any>>)[0];
      return row ? this.parseVersionRow(row) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'GET_WORKSPACE_VERSION_BY_NUMBER', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { workspaceId, versionNumber },
        },
        error,
      );
    }
  }

  async getLatestVersion(workspaceId: string): Promise<WorkspaceVersion | null> {
    try {
      const [rows] = await this.database.run({
        sql: `SELECT * FROM ${quoteIdent(TABLE_WORKSPACE_VERSIONS, 'table name')}
              WHERE ${quoteIdent('workspaceId', 'column name')} = @workspaceId
              ORDER BY ${quoteIdent('versionNumber', 'column name')} DESC
              LIMIT 1`,
        params: { workspaceId },
        json: true,
      });
      const row = (rows as Array<Record<string, any>>)[0];
      return row ? this.parseVersionRow(row) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'GET_WORKSPACE_LATEST_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { workspaceId },
        },
        error,
      );
    }
  }

  async listVersions(input: ListWorkspaceVersionsInput): Promise<ListWorkspaceVersionsOutput> {
    const { workspaceId, page = 0, perPage: perPageInput, orderBy } = input;
    if (page < 0) {
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'LIST_WORKSPACE_VERSIONS', 'INVALID_PAGE'),
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
      const tableName = quoteIdent(TABLE_WORKSPACE_VERSIONS, 'table name');

      const [countRows] = await this.database.run({
        sql: `SELECT COUNT(*) AS count FROM ${tableName} WHERE ${quoteIdent('workspaceId', 'column name')} = @workspaceId`,
        params: { workspaceId },
        json: true,
      });
      const total = Number((countRows as Array<{ count: number | string }>)[0]?.count ?? 0);
      if (total === 0) {
        return { versions: [], total: 0, page, perPage: perPageForResponse, hasMore: false };
      }

      const limit = perPageInput === false ? total : perPage;
      const [rows] = await this.database.run({
        sql: `SELECT * FROM ${tableName}
              WHERE ${quoteIdent('workspaceId', 'column name')} = @workspaceId
              ORDER BY ${quoteIdent(field, 'column name')} ${dirSql}, id ${dirSql}
              LIMIT @limit OFFSET @offset`,
        params: { workspaceId, limit, offset },
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
          id: createStorageErrorId('SPANNER', 'LIST_WORKSPACE_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { workspaceId },
        },
        error,
      );
    }
  }

  async deleteVersion(id: string): Promise<void> {
    try {
      await this.db.runDml({
        sql: `DELETE FROM ${quoteIdent(TABLE_WORKSPACE_VERSIONS, 'table name')} WHERE id = @id`,
        params: { id },
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'DELETE_WORKSPACE_VERSION', 'FAILED'),
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
      await this.db.runDml({
        sql: `DELETE FROM ${quoteIdent(TABLE_WORKSPACE_VERSIONS, 'table name')} WHERE ${quoteIdent('workspaceId', 'column name')} = @workspaceId`,
        params: { workspaceId: entityId },
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'DELETE_WORKSPACE_VERSIONS_BY_PARENT_ID', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { workspaceId: entityId },
        },
        error,
      );
    }
  }

  async countVersions(workspaceId: string): Promise<number> {
    try {
      const [rows] = await this.database.run({
        sql: `SELECT COUNT(*) AS count FROM ${quoteIdent(TABLE_WORKSPACE_VERSIONS, 'table name')} WHERE ${quoteIdent('workspaceId', 'column name')} = @workspaceId`,
        params: { workspaceId },
        json: true,
      });
      return Number((rows as Array<{ count: number | string }>)[0]?.count ?? 0);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('SPANNER', 'COUNT_WORKSPACE_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { workspaceId },
        },
        error,
      );
    }
  }
}
