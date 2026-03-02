import { WorkspacesStorage } from '@mastra/core/storage';
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
} from '@mastra/core/storage';

import type { FilesystemDB } from '../filesystem-db';
import { FilesystemVersionedHelpers } from '../filesystem-versioned';

export class FilesystemWorkspacesStorage extends WorkspacesStorage {
  private helpers: FilesystemVersionedHelpers<StorageWorkspaceType, WorkspaceVersion>;

  constructor({ db }: { db: FilesystemDB }) {
    super();
    this.helpers = new FilesystemVersionedHelpers({
      db,
      entitiesFile: 'workspaces.json',
      parentIdField: 'workspaceId',
      name: 'FilesystemWorkspacesStorage',
      versionMetadataFields: ['id', 'workspaceId', 'versionNumber', 'changedFields', 'changeMessage', 'createdAt'],
    });
  }

  override async init(): Promise<void> {
    await this.helpers.db.init();
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.helpers.dangerouslyClearAll();
  }

  async getById(id: string): Promise<StorageWorkspaceType | null> {
    return this.helpers.getById(id);
  }

  async create(input: { workspace: StorageCreateWorkspaceInput }): Promise<StorageWorkspaceType> {
    const { workspace } = input;
    const now = new Date();
    const entity: StorageWorkspaceType = {
      id: workspace.id,
      status: 'draft',
      activeVersionId: undefined,
      authorId: workspace.authorId,
      metadata: workspace.metadata,
      createdAt: now,
      updatedAt: now,
    };

    await this.helpers.createEntity(workspace.id, entity);

    const { id: _id, authorId: _authorId, metadata: _metadata, ...snapshotConfig } = workspace;
    const versionId = crypto.randomUUID();
    await this.createVersion({
      id: versionId,
      workspaceId: workspace.id,
      versionNumber: 1,
      ...snapshotConfig,
      changedFields: Object.keys(snapshotConfig),
      changeMessage: 'Initial version',
    } as CreateWorkspaceVersionInput);

    return structuredClone(entity);
  }

  async update(input: StorageUpdateWorkspaceInput): Promise<StorageWorkspaceType> {
    const { id, ...updates } = input;
    return this.helpers.updateEntity(id, updates);
  }

  async delete(id: string): Promise<void> {
    await this.helpers.deleteEntity(id);
  }

  async list(args?: StorageListWorkspacesInput): Promise<StorageListWorkspacesOutput> {
    const { page, perPage, orderBy, authorId, metadata } = args || {};
    const result = await this.helpers.listEntities({
      page,
      perPage,
      orderBy,
      listKey: 'workspaces',
      filters: { authorId, metadata },
    });
    return result as unknown as StorageListWorkspacesOutput;
  }

  async createVersion(input: CreateWorkspaceVersionInput): Promise<WorkspaceVersion> {
    return this.helpers.createVersion(input as WorkspaceVersion);
  }

  async getVersion(id: string): Promise<WorkspaceVersion | null> {
    return this.helpers.getVersion(id);
  }

  async getVersionByNumber(workspaceId: string, versionNumber: number): Promise<WorkspaceVersion | null> {
    return this.helpers.getVersionByNumber(workspaceId, versionNumber);
  }

  async getLatestVersion(workspaceId: string): Promise<WorkspaceVersion | null> {
    return this.helpers.getLatestVersion(workspaceId);
  }

  async listVersions(input: ListWorkspaceVersionsInput): Promise<ListWorkspaceVersionsOutput> {
    const result = await this.helpers.listVersions(input, 'workspaceId');
    return result as ListWorkspaceVersionsOutput;
  }

  async deleteVersion(id: string): Promise<void> {
    await this.helpers.deleteVersion(id);
  }

  async deleteVersionsByParentId(entityId: string): Promise<void> {
    await this.helpers.deleteVersionsByParentId(entityId);
  }

  async countVersions(workspaceId: string): Promise<number> {
    return this.helpers.countVersions(workspaceId);
  }
}
