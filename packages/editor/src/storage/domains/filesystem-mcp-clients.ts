import { MCPClientsStorage } from '@mastra/core/storage';
import type {
  StorageMCPClientType,
  StorageCreateMCPClientInput,
  StorageUpdateMCPClientInput,
  StorageListMCPClientsInput,
  StorageListMCPClientsOutput,
} from '@mastra/core/storage';
import type {
  MCPClientVersion,
  CreateMCPClientVersionInput,
  ListMCPClientVersionsInput,
  ListMCPClientVersionsOutput,
} from '@mastra/core/storage';

import type { FilesystemDB } from '../filesystem-db';
import { FilesystemVersionedHelpers } from '../filesystem-versioned';

export class FilesystemMCPClientsStorage extends MCPClientsStorage {
  private helpers: FilesystemVersionedHelpers<StorageMCPClientType, MCPClientVersion>;

  constructor({ db }: { db: FilesystemDB }) {
    super();
    this.helpers = new FilesystemVersionedHelpers({
      db,
      entitiesFile: 'mcp-clients.json',
      parentIdField: 'mcpClientId',
      name: 'FilesystemMCPClientsStorage',
      versionMetadataFields: ['id', 'mcpClientId', 'versionNumber', 'changedFields', 'changeMessage', 'createdAt'],
    });
  }

  override async init(): Promise<void> {
    await this.helpers.db.init();
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.helpers.dangerouslyClearAll();
  }

  async getById(id: string): Promise<StorageMCPClientType | null> {
    return this.helpers.getById(id);
  }

  async create(input: { mcpClient: StorageCreateMCPClientInput }): Promise<StorageMCPClientType> {
    const { mcpClient } = input;
    const now = new Date();
    const entity: StorageMCPClientType = {
      id: mcpClient.id,
      status: 'draft',
      activeVersionId: undefined,
      authorId: mcpClient.authorId,
      metadata: mcpClient.metadata,
      createdAt: now,
      updatedAt: now,
    };

    await this.helpers.createEntity(mcpClient.id, entity);

    const { id: _id, authorId: _authorId, metadata: _metadata, ...snapshotConfig } = mcpClient;
    const versionId = crypto.randomUUID();
    await this.createVersion({
      id: versionId,
      mcpClientId: mcpClient.id,
      versionNumber: 1,
      ...snapshotConfig,
      changedFields: Object.keys(snapshotConfig),
      changeMessage: 'Initial version',
    } as CreateMCPClientVersionInput);

    return structuredClone(entity);
  }

  async update(input: StorageUpdateMCPClientInput): Promise<StorageMCPClientType> {
    const { id, ...updates } = input;
    return this.helpers.updateEntity(id, updates);
  }

  async delete(id: string): Promise<void> {
    await this.helpers.deleteEntity(id);
  }

  async list(args?: StorageListMCPClientsInput): Promise<StorageListMCPClientsOutput> {
    const { page, perPage, orderBy, authorId, metadata, status } = args || {};
    const result = await this.helpers.listEntities({
      page,
      perPage,
      orderBy,
      listKey: 'mcpClients',
      filters: { authorId, metadata, status },
    });
    return result as unknown as StorageListMCPClientsOutput;
  }

  async createVersion(input: CreateMCPClientVersionInput): Promise<MCPClientVersion> {
    return this.helpers.createVersion(input as MCPClientVersion);
  }

  async getVersion(id: string): Promise<MCPClientVersion | null> {
    return this.helpers.getVersion(id);
  }

  async getVersionByNumber(mcpClientId: string, versionNumber: number): Promise<MCPClientVersion | null> {
    return this.helpers.getVersionByNumber(mcpClientId, versionNumber);
  }

  async getLatestVersion(mcpClientId: string): Promise<MCPClientVersion | null> {
    return this.helpers.getLatestVersion(mcpClientId);
  }

  async listVersions(input: ListMCPClientVersionsInput): Promise<ListMCPClientVersionsOutput> {
    const result = await this.helpers.listVersions(input, 'mcpClientId');
    return result as ListMCPClientVersionsOutput;
  }

  async deleteVersion(id: string): Promise<void> {
    await this.helpers.deleteVersion(id);
  }

  async deleteVersionsByParentId(entityId: string): Promise<void> {
    await this.helpers.deleteVersionsByParentId(entityId);
  }

  async countVersions(mcpClientId: string): Promise<number> {
    return this.helpers.countVersions(mcpClientId);
  }
}
