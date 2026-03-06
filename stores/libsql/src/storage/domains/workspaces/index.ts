import type { Client, InValue } from '@libsql/client';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  WorkspacesStorage,
  createStorageErrorId,
  normalizePerPage,
  calculatePagination,
  TABLE_WORKSPACES,
  TABLE_WORKSPACE_VERSIONS,
  WORKSPACES_SCHEMA,
  WORKSPACE_VERSIONS_SCHEMA,
} from '@mastra/core/storage';
import type {
  StorageWorkspaceType,
  StorageCreateWorkspaceInput,
  StorageUpdateWorkspaceInput,
  StorageListWorkspacesInput,
  StorageListWorkspacesOutput,
} from '@mastra/core/storage';
import type {
  WorkspaceVersion,
  CreateWorkspaceVersionInput,
  ListWorkspaceVersionsInput,
  ListWorkspaceVersionsOutput,
} from '@mastra/core/storage/domains/workspaces';
import { LibSQLDB, resolveClient } from '../../db';
import type { LibSQLDomainConfig } from '../../db';
import { buildSelectColumns } from '../../db/utils';

/**
 * Config fields that live on version rows (from StorageWorkspaceSnapshotType).
 */
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

export class WorkspacesLibSQL extends WorkspacesStorage {
  #db: LibSQLDB;
  #client: Client;

  constructor(config: LibSQLDomainConfig) {
    super();
    const client = resolveClient(config);
    this.#client = client;
    this.#db = new LibSQLDB({ client, maxRetries: config.maxRetries, initialBackoffMs: config.initialBackoffMs });
  }

  async init(): Promise<void> {
    await this.#db.createTable({ tableName: TABLE_WORKSPACES, schema: WORKSPACES_SCHEMA });
    await this.#db.createTable({
      tableName: TABLE_WORKSPACE_VERSIONS,
      schema: WORKSPACE_VERSIONS_SCHEMA,
    });

    // Unique constraint on (workspaceId, versionNumber) to prevent duplicate versions from concurrent updates
    await this.#client.execute(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_versions_workspace_version ON "${TABLE_WORKSPACE_VERSIONS}" ("workspaceId", "versionNumber")`,
    );
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.#db.deleteData({ tableName: TABLE_WORKSPACES });
    await this.#db.deleteData({ tableName: TABLE_WORKSPACE_VERSIONS });
  }

  // ==========================================================================
  // Workspace CRUD
  // ==========================================================================

  async getById(id: string): Promise<StorageWorkspaceType | null> {
    try {
      const result = await this.#client.execute({
        sql: `SELECT ${buildSelectColumns(TABLE_WORKSPACES)} FROM "${TABLE_WORKSPACES}" WHERE id = ?`,
        args: [id],
      });
      const row = result.rows?.[0];
      return row ? this.#parseWorkspaceRow(row) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_WORKSPACE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async create(input: { workspace: StorageCreateWorkspaceInput }): Promise<StorageWorkspaceType> {
    const { workspace } = input;
    try {
      const now = new Date();

      // Insert thin workspace record
      await this.#db.insert({
        tableName: TABLE_WORKSPACES,
        record: {
          id: workspace.id,
          status: 'draft',
          activeVersionId: null,
          authorId: workspace.authorId ?? null,
          metadata: workspace.metadata ?? null,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
      });

      // Extract config fields for version 1
      const { id: _id, authorId: _authorId, metadata: _metadata, ...snapshotConfig } = workspace;
      const versionId = crypto.randomUUID();
      try {
        await this.createVersion({
          id: versionId,
          workspaceId: workspace.id,
          versionNumber: 1,
          ...snapshotConfig,
          changedFields: Object.keys(snapshotConfig),
          changeMessage: 'Initial version',
        });
      } catch (versionError) {
        // Clean up the orphaned workspace record
        await this.#db.delete({ tableName: TABLE_WORKSPACES, keys: { id: workspace.id } });
        throw versionError;
      }

      return {
        id: workspace.id,
        status: 'draft',
        activeVersionId: undefined,
        authorId: workspace.authorId,
        metadata: workspace.metadata,
        createdAt: now,
        updatedAt: now,
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'CREATE_WORKSPACE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
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
          id: createStorageErrorId('LIBSQL', 'UPDATE_WORKSPACE', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: `Workspace ${id} not found`,
          details: { workspaceId: id },
        });
      }

      const { authorId, activeVersionId, metadata, status, ...configFields } = updates;

      const configFieldNames = SNAPSHOT_FIELDS as readonly string[];
      const hasConfigUpdate = configFieldNames.some(field => field in configFields);

      // Build update data for the workspace record
      const updateData: Record<string, unknown> = {
        updatedAt: new Date().toISOString(),
      };

      if (authorId !== undefined) updateData.authorId = authorId;
      if (activeVersionId !== undefined) {
        updateData.activeVersionId = activeVersionId;
        if (status === undefined) {
          updateData.status = 'published';
        }
      }
      if (status !== undefined) updateData.status = status;
      if (metadata !== undefined) {
        updateData.metadata = { ...(existing.metadata || {}), ...metadata };
      }

      await this.#db.update({
        tableName: TABLE_WORKSPACES,
        keys: { id },
        data: updateData,
      });

      // If config fields changed, create a new version
      if (hasConfigUpdate) {
        const latestVersion = await this.getLatestVersion(id);
        if (!latestVersion) {
          throw new Error(`No versions found for workspace ${id}`);
        }

        const {
          id: _versionId,
          workspaceId: _workspaceId,
          versionNumber: _versionNumber,
          changedFields: _changedFields,
          changeMessage: _changeMessage,
          createdAt: _createdAt,
          ...latestConfig
        } = latestVersion;

        const newConfig = { ...latestConfig, ...configFields };
        const changedFields = configFieldNames.filter(
          field =>
            field in configFields &&
            JSON.stringify(configFields[field as keyof typeof configFields]) !==
              JSON.stringify(latestConfig[field as keyof typeof latestConfig]),
        );

        if (changedFields.length > 0) {
          const newVersionId = crypto.randomUUID();
          await this.createVersion({
            id: newVersionId,
            workspaceId: id,
            versionNumber: latestVersion.versionNumber + 1,
            ...newConfig,
            changedFields,
            changeMessage: `Updated ${changedFields.join(', ')}`,
          });
        }
      }

      // Fetch and return updated workspace
      const updated = await this.getById(id);
      if (!updated) {
        throw new MastraError({
          id: createStorageErrorId('LIBSQL', 'UPDATE_WORKSPACE', 'NOT_FOUND_AFTER_UPDATE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.SYSTEM,
          text: `Workspace ${id} not found after update`,
          details: { id },
        });
      }
      return updated;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'UPDATE_WORKSPACE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.deleteVersionsByParentId(id);
      await this.#client.execute({
        sql: `DELETE FROM "${TABLE_WORKSPACES}" WHERE "id" = ?`,
        args: [id],
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'DELETE_WORKSPACE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async list(args?: StorageListWorkspacesInput): Promise<StorageListWorkspacesOutput> {
    try {
      const { page = 0, perPage: perPageInput, orderBy, authorId, metadata } = args || {};
      const { field, direction } = this.parseOrderBy(orderBy);

      const conditions: string[] = [];
      const queryParams: InValue[] = [];

      if (authorId !== undefined) {
        conditions.push('authorId = ?');
        queryParams.push(authorId);
      }

      if (metadata && Object.keys(metadata).length > 0) {
        for (const [key, value] of Object.entries(metadata)) {
          // Sanitize key to prevent SQL injection via json_extract path
          if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
            throw new MastraError({
              id: createStorageErrorId('LIBSQL', 'LIST_WORKSPACES', 'INVALID_METADATA_KEY'),
              domain: ErrorDomain.STORAGE,
              category: ErrorCategory.USER,
              text: `Invalid metadata key: ${key}. Keys must be alphanumeric with underscores.`,
              details: { key },
            });
          }
          conditions.push(`json_extract(metadata, '$.${key}') = ?`);
          queryParams.push(typeof value === 'string' ? value : JSON.stringify(value));
        }
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countResult = await this.#client.execute({
        sql: `SELECT COUNT(*) as count FROM "${TABLE_WORKSPACES}" ${whereClause}`,
        args: queryParams,
      });
      const total = Number(countResult.rows?.[0]?.count ?? 0);

      if (total === 0) {
        return {
          workspaces: [],
          total: 0,
          page,
          perPage: perPageInput ?? 100,
          hasMore: false,
        };
      }

      const perPage = normalizePerPage(perPageInput, 100);
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
      const limitValue = perPageInput === false ? total : perPage;
      const end = perPageInput === false ? total : start + perPage;

      const result = await this.#client.execute({
        sql: `SELECT ${buildSelectColumns(TABLE_WORKSPACES)} FROM "${TABLE_WORKSPACES}" ${whereClause} ORDER BY ${field} ${direction} LIMIT ? OFFSET ?`,
        args: [...queryParams, limitValue, start],
      });

      const workspaces = result.rows?.map(row => this.#parseWorkspaceRow(row)) ?? [];

      return {
        workspaces,
        total,
        page,
        perPage: perPageForResponse,
        hasMore: end < total,
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'LIST_WORKSPACES', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  // ==========================================================================
  // Workspace Version Methods
  // ==========================================================================

  async createVersion(input: CreateWorkspaceVersionInput): Promise<WorkspaceVersion> {
    try {
      const now = new Date();
      await this.#client.execute({
        sql: `INSERT INTO "${TABLE_WORKSPACE_VERSIONS}" (
  id, "workspaceId", "versionNumber",
  name, description, filesystem, sandbox, mounts, search, skills, tools,
  "autoSync", "operationTimeout",
  "changedFields", "changeMessage", "createdAt"
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          input.id,
          input.workspaceId,
          input.versionNumber,
          input.name,
          input.description ?? null,
          input.filesystem ? JSON.stringify(input.filesystem) : null,
          input.sandbox ? JSON.stringify(input.sandbox) : null,
          input.mounts ? JSON.stringify(input.mounts) : null,
          input.search ? JSON.stringify(input.search) : null,
          input.skills ? JSON.stringify(input.skills) : null,
          input.tools ? JSON.stringify(input.tools) : null,
          input.autoSync ? 1 : 0,
          input.operationTimeout ?? null,
          input.changedFields ? JSON.stringify(input.changedFields) : null,
          input.changeMessage ?? null,
          now.toISOString(),
        ],
      });

      return {
        ...input,
        createdAt: now,
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'CREATE_WORKSPACE_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getVersion(id: string): Promise<WorkspaceVersion | null> {
    try {
      const result = await this.#client.execute({
        sql: `SELECT ${buildSelectColumns(TABLE_WORKSPACE_VERSIONS)} FROM "${TABLE_WORKSPACE_VERSIONS}" WHERE id = ?`,
        args: [id],
      });
      const row = result.rows?.[0];
      return row ? this.#parseVersionRow(row) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_WORKSPACE_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getVersionByNumber(workspaceId: string, versionNumber: number): Promise<WorkspaceVersion | null> {
    try {
      const result = await this.#client.execute({
        sql: `SELECT ${buildSelectColumns(TABLE_WORKSPACE_VERSIONS)} FROM "${TABLE_WORKSPACE_VERSIONS}" WHERE "workspaceId" = ? AND "versionNumber" = ?`,
        args: [workspaceId, versionNumber],
      });
      const row = result.rows?.[0];
      return row ? this.#parseVersionRow(row) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_WORKSPACE_VERSION_BY_NUMBER', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async getLatestVersion(workspaceId: string): Promise<WorkspaceVersion | null> {
    try {
      const result = await this.#client.execute({
        sql: `SELECT ${buildSelectColumns(TABLE_WORKSPACE_VERSIONS)} FROM "${TABLE_WORKSPACE_VERSIONS}" WHERE "workspaceId" = ? ORDER BY "versionNumber" DESC LIMIT 1`,
        args: [workspaceId],
      });
      const row = result.rows?.[0];
      return row ? this.#parseVersionRow(row) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'GET_LATEST_WORKSPACE_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async listVersions(input: ListWorkspaceVersionsInput): Promise<ListWorkspaceVersionsOutput> {
    try {
      const { workspaceId, page = 0, perPage: perPageInput, orderBy } = input;
      const { field, direction } = this.parseVersionOrderBy(orderBy);

      // Get total count
      const countResult = await this.#client.execute({
        sql: `SELECT COUNT(*) as count FROM "${TABLE_WORKSPACE_VERSIONS}" WHERE "workspaceId" = ?`,
        args: [workspaceId],
      });
      const total = Number(countResult.rows?.[0]?.count ?? 0);

      if (total === 0) {
        return {
          versions: [],
          total: 0,
          page,
          perPage: perPageInput ?? 20,
          hasMore: false,
        };
      }

      const perPage = normalizePerPage(perPageInput, 20);
      const { offset: start, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
      const limitValue = perPageInput === false ? total : perPage;
      const end = perPageInput === false ? total : start + perPage;

      const result = await this.#client.execute({
        sql: `SELECT ${buildSelectColumns(TABLE_WORKSPACE_VERSIONS)} FROM "${TABLE_WORKSPACE_VERSIONS}" WHERE "workspaceId" = ? ORDER BY ${field} ${direction} LIMIT ? OFFSET ?`,
        args: [workspaceId, limitValue, start],
      });

      const versions = result.rows?.map(row => this.#parseVersionRow(row)) ?? [];

      return {
        versions,
        total,
        page,
        perPage: perPageForResponse,
        hasMore: end < total,
      };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'LIST_WORKSPACE_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async deleteVersion(id: string): Promise<void> {
    try {
      await this.#client.execute({
        sql: `DELETE FROM "${TABLE_WORKSPACE_VERSIONS}" WHERE "id" = ?`,
        args: [id],
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'DELETE_WORKSPACE_VERSION', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async deleteVersionsByParentId(entityId: string): Promise<void> {
    try {
      await this.#client.execute({
        sql: `DELETE FROM "${TABLE_WORKSPACE_VERSIONS}" WHERE "workspaceId" = ?`,
        args: [entityId],
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'DELETE_WORKSPACE_VERSIONS_BY_WORKSPACE', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  async countVersions(workspaceId: string): Promise<number> {
    try {
      const result = await this.#client.execute({
        sql: `SELECT COUNT(*) as count FROM "${TABLE_WORKSPACE_VERSIONS}" WHERE "workspaceId" = ?`,
        args: [workspaceId],
      });
      return Number(result.rows?.[0]?.count ?? 0);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('LIBSQL', 'COUNT_WORKSPACE_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
        },
        error,
      );
    }
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  #parseWorkspaceRow(row: Record<string, unknown>): StorageWorkspaceType {
    const safeParseJSON = (val: unknown): unknown => {
      if (val === null || val === undefined) return undefined;
      if (typeof val === 'string') {
        try {
          return JSON.parse(val);
        } catch {
          return val;
        }
      }
      return val;
    };

    return {
      id: row.id as string,
      status: (row.status as StorageWorkspaceType['status']) ?? 'draft',
      activeVersionId: (row.activeVersionId as string) ?? undefined,
      authorId: (row.authorId as string) ?? undefined,
      metadata: safeParseJSON(row.metadata) as Record<string, unknown> | undefined,
      createdAt: new Date(row.createdAt as string),
      updatedAt: new Date(row.updatedAt as string),
    };
  }

  #parseVersionRow(row: Record<string, unknown>): WorkspaceVersion {
    const safeParseJSON = (val: unknown): unknown => {
      if (val === null || val === undefined) return undefined;
      if (typeof val === 'string') {
        try {
          return JSON.parse(val);
        } catch {
          return val;
        }
      }
      return val;
    };

    return {
      id: row.id as string,
      workspaceId: row.workspaceId as string,
      versionNumber: Number(row.versionNumber),
      name: row.name as string,
      description: (row.description as string) ?? undefined,
      filesystem: safeParseJSON(row.filesystem) as WorkspaceVersion['filesystem'],
      sandbox: safeParseJSON(row.sandbox) as WorkspaceVersion['sandbox'],
      mounts: safeParseJSON(row.mounts) as WorkspaceVersion['mounts'],
      search: safeParseJSON(row.search) as WorkspaceVersion['search'],
      skills: safeParseJSON(row.skills) as WorkspaceVersion['skills'],
      tools: safeParseJSON(row.tools) as WorkspaceVersion['tools'],
      autoSync: Boolean(row.autoSync),
      operationTimeout: row.operationTimeout != null ? Number(row.operationTimeout) : undefined,
      changedFields: safeParseJSON(row.changedFields) as string[] | undefined,
      changeMessage: (row.changeMessage as string) ?? undefined,
      createdAt: new Date(row.createdAt as string),
    };
  }
}
