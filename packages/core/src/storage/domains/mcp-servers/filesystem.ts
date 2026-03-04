import type { FilesystemDB } from '../../filesystem-db';
import { FilesystemVersionedHelpers } from '../../filesystem-versioned';
import type {
  StorageMCPServerType,
  StorageCreateMCPServerInput,
  StorageUpdateMCPServerInput,
  StorageListMCPServersInput,
  StorageListMCPServersOutput,
} from '../../types';
import type {
  MCPServerVersion,
  CreateMCPServerVersionInput,
  ListMCPServerVersionsInput,
  ListMCPServerVersionsOutput,
} from './base';
import { MCPServersStorage } from './base';

export class FilesystemMCPServersStorage extends MCPServersStorage {
  private helpers: FilesystemVersionedHelpers<StorageMCPServerType, MCPServerVersion>;

  constructor({ db }: { db: FilesystemDB }) {
    super();
    this.helpers = new FilesystemVersionedHelpers({
      db,
      entitiesFile: 'mcp-servers.json',
      parentIdField: 'mcpServerId',
      name: 'FilesystemMCPServersStorage',
      versionMetadataFields: ['id', 'mcpServerId', 'versionNumber', 'changedFields', 'changeMessage', 'createdAt'],
    });
  }

  override async init(): Promise<void> {
    await this.helpers.db.init();
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.helpers.dangerouslyClearAll();
  }

  async getById(id: string): Promise<StorageMCPServerType | null> {
    return this.helpers.getById(id);
  }

  async create(input: { mcpServer: StorageCreateMCPServerInput }): Promise<StorageMCPServerType> {
    const { mcpServer } = input;
    const now = new Date();
    const entity: StorageMCPServerType = {
      id: mcpServer.id,
      status: 'draft',
      activeVersionId: undefined,
      authorId: mcpServer.authorId,
      metadata: mcpServer.metadata,
      createdAt: now,
      updatedAt: now,
    };

    await this.helpers.createEntity(mcpServer.id, entity);

    const { id: _id, authorId: _authorId, metadata: _metadata, ...snapshotConfig } = mcpServer;
    const versionId = crypto.randomUUID();
    await this.createVersion({
      id: versionId,
      mcpServerId: mcpServer.id,
      versionNumber: 1,
      ...snapshotConfig,
      changedFields: Object.keys(snapshotConfig),
      changeMessage: 'Initial version',
    } as CreateMCPServerVersionInput);

    return structuredClone(entity);
  }

  async update(input: StorageUpdateMCPServerInput): Promise<StorageMCPServerType> {
    const { id, ...updates } = input;
    return this.helpers.updateEntity(id, updates);
  }

  async delete(id: string): Promise<void> {
    await this.helpers.deleteEntity(id);
  }

  async list(args?: StorageListMCPServersInput): Promise<StorageListMCPServersOutput> {
    const { page, perPage, orderBy, authorId, metadata, status } = args || {};
    const result = await this.helpers.listEntities({
      page,
      perPage,
      orderBy,
      listKey: 'mcpServers',
      filters: { authorId, metadata, status },
    });
    return result as unknown as StorageListMCPServersOutput;
  }

  async createVersion(input: CreateMCPServerVersionInput): Promise<MCPServerVersion> {
    return this.helpers.createVersion(input as MCPServerVersion);
  }

  async getVersion(id: string): Promise<MCPServerVersion | null> {
    return this.helpers.getVersion(id);
  }

  async getVersionByNumber(mcpServerId: string, versionNumber: number): Promise<MCPServerVersion | null> {
    return this.helpers.getVersionByNumber(mcpServerId, versionNumber);
  }

  async getLatestVersion(mcpServerId: string): Promise<MCPServerVersion | null> {
    return this.helpers.getLatestVersion(mcpServerId);
  }

  async listVersions(input: ListMCPServerVersionsInput): Promise<ListMCPServerVersionsOutput> {
    const result = await this.helpers.listVersions(input, 'mcpServerId');
    return result as ListMCPServerVersionsOutput;
  }

  async deleteVersion(id: string): Promise<void> {
    await this.helpers.deleteVersion(id);
  }

  async deleteVersionsByParentId(entityId: string): Promise<void> {
    await this.helpers.deleteVersionsByParentId(entityId);
  }

  async countVersions(mcpServerId: string): Promise<number> {
    return this.helpers.countVersions(mcpServerId);
  }
}
