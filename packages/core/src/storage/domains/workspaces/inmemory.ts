import { deepEqual } from '../../../utils';
import { normalizePerPage, calculatePagination } from '../../base';
import type {
  StorageWorkspaceType,
  StorageCreateWorkspaceInput,
  StorageUpdateWorkspaceInput,
  StorageListWorkspacesInput,
  StorageListWorkspacesOutput,
  ThreadOrderBy,
  ThreadSortDirection,
} from '../../types';
import type { InMemoryDB } from '../inmemory-db';
import type {
  WorkspaceVersion,
  CreateWorkspaceVersionInput,
  ListWorkspaceVersionsInput,
  ListWorkspaceVersionsOutput,
  WorkspaceVersionOrderBy,
  WorkspaceVersionSortDirection,
} from './base';
import { WorkspacesStorage } from './base';

export class InMemoryWorkspacesStorage extends WorkspacesStorage {
  private db: InMemoryDB;

  constructor({ db }: { db: InMemoryDB }) {
    super();
    this.db = db;
  }

  async dangerouslyClearAll(): Promise<void> {
    this.db.workspaces.clear();
    this.db.workspaceVersions.clear();
  }

  // ==========================================================================
  // Workspace CRUD Methods
  // ==========================================================================

  async getById(id: string): Promise<StorageWorkspaceType | null> {
    this.logger.debug(`InMemoryWorkspacesStorage: getById called for ${id}`);
    const config = this.db.workspaces.get(id);
    return config ? this.deepCopyConfig(config) : null;
  }

  async create(input: { workspace: StorageCreateWorkspaceInput }): Promise<StorageWorkspaceType> {
    const { workspace } = input;
    this.logger.debug(`InMemoryWorkspacesStorage: create called for ${workspace.id}`);

    if (this.db.workspaces.has(workspace.id)) {
      throw new Error(`Workspace with id ${workspace.id} already exists`);
    }

    const now = new Date();
    const newConfig: StorageWorkspaceType = {
      id: workspace.id,
      status: 'draft',
      activeVersionId: undefined,
      authorId: workspace.authorId,
      metadata: workspace.metadata,
      createdAt: now,
      updatedAt: now,
    };

    this.db.workspaces.set(workspace.id, newConfig);

    // Extract config fields from the flat input (everything except record fields)
    const { id: _id, authorId: _authorId, metadata: _metadata, ...snapshotConfig } = workspace;

    // Create version 1 from the config
    const versionId = crypto.randomUUID();
    await this.createVersion({
      id: versionId,
      workspaceId: workspace.id,
      versionNumber: 1,
      ...snapshotConfig,
      changedFields: Object.keys(snapshotConfig),
      changeMessage: 'Initial version',
    });

    // Return the thin record
    return this.deepCopyConfig(newConfig);
  }

  async update(input: StorageUpdateWorkspaceInput): Promise<StorageWorkspaceType> {
    const { id, ...updates } = input;
    this.logger.debug(`InMemoryWorkspacesStorage: update called for ${id}`);

    const existingConfig = this.db.workspaces.get(id);
    if (!existingConfig) {
      throw new Error(`Workspace with id ${id} not found`);
    }

    // Separate metadata fields from config fields
    const { authorId, activeVersionId, metadata, status, ...configFields } = updates;

    // Config field names from StorageWorkspaceSnapshotType
    const configFieldNames = [
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
    ];

    // Check if any config fields are present in the update
    const hasConfigUpdate = configFieldNames.some(field => field in configFields);

    // Update metadata fields on the record
    const updatedConfig: StorageWorkspaceType = {
      ...existingConfig,
      ...(authorId !== undefined && { authorId }),
      ...(activeVersionId !== undefined && { activeVersionId }),
      ...(status !== undefined && { status: status as StorageWorkspaceType['status'] }),
      ...(metadata !== undefined && {
        metadata: { ...existingConfig.metadata, ...metadata },
      }),
      updatedAt: new Date(),
    };

    // Auto-set status to 'published' when activeVersionId is set, only if status is not explicitly provided
    if (activeVersionId !== undefined && status === undefined) {
      updatedConfig.status = 'published';
    }

    // If config fields are being updated, create a new version
    if (hasConfigUpdate) {
      // Get the latest version to use as base
      const latestVersion = await this.getLatestVersion(id);
      if (!latestVersion) {
        throw new Error(`No versions found for workspace ${id}`);
      }

      // Extract config from latest version
      const {
        id: _versionId,
        workspaceId: _workspaceId,
        versionNumber: _versionNumber,
        changedFields: _changedFields,
        changeMessage: _changeMessage,
        createdAt: _createdAt,
        ...latestConfig
      } = latestVersion;

      // Merge updates into latest config
      const newConfig = {
        ...latestConfig,
        ...configFields,
      };

      // Identify which fields changed
      const changedFields = configFieldNames.filter(
        field =>
          field in configFields &&
          JSON.stringify(configFields[field as keyof typeof configFields]) !==
            JSON.stringify(latestConfig[field as keyof typeof latestConfig]),
      );

      // Only create a new version if something actually changed
      if (changedFields.length > 0) {
        const newVersionId = crypto.randomUUID();
        const newVersionNumber = latestVersion.versionNumber + 1;

        await this.createVersion({
          id: newVersionId,
          workspaceId: id,
          versionNumber: newVersionNumber,
          ...newConfig,
          changedFields,
          changeMessage: `Updated ${changedFields.join(', ')}`,
        });
      }
    }

    // Save the updated record
    this.db.workspaces.set(id, updatedConfig);
    return this.deepCopyConfig(updatedConfig);
  }

  async delete(id: string): Promise<void> {
    this.logger.debug(`InMemoryWorkspacesStorage: delete called for ${id}`);
    // Idempotent delete
    this.db.workspaces.delete(id);
    // Also delete all versions for this workspace
    await this.deleteVersionsByParentId(id);
  }

  async list(args?: StorageListWorkspacesInput): Promise<StorageListWorkspacesOutput> {
    const { page = 0, perPage: perPageInput, orderBy, authorId, metadata } = args || {};
    const { field, direction } = this.parseOrderBy(orderBy);

    this.logger.debug(`InMemoryWorkspacesStorage: list called`);

    // Normalize perPage for query (false → MAX_SAFE_INTEGER, 0 → 0, undefined → 100)
    const perPage = normalizePerPage(perPageInput, 100);

    if (page < 0) {
      throw new Error('page must be >= 0');
    }

    // Prevent unreasonably large page values
    const maxOffset = Number.MAX_SAFE_INTEGER / 2;
    if (page * perPage > maxOffset) {
      throw new Error('page value too large');
    }

    // Get all workspaces and apply filters
    let configs = Array.from(this.db.workspaces.values());

    // Filter by authorId if provided
    if (authorId !== undefined) {
      configs = configs.filter(config => config.authorId === authorId);
    }

    // Filter by metadata if provided (AND logic)
    if (metadata && Object.keys(metadata).length > 0) {
      configs = configs.filter(config => {
        if (!config.metadata) return false;
        return Object.entries(metadata).every(([key, value]) => deepEqual(config.metadata![key], value));
      });
    }

    // Sort filtered configs
    const sortedConfigs = this.sortConfigs(configs, field, direction);

    // Deep clone to avoid mutation
    const clonedConfigs = sortedConfigs.map(config => this.deepCopyConfig(config));

    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    return {
      workspaces: clonedConfigs.slice(offset, offset + perPage),
      total: clonedConfigs.length,
      page,
      perPage: perPageForResponse,
      hasMore: offset + perPage < clonedConfigs.length,
    };
  }

  // ==========================================================================
  // Workspace Version Methods
  // ==========================================================================

  async createVersion(input: CreateWorkspaceVersionInput): Promise<WorkspaceVersion> {
    this.logger.debug(`InMemoryWorkspacesStorage: createVersion called for workspace ${input.workspaceId}`);

    // Check if version with this ID already exists
    if (this.db.workspaceVersions.has(input.id)) {
      throw new Error(`Version with id ${input.id} already exists`);
    }

    // Check for duplicate (workspaceId, versionNumber) pair
    for (const version of this.db.workspaceVersions.values()) {
      if (version.workspaceId === input.workspaceId && version.versionNumber === input.versionNumber) {
        throw new Error(`Version number ${input.versionNumber} already exists for workspace ${input.workspaceId}`);
      }
    }

    const version: WorkspaceVersion = {
      ...input,
      createdAt: new Date(),
    };

    // Deep clone before storing
    this.db.workspaceVersions.set(input.id, this.deepCopyVersion(version));
    return this.deepCopyVersion(version);
  }

  async getVersion(id: string): Promise<WorkspaceVersion | null> {
    this.logger.debug(`InMemoryWorkspacesStorage: getVersion called for ${id}`);
    const version = this.db.workspaceVersions.get(id);
    return version ? this.deepCopyVersion(version) : null;
  }

  async getVersionByNumber(workspaceId: string, versionNumber: number): Promise<WorkspaceVersion | null> {
    this.logger.debug(
      `InMemoryWorkspacesStorage: getVersionByNumber called for workspace ${workspaceId}, v${versionNumber}`,
    );

    for (const version of this.db.workspaceVersions.values()) {
      if (version.workspaceId === workspaceId && version.versionNumber === versionNumber) {
        return this.deepCopyVersion(version);
      }
    }
    return null;
  }

  async getLatestVersion(workspaceId: string): Promise<WorkspaceVersion | null> {
    this.logger.debug(`InMemoryWorkspacesStorage: getLatestVersion called for workspace ${workspaceId}`);

    let latest: WorkspaceVersion | null = null;
    for (const version of this.db.workspaceVersions.values()) {
      if (version.workspaceId === workspaceId) {
        if (!latest || version.versionNumber > latest.versionNumber) {
          latest = version;
        }
      }
    }
    return latest ? this.deepCopyVersion(latest) : null;
  }

  async listVersions(input: ListWorkspaceVersionsInput): Promise<ListWorkspaceVersionsOutput> {
    const { workspaceId, page = 0, perPage: perPageInput, orderBy } = input;
    const { field, direction } = this.parseVersionOrderBy(orderBy);

    this.logger.debug(`InMemoryWorkspacesStorage: listVersions called for workspace ${workspaceId}`);

    // Normalize perPage (false -> MAX_SAFE_INTEGER, 0 -> 0, undefined -> 20)
    const perPage = normalizePerPage(perPageInput, 20);

    if (page < 0) {
      throw new Error('page must be >= 0');
    }

    const maxOffset = Number.MAX_SAFE_INTEGER / 2;
    if (page * perPage > maxOffset) {
      throw new Error('page value too large');
    }

    // Filter versions by workspaceId
    let versions = Array.from(this.db.workspaceVersions.values()).filter(v => v.workspaceId === workspaceId);

    // Sort versions
    versions = this.sortVersions(versions, field, direction);

    // Deep clone
    const clonedVersions = versions.map(v => this.deepCopyVersion(v));

    const total = clonedVersions.length;
    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);
    const paginatedVersions = clonedVersions.slice(offset, offset + perPage);

    return {
      versions: paginatedVersions,
      total,
      page,
      perPage: perPageForResponse,
      hasMore: offset + perPage < total,
    };
  }

  async deleteVersion(id: string): Promise<void> {
    this.logger.debug(`InMemoryWorkspacesStorage: deleteVersion called for ${id}`);
    this.db.workspaceVersions.delete(id);
  }

  async deleteVersionsByParentId(entityId: string): Promise<void> {
    this.logger.debug(`InMemoryWorkspacesStorage: deleteVersionsByParentId called for workspace ${entityId}`);

    const idsToDelete: string[] = [];
    for (const [id, version] of this.db.workspaceVersions.entries()) {
      if (version.workspaceId === entityId) {
        idsToDelete.push(id);
      }
    }

    for (const id of idsToDelete) {
      this.db.workspaceVersions.delete(id);
    }
  }

  async countVersions(workspaceId: string): Promise<number> {
    this.logger.debug(`InMemoryWorkspacesStorage: countVersions called for workspace ${workspaceId}`);

    let count = 0;
    for (const version of this.db.workspaceVersions.values()) {
      if (version.workspaceId === workspaceId) {
        count++;
      }
    }
    return count;
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  private deepCopyConfig(config: StorageWorkspaceType): StorageWorkspaceType {
    return {
      ...config,
      metadata: config.metadata ? { ...config.metadata } : config.metadata,
    };
  }

  private deepCopyVersion(version: WorkspaceVersion): WorkspaceVersion {
    return structuredClone(version);
  }

  private sortConfigs(
    configs: StorageWorkspaceType[],
    field: ThreadOrderBy,
    direction: ThreadSortDirection,
  ): StorageWorkspaceType[] {
    return configs.sort((a, b) => {
      const aValue = a[field].getTime();
      const bValue = b[field].getTime();

      return direction === 'ASC' ? aValue - bValue : bValue - aValue;
    });
  }

  private sortVersions(
    versions: WorkspaceVersion[],
    field: WorkspaceVersionOrderBy,
    direction: WorkspaceVersionSortDirection,
  ): WorkspaceVersion[] {
    return versions.sort((a, b) => {
      let aVal: number;
      let bVal: number;

      if (field === 'createdAt') {
        aVal = a.createdAt.getTime();
        bVal = b.createdAt.getTime();
      } else {
        // versionNumber
        aVal = a.versionNumber;
        bVal = b.versionNumber;
      }

      return direction === 'ASC' ? aVal - bVal : bVal - aVal;
    });
  }
}
