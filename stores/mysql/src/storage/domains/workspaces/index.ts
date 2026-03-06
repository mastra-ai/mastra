import type { Pool, RowDataPacket } from 'mysql2/promise';
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

import type { StoreOperationsMySQL } from '../operations';
import { formatTableName, quoteIdentifier } from '../utils';

const SNAPSHOT_FIELDS = [
  'name', 'description', 'filesystem', 'sandbox', 'mounts', 'search', 'skills', 'tools', 'autoSync', 'operationTimeout',
] as const;

export class WorkspacesMySQL extends WorkspacesStorage {
  private pool: Pool;
  private operations: StoreOperationsMySQL;

  constructor({ pool, operations }: { pool: Pool; operations: StoreOperationsMySQL }) {
    super();
    this.pool = pool;
    this.operations = operations;
  }

  async init(): Promise<void> {
    await this.operations.createTable({ tableName: TABLE_WORKSPACES, schema: WORKSPACES_SCHEMA });
    await this.operations.createTable({ tableName: TABLE_WORKSPACE_VERSIONS, schema: WORKSPACE_VERSIONS_SCHEMA });
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.operations.clearTable({ tableName: TABLE_WORKSPACE_VERSIONS });
    await this.operations.clearTable({ tableName: TABLE_WORKSPACES });
  }

  private safeParseJSON(val: unknown): any {
    if (val === null || val === undefined) return undefined;
    if (typeof val === 'string') {
      try { return JSON.parse(val); } catch { return val; }
    }
    return val;
  }

  private parseWorkspaceRow(row: Record<string, unknown>): StorageWorkspaceType {
    return {
      id: row.id as string,
      status: (row.status as StorageWorkspaceType['status']) ?? 'draft',
      activeVersionId: (row.activeVersionId as string) ?? undefined,
      authorId: (row.authorId as string) ?? undefined,
      metadata: this.safeParseJSON(row.metadata) as Record<string, unknown> | undefined,
      createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt as string),
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt as string),
    };
  }

  private parseVersionRow(row: Record<string, unknown>): WorkspaceVersion {
    return {
      id: row.id as string,
      workspaceId: row.workspaceId as string,
      versionNumber: Number(row.versionNumber),
      name: row.name as string,
      description: (row.description as string) ?? undefined,
      filesystem: this.safeParseJSON(row.filesystem) as WorkspaceVersion['filesystem'],
      sandbox: this.safeParseJSON(row.sandbox) as WorkspaceVersion['sandbox'],
      mounts: this.safeParseJSON(row.mounts) as WorkspaceVersion['mounts'],
      search: this.safeParseJSON(row.search) as WorkspaceVersion['search'],
      skills: this.safeParseJSON(row.skills) as WorkspaceVersion['skills'],
      tools: this.safeParseJSON(row.tools) as WorkspaceVersion['tools'],
      autoSync: row.autoSync === true || row.autoSync === 1 || row.autoSync === '1',
      operationTimeout: row.operationTimeout != null ? Number(row.operationTimeout) : undefined,
      changedFields: this.safeParseJSON(row.changedFields) as string[] | undefined,
      changeMessage: (row.changeMessage as string) ?? undefined,
      createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt as string),
    };
  }

  async getById(id: string): Promise<StorageWorkspaceType | null> {
    try {
      const [rows] = await this.pool.execute<RowDataPacket[]>(
        `SELECT * FROM ${formatTableName(TABLE_WORKSPACES)} WHERE ${quoteIdentifier('id', 'column name')} = ?`, [id],
      );
      return rows.length ? this.parseWorkspaceRow(rows[0]!) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError({ id: createStorageErrorId('MYSQL', 'GET_WORKSPACE', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY }, error);
    }
  }

  async create(input: { workspace: StorageCreateWorkspaceInput }): Promise<StorageWorkspaceType> {
    const { workspace } = input;
    try {
      const now = new Date();
      await this.operations.insert({
        tableName: TABLE_WORKSPACES,
        record: { id: workspace.id, status: 'draft', activeVersionId: null, authorId: workspace.authorId ?? null, metadata: workspace.metadata ?? null, createdAt: now, updatedAt: now },
      });

      const { id: _id, authorId: _authorId, metadata: _metadata, ...snapshotConfig } = workspace;
      const versionId = crypto.randomUUID();
      try {
        await this.createVersion({ id: versionId, workspaceId: workspace.id, versionNumber: 1, ...snapshotConfig, changedFields: Object.keys(snapshotConfig), changeMessage: 'Initial version' });
      } catch (versionError) {
        await this.operations.delete({ tableName: TABLE_WORKSPACES, keys: { id: workspace.id } });
        throw versionError;
      }

      return { id: workspace.id, status: 'draft', activeVersionId: undefined, authorId: workspace.authorId, metadata: workspace.metadata, createdAt: now, updatedAt: now };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError({ id: createStorageErrorId('MYSQL', 'CREATE_WORKSPACE', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY }, error);
    }
  }

  async update(input: StorageUpdateWorkspaceInput): Promise<StorageWorkspaceType> {
    const { id, ...updates } = input;
    try {
      const existing = await this.getById(id);
      if (!existing) throw new MastraError({ id: createStorageErrorId('MYSQL', 'UPDATE_WORKSPACE', 'NOT_FOUND'), domain: ErrorDomain.STORAGE, category: ErrorCategory.USER, text: `Workspace ${id} not found`, details: { workspaceId: id } });

      const { authorId, activeVersionId, metadata, status, ...configFields } = updates;
      const configFieldNames = SNAPSHOT_FIELDS as readonly string[];
      const hasConfigUpdate = configFieldNames.some(field => field in configFields);

      const updateData: Record<string, unknown> = { updatedAt: new Date() };
      if (authorId !== undefined) updateData.authorId = authorId;
      if (activeVersionId !== undefined) { updateData.activeVersionId = activeVersionId; if (status === undefined) updateData.status = 'published'; }
      if (status !== undefined) updateData.status = status;
      if (metadata !== undefined) updateData.metadata = { ...(existing.metadata || {}), ...metadata };

      await this.operations.update({ tableName: TABLE_WORKSPACES, keys: { id }, data: updateData });

      if (hasConfigUpdate) {
        const latestVersion = await this.getLatestVersion(id);
        if (!latestVersion) throw new Error(`No versions found for workspace ${id}`);

        const { id: _versionId, workspaceId: _workspaceId, versionNumber: _versionNumber, changedFields: _changedFields, changeMessage: _changeMessage, createdAt: _createdAt, ...latestConfig } = latestVersion;
        const newConfig = { ...latestConfig, ...configFields };
        const changedFields = configFieldNames.filter(
          field => field in configFields && JSON.stringify(configFields[field as keyof typeof configFields]) !== JSON.stringify(latestConfig[field as keyof typeof latestConfig]),
        );

        if (changedFields.length > 0) {
          const newVersionId = crypto.randomUUID();
          await this.createVersion({ id: newVersionId, workspaceId: id, versionNumber: latestVersion.versionNumber + 1, ...newConfig, changedFields, changeMessage: `Updated ${changedFields.join(', ')}` });
        }
      }

      const updated = await this.getById(id);
      if (!updated) throw new MastraError({ id: createStorageErrorId('MYSQL', 'UPDATE_WORKSPACE', 'NOT_FOUND_AFTER_UPDATE'), domain: ErrorDomain.STORAGE, category: ErrorCategory.SYSTEM, text: `Workspace ${id} not found after update`, details: { id } });
      return updated;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError({ id: createStorageErrorId('MYSQL', 'UPDATE_WORKSPACE', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY }, error);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.deleteVersionsByParentId(id);
      await this.operations.delete({ tableName: TABLE_WORKSPACES, keys: { id } });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError({ id: createStorageErrorId('MYSQL', 'DELETE_WORKSPACE', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY }, error);
    }
  }

  async list(args?: StorageListWorkspacesInput): Promise<StorageListWorkspacesOutput> {
    try {
      const { page = 0, perPage: perPageInput, orderBy, authorId, metadata } = args || {};
      const { field, direction } = this.parseOrderBy(orderBy);

      const conditions: string[] = [];
      const queryParams: any[] = [];
      if (authorId !== undefined) { conditions.push(`${quoteIdentifier('authorId', 'column name')} = ?`); queryParams.push(authorId); }
      if (metadata && Object.keys(metadata).length > 0) {
        for (const [key, value] of Object.entries(metadata)) {
          if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) throw new MastraError({ id: createStorageErrorId('MYSQL', 'LIST_WORKSPACES', 'INVALID_METADATA_KEY'), domain: ErrorDomain.STORAGE, category: ErrorCategory.USER, text: `Invalid metadata key: ${key}`, details: { key } });
          if (typeof value === 'string') {
            conditions.push(`JSON_UNQUOTE(JSON_EXTRACT(${quoteIdentifier('metadata', 'column name')}, '$.${key}')) = ?`);
            queryParams.push(value);
          } else {
            conditions.push(`JSON_EXTRACT(${quoteIdentifier('metadata', 'column name')}, '$.${key}') = CAST(? AS JSON)`);
            queryParams.push(JSON.stringify(value));
          }
        }
      }

      const whereClause = conditions.length > 0 ? { sql: ` WHERE ${conditions.join(' AND ')}`, args: queryParams } : undefined;
      const total = await this.operations.loadTotalCount({ tableName: TABLE_WORKSPACES, whereClause });
      if (total === 0) return { workspaces: [], total: 0, page, perPage: perPageInput ?? 100, hasMore: false };

      const perPage = normalizePerPage(perPageInput, 100);
      const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
      const limitValue = perPageInput === false ? total : perPage;

      const rows = await this.operations.loadMany<Record<string, unknown>>({
        tableName: TABLE_WORKSPACES, whereClause,
        orderBy: `${quoteIdentifier(field, 'column name')} ${direction}`, offset, limit: limitValue,
      });

      return { workspaces: rows.map(row => this.parseWorkspaceRow(row)), total, page, perPage: perPageForResponse, hasMore: perPageInput === false ? false : offset + perPage < total };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError({ id: createStorageErrorId('MYSQL', 'LIST_WORKSPACES', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY }, error);
    }
  }

  // ==========================================================================
  // Version Methods
  // ==========================================================================

  async createVersion(input: CreateWorkspaceVersionInput): Promise<WorkspaceVersion> {
    try {
      const now = new Date();
      await this.operations.insert({
        tableName: TABLE_WORKSPACE_VERSIONS,
        record: {
          id: input.id, workspaceId: input.workspaceId, versionNumber: input.versionNumber,
          name: input.name, description: input.description ?? null,
          filesystem: input.filesystem ?? null, sandbox: input.sandbox ?? null,
          mounts: input.mounts ?? null, search: input.search ?? null,
          skills: input.skills ?? null, tools: input.tools ?? null,
          autoSync: input.autoSync ? 1 : 0, operationTimeout: input.operationTimeout ?? null,
          changedFields: input.changedFields ?? null, changeMessage: input.changeMessage ?? null, createdAt: now,
        },
      });
      return { ...input, createdAt: now };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError({ id: createStorageErrorId('MYSQL', 'CREATE_WORKSPACE_VERSION', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY }, error);
    }
  }

  async getVersion(id: string): Promise<WorkspaceVersion | null> {
    try {
      const [rows] = await this.pool.execute<RowDataPacket[]>(
        `SELECT * FROM ${formatTableName(TABLE_WORKSPACE_VERSIONS)} WHERE ${quoteIdentifier('id', 'column name')} = ?`, [id],
      );
      return rows.length ? this.parseVersionRow(rows[0]!) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError({ id: createStorageErrorId('MYSQL', 'GET_WORKSPACE_VERSION', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY }, error);
    }
  }

  async getVersionByNumber(workspaceId: string, versionNumber: number): Promise<WorkspaceVersion | null> {
    try {
      const rows = await this.operations.loadMany<Record<string, unknown>>({
        tableName: TABLE_WORKSPACE_VERSIONS,
        whereClause: { sql: ` WHERE ${quoteIdentifier('workspaceId', 'column name')} = ? AND ${quoteIdentifier('versionNumber', 'column name')} = ?`, args: [workspaceId, versionNumber] },
        limit: 1,
      });
      return rows.length ? this.parseVersionRow(rows[0]!) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError({ id: createStorageErrorId('MYSQL', 'GET_WORKSPACE_VERSION_BY_NUMBER', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY }, error);
    }
  }

  async getLatestVersion(workspaceId: string): Promise<WorkspaceVersion | null> {
    try {
      const rows = await this.operations.loadMany<Record<string, unknown>>({
        tableName: TABLE_WORKSPACE_VERSIONS,
        whereClause: { sql: ` WHERE ${quoteIdentifier('workspaceId', 'column name')} = ?`, args: [workspaceId] },
        orderBy: `${quoteIdentifier('versionNumber', 'column name')} DESC`, limit: 1,
      });
      return rows.length ? this.parseVersionRow(rows[0]!) : null;
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError({ id: createStorageErrorId('MYSQL', 'GET_LATEST_WORKSPACE_VERSION', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY }, error);
    }
  }

  async listVersions(input: ListWorkspaceVersionsInput): Promise<ListWorkspaceVersionsOutput> {
    try {
      const { workspaceId, page = 0, perPage: perPageInput, orderBy } = input;
      const { field, direction } = this.parseVersionOrderBy(orderBy);
      const whereClause = { sql: ` WHERE ${quoteIdentifier('workspaceId', 'column name')} = ?`, args: [workspaceId] };
      const total = await this.operations.loadTotalCount({ tableName: TABLE_WORKSPACE_VERSIONS, whereClause });
      if (total === 0) return { versions: [], total: 0, page, perPage: perPageInput ?? 20, hasMore: false };

      const perPage = normalizePerPage(perPageInput, 20);
      const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
      const limitValue = perPageInput === false ? total : perPage;

      const rows = await this.operations.loadMany<Record<string, unknown>>({
        tableName: TABLE_WORKSPACE_VERSIONS, whereClause,
        orderBy: `${quoteIdentifier(field, 'column name')} ${direction}`, offset, limit: limitValue,
      });

      return { versions: rows.map(row => this.parseVersionRow(row)), total, page, perPage: perPageForResponse, hasMore: perPageInput === false ? false : offset + perPage < total };
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError({ id: createStorageErrorId('MYSQL', 'LIST_WORKSPACE_VERSIONS', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY }, error);
    }
  }

  async deleteVersion(id: string): Promise<void> {
    try { await this.operations.delete({ tableName: TABLE_WORKSPACE_VERSIONS, keys: { id } }); } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError({ id: createStorageErrorId('MYSQL', 'DELETE_WORKSPACE_VERSION', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY }, error);
    }
  }

  async deleteVersionsByParentId(entityId: string): Promise<void> {
    try {
      await this.pool.execute(`DELETE FROM ${formatTableName(TABLE_WORKSPACE_VERSIONS)} WHERE ${quoteIdentifier('workspaceId', 'column name')} = ?`, [entityId]);
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError({ id: createStorageErrorId('MYSQL', 'DELETE_WORKSPACE_VERSIONS_BY_WORKSPACE', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY }, error);
    }
  }

  async countVersions(workspaceId: string): Promise<number> {
    try {
      return await this.operations.loadTotalCount({
        tableName: TABLE_WORKSPACE_VERSIONS,
        whereClause: { sql: ` WHERE ${quoteIdentifier('workspaceId', 'column name')} = ?`, args: [workspaceId] },
      });
    } catch (error) {
      if (error instanceof MastraError) throw error;
      throw new MastraError({ id: createStorageErrorId('MYSQL', 'COUNT_WORKSPACE_VERSIONS', 'FAILED'), domain: ErrorDomain.STORAGE, category: ErrorCategory.THIRD_PARTY }, error);
    }
  }
}
