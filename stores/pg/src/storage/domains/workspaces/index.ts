import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import {
  WorkspacesStorage,
  createStorageErrorId,
  normalizePerPage,
  calculatePagination,
  TABLE_WORKSPACES,
  TABLE_WORKSPACE_VERSIONS,
  TABLE_SCHEMAS,
} from '@mastra/core/storage';
import type {
  StorageWorkspaceType,
  StorageCreateWorkspaceInput,
  StorageUpdateWorkspaceInput,
  StorageListWorkspacesInput,
  StorageListWorkspacesOutput,
  CreateIndexOptions,
} from '@mastra/core/storage';
import type {
  WorkspaceVersion,
  CreateWorkspaceVersionInput,
  ListWorkspaceVersionsInput,
  ListWorkspaceVersionsOutput,
} from '@mastra/core/storage/domains/workspaces';
import { PgDB, resolvePgConfig } from '../../db';
import type { PgDomainConfig } from '../../db';
import { getTableName, getSchemaName } from '../utils';

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

export class WorkspacesPG extends WorkspacesStorage {
  #db: PgDB;
  #schema: string;
  #skipDefaultIndexes?: boolean;
  #indexes?: CreateIndexOptions[];

  static readonly MANAGED_TABLES = [TABLE_WORKSPACES, TABLE_WORKSPACE_VERSIONS] as const;

  constructor(config: PgDomainConfig) {
    super();
    const { client, schemaName, skipDefaultIndexes, indexes } = resolvePgConfig(config);
    this.#db = new PgDB({ client, schemaName, skipDefaultIndexes });
    this.#schema = schemaName || 'public';
    this.#skipDefaultIndexes = skipDefaultIndexes;
    this.#indexes = indexes?.filter(idx => (WorkspacesPG.MANAGED_TABLES as readonly string[]).includes(idx.table));
  }

  getDefaultIndexDefinitions(): CreateIndexOptions[] {
    return [
      {
        name: 'idx_workspace_versions_workspace_version',
        table: TABLE_WORKSPACE_VERSIONS,
        columns: ['workspaceId', 'versionNumber'],
        unique: true,
      },
    ];
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
      tableName: TABLE_WORKSPACES,
      schema: TABLE_SCHEMAS[TABLE_WORKSPACES],
    });
    await this.#db.createTable({
      tableName: TABLE_WORKSPACE_VERSIONS,
      schema: TABLE_SCHEMAS[TABLE_WORKSPACE_VERSIONS],
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
    await this.#db.clearTable({ tableName: TABLE_WORKSPACE_VERSIONS });
    await this.#db.clearTable({ tableName: TABLE_WORKSPACES });
  }

  // ==========================================================================
  // Workspace CRUD Methods
  // ==========================================================================

  async getById(id: string): Promise<StorageWorkspaceType | null> {
    try {
      const tableName = getTableName({ indexName: TABLE_WORKSPACES, schemaName: getSchemaName(this.#schema) });
      const result = await this.#db.client.oneOrNone(`SELECT * FROM ${tableName} WHERE id = $1`, [id]);

      if (!result) {
        return null;
      }

      return this.parseWorkspaceRow(result);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'GET_WORKSPACE_BY_ID', 'FAILED'),
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
      const tableName = getTableName({ indexName: TABLE_WORKSPACES, schemaName: getSchemaName(this.#schema) });
      const now = new Date();
      const nowIso = now.toISOString();

      // 1. Create the thin workspace record
      await this.#db.client.none(
        `INSERT INTO ${tableName} (
          id, status, "activeVersionId", "authorId", metadata,
          "createdAt", "createdAtZ", "updatedAt", "updatedAtZ"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          workspace.id,
          'draft',
          null,
          workspace.authorId ?? null,
          workspace.metadata ? JSON.stringify(workspace.metadata) : null,
          nowIso,
          nowIso,
          nowIso,
          nowIso,
        ],
      );

      // 2. Extract snapshot fields and create version 1
      const { id: _id, authorId: _authorId, metadata: _metadata, ...snapshotConfig } = workspace;
      const versionId = crypto.randomUUID();
      await this.createVersion({
        id: versionId,
        workspaceId: workspace.id,
        versionNumber: 1,
        ...snapshotConfig,
        changedFields: [...SNAPSHOT_FIELDS],
        changeMessage: 'Initial version',
      });

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
      // Best-effort cleanup
      try {
        const tableName = getTableName({
          indexName: TABLE_WORKSPACES,
          schemaName: getSchemaName(this.#schema),
        });
        await this.#db.client.none(
          `DELETE FROM ${tableName} WHERE id = $1 AND status = 'draft' AND "activeVersionId" IS NULL`,
          [workspace.id],
        );
      } catch {
        // Ignore cleanup errors
      }

      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'CREATE_WORKSPACE', 'FAILED'),
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
      const tableName = getTableName({ indexName: TABLE_WORKSPACES, schemaName: getSchemaName(this.#schema) });

      const existingWorkspace = await this.getById(id);
      if (!existingWorkspace) {
        throw new MastraError({
          id: createStorageErrorId('PG', 'UPDATE_WORKSPACE', 'NOT_FOUND'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.USER,
          text: `Workspace ${id} not found`,
          details: { workspaceId: id },
        });
      }

      const { authorId, activeVersionId, metadata, status, ...configFields } = updates;
      let versionCreated = false;

      // Check if any snapshot config fields are present
      const hasConfigUpdate = SNAPSHOT_FIELDS.some(field => field in configFields);

      if (hasConfigUpdate) {
        const latestVersion = await this.getLatestVersion(id);
        if (!latestVersion) {
          throw new MastraError({
            id: createStorageErrorId('PG', 'UPDATE_WORKSPACE', 'NO_VERSIONS'),
            domain: ErrorDomain.STORAGE,
            category: ErrorCategory.SYSTEM,
            text: `No versions found for workspace ${id}`,
            details: { workspaceId: id },
          });
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
        const changedFields = SNAPSHOT_FIELDS.filter(
          field =>
            field in configFields &&
            JSON.stringify(configFields[field as keyof typeof configFields]) !==
              JSON.stringify(latestConfig[field as keyof typeof latestConfig]),
        );

        if (changedFields.length > 0) {
          versionCreated = true;
          const newVersionId = crypto.randomUUID();
          await this.createVersion({
            id: newVersionId,
            workspaceId: id,
            versionNumber: latestVersion.versionNumber + 1,
            ...newConfig,
            changedFields: [...changedFields],
            changeMessage: `Updated ${changedFields.join(', ')}`,
          });
        }
      }

      // Update metadata fields on the workspace record
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
        // Auto-set status to 'published' when activeVersionId is set, consistent with InMemory and LibSQL
        if (status === undefined) {
          setClauses.push(`status = $${paramIndex++}`);
          values.push('published');
        }
      }

      if (status !== undefined) {
        setClauses.push(`status = $${paramIndex++}`);
        values.push(status);
      }

      if (metadata !== undefined) {
        const mergedMetadata = { ...(existingWorkspace.metadata || {}), ...metadata };
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

      if (setClauses.length > 2 || versionCreated) {
        // More than just updatedAt and updatedAtZ, or a new version was created
        await this.#db.client.none(
          `UPDATE ${tableName} SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
          values,
        );
      }

      const updatedWorkspace = await this.getById(id);
      if (!updatedWorkspace) {
        throw new MastraError({
          id: createStorageErrorId('PG', 'UPDATE_WORKSPACE', 'NOT_FOUND_AFTER_UPDATE'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.SYSTEM,
          text: `Workspace ${id} not found after update`,
          details: { workspaceId: id },
        });
      }
      return updatedWorkspace;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'UPDATE_WORKSPACE', 'FAILED'),
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
      const tableName = getTableName({ indexName: TABLE_WORKSPACES, schemaName: getSchemaName(this.#schema) });
      await this.deleteVersionsByParentId(id);
      await this.#db.client.none(`DELETE FROM ${tableName} WHERE id = $1`, [id]);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'DELETE_WORKSPACE', 'FAILED'),
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
          id: createStorageErrorId('PG', 'LIST_WORKSPACES', 'INVALID_PAGE'),
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
      const tableName = getTableName({ indexName: TABLE_WORKSPACES, schemaName: getSchemaName(this.#schema) });

      // Build WHERE conditions
      const conditions: string[] = [];
      const queryParams: any[] = [];
      let paramIdx = 1;

      if (authorId !== undefined) {
        conditions.push(`"authorId" = $${paramIdx++}`);
        queryParams.push(authorId);
      }

      if (metadata && Object.keys(metadata).length > 0) {
        conditions.push(`metadata @> $${paramIdx++}::jsonb`);
        queryParams.push(JSON.stringify(metadata));
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      // Get total count
      const countResult = await this.#db.client.one(
        `SELECT COUNT(*) as count FROM ${tableName} ${whereClause}`,
        queryParams,
      );
      const total = parseInt(countResult.count, 10);

      if (total === 0) {
        return {
          workspaces: [],
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

      const workspaces = (dataResult || []).map(row => this.parseWorkspaceRow(row));

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
          id: createStorageErrorId('PG', 'LIST_WORKSPACES', 'FAILED'),
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
      const tableName = getTableName({
        indexName: TABLE_WORKSPACE_VERSIONS,
        schemaName: getSchemaName(this.#schema),
      });
      const now = new Date();
      const nowIso = now.toISOString();

      await this.#db.client.none(
        `INSERT INTO ${tableName} (
          id, "workspaceId", "versionNumber",
          name, description, filesystem, sandbox, mounts, search, skills, tools,
          "autoSync", "operationTimeout",
          "changedFields", "changeMessage",
          "createdAt", "createdAtZ"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)`,
        [
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
          input.autoSync ?? false,
          input.operationTimeout ?? null,
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
          id: createStorageErrorId('PG', 'CREATE_WORKSPACE_VERSION', 'FAILED'),
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
      const tableName = getTableName({
        indexName: TABLE_WORKSPACE_VERSIONS,
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
          id: createStorageErrorId('PG', 'GET_WORKSPACE_VERSION', 'FAILED'),
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
      const tableName = getTableName({
        indexName: TABLE_WORKSPACE_VERSIONS,
        schemaName: getSchemaName(this.#schema),
      });
      const result = await this.#db.client.oneOrNone(
        `SELECT * FROM ${tableName} WHERE "workspaceId" = $1 AND "versionNumber" = $2`,
        [workspaceId, versionNumber],
      );

      if (!result) {
        return null;
      }

      return this.parseVersionRow(result);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'GET_WORKSPACE_VERSION_BY_NUMBER', 'FAILED'),
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
      const tableName = getTableName({
        indexName: TABLE_WORKSPACE_VERSIONS,
        schemaName: getSchemaName(this.#schema),
      });
      const result = await this.#db.client.oneOrNone(
        `SELECT * FROM ${tableName} WHERE "workspaceId" = $1 ORDER BY "versionNumber" DESC LIMIT 1`,
        [workspaceId],
      );

      if (!result) {
        return null;
      }

      return this.parseVersionRow(result);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'GET_LATEST_WORKSPACE_VERSION', 'FAILED'),
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
          id: createStorageErrorId('PG', 'LIST_WORKSPACE_VERSIONS', 'INVALID_PAGE'),
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
        indexName: TABLE_WORKSPACE_VERSIONS,
        schemaName: getSchemaName(this.#schema),
      });

      const countResult = await this.#db.client.one(
        `SELECT COUNT(*) as count FROM ${tableName} WHERE "workspaceId" = $1`,
        [workspaceId],
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
        `SELECT * FROM ${tableName} WHERE "workspaceId" = $1 ORDER BY "${field}" ${direction} LIMIT $2 OFFSET $3`,
        [workspaceId, limitValue, offset],
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
          id: createStorageErrorId('PG', 'LIST_WORKSPACE_VERSIONS', 'FAILED'),
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
      const tableName = getTableName({
        indexName: TABLE_WORKSPACE_VERSIONS,
        schemaName: getSchemaName(this.#schema),
      });
      await this.#db.client.none(`DELETE FROM ${tableName} WHERE id = $1`, [id]);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'DELETE_WORKSPACE_VERSION', 'FAILED'),
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
        indexName: TABLE_WORKSPACE_VERSIONS,
        schemaName: getSchemaName(this.#schema),
      });
      await this.#db.client.none(`DELETE FROM ${tableName} WHERE "workspaceId" = $1`, [entityId]);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'DELETE_WORKSPACE_VERSIONS_BY_WORKSPACE_ID', 'FAILED'),
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
      const tableName = getTableName({
        indexName: TABLE_WORKSPACE_VERSIONS,
        schemaName: getSchemaName(this.#schema),
      });
      const result = await this.#db.client.one(`SELECT COUNT(*) as count FROM ${tableName} WHERE "workspaceId" = $1`, [
        workspaceId,
      ]);
      return parseInt(result.count, 10);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError(
        {
          id: createStorageErrorId('PG', 'COUNT_WORKSPACE_VERSIONS', 'FAILED'),
          domain: ErrorDomain.STORAGE,
          category: ErrorCategory.THIRD_PARTY,
          details: { workspaceId },
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

  private parseWorkspaceRow(row: any): StorageWorkspaceType {
    return {
      id: row.id as string,
      status: row.status as StorageWorkspaceType['status'],
      activeVersionId: row.activeVersionId as string | undefined,
      authorId: row.authorId as string | undefined,
      metadata: this.parseJson(row.metadata, 'metadata'),
      createdAt: new Date(row.createdAtZ || row.createdAt),
      updatedAt: new Date(row.updatedAtZ || row.updatedAt),
    };
  }

  private parseVersionRow(row: any): WorkspaceVersion {
    return {
      id: row.id as string,
      workspaceId: row.workspaceId as string,
      versionNumber: row.versionNumber as number,
      name: row.name as string,
      description: row.description as string | undefined,
      filesystem: this.parseJson(row.filesystem, 'filesystem'),
      sandbox: this.parseJson(row.sandbox, 'sandbox'),
      mounts: this.parseJson(row.mounts, 'mounts'),
      search: this.parseJson(row.search, 'search'),
      skills: this.parseJson(row.skills, 'skills'),
      tools: this.parseJson(row.tools, 'tools'),
      autoSync: Boolean(row.autoSync),
      operationTimeout: row.operationTimeout != null ? Number(row.operationTimeout) : undefined,
      changedFields: this.parseJson(row.changedFields, 'changedFields'),
      changeMessage: row.changeMessage as string | undefined,
      createdAt: new Date(row.createdAtZ || row.createdAt),
    };
  }
}
