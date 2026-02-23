import { deepEqual } from '../../../utils';
import { normalizePerPage, calculatePagination } from '../../base';
import type {
  StorageMCPClientType,
  StorageCreateMCPClientInput,
  StorageUpdateMCPClientInput,
  StorageListMCPClientsInput,
  StorageListMCPClientsOutput,
  EntityOrderBy,
  ThreadSortDirection,
} from '../../types';
import type { InMemoryDB } from '../inmemory-db';
import type {
  MCPClientVersion,
  CreateMCPClientVersionInput,
  ListMCPClientVersionsInput,
  ListMCPClientVersionsOutput,
  MCPClientVersionOrderBy,
  MCPClientVersionSortDirection,
} from './base';
import { MCPClientsStorage } from './base';

export class InMemoryMCPClientsStorage extends MCPClientsStorage {
  private db: InMemoryDB;

  constructor({ db }: { db: InMemoryDB }) {
    super();
    this.db = db;
  }

  async dangerouslyClearAll(): Promise<void> {
    this.db.mcpClients.clear();
    this.db.mcpClientVersions.clear();
  }

  // ==========================================================================
  // MCP Client CRUD Methods
  // ==========================================================================

  async getById(id: string): Promise<StorageMCPClientType | null> {
    this.logger.debug(`InMemoryMCPClientsStorage: getById called for ${id}`);
    const config = this.db.mcpClients.get(id);
    return config ? this.deepCopyConfig(config) : null;
  }

  async create(input: { mcpClient: StorageCreateMCPClientInput }): Promise<StorageMCPClientType> {
    const { mcpClient } = input;
    this.logger.debug(`InMemoryMCPClientsStorage: create called for ${mcpClient.id}`);

    if (this.db.mcpClients.has(mcpClient.id)) {
      throw new Error(`MCP client with id ${mcpClient.id} already exists`);
    }

    const now = new Date();
    const newConfig: StorageMCPClientType = {
      id: mcpClient.id,
      status: 'draft',
      activeVersionId: undefined,
      authorId: mcpClient.authorId,
      metadata: mcpClient.metadata,
      createdAt: now,
      updatedAt: now,
    };

    this.db.mcpClients.set(mcpClient.id, newConfig);

    // Extract config fields from the flat input (everything except record fields)
    const { id: _id, authorId: _authorId, metadata: _metadata, ...snapshotConfig } = mcpClient;

    // Create version 1 from the config
    const versionId = crypto.randomUUID();
    await this.createVersion({
      id: versionId,
      mcpClientId: mcpClient.id,
      versionNumber: 1,
      ...snapshotConfig,
      changedFields: Object.keys(snapshotConfig),
      changeMessage: 'Initial version',
    });

    // Return the thin record
    return this.deepCopyConfig(newConfig);
  }

  async update(input: StorageUpdateMCPClientInput): Promise<StorageMCPClientType> {
    const { id, ...updates } = input;
    this.logger.debug(`InMemoryMCPClientsStorage: update called for ${id}`);

    const existingConfig = this.db.mcpClients.get(id);
    if (!existingConfig) {
      throw new Error(`MCP client with id ${id} not found`);
    }

    // Separate metadata fields from config fields
    const { authorId, activeVersionId, metadata, status } = updates;

    // Update metadata fields on the record
    const updatedConfig: StorageMCPClientType = {
      ...existingConfig,
      ...(authorId !== undefined && { authorId }),
      ...(activeVersionId !== undefined && { activeVersionId }),
      ...(status !== undefined && { status: status as StorageMCPClientType['status'] }),
      ...(metadata !== undefined && {
        metadata: { ...existingConfig.metadata, ...metadata },
      }),
      updatedAt: new Date(),
    };

    // Save the updated record
    this.db.mcpClients.set(id, updatedConfig);
    return this.deepCopyConfig(updatedConfig);
  }

  async delete(id: string): Promise<void> {
    this.logger.debug(`InMemoryMCPClientsStorage: delete called for ${id}`);
    // Idempotent delete
    this.db.mcpClients.delete(id);
    // Also delete all versions for this client
    await this.deleteVersionsByParentId(id);
  }

  async list(args?: StorageListMCPClientsInput): Promise<StorageListMCPClientsOutput> {
    const { page = 0, perPage: perPageInput, orderBy, authorId, metadata, status } = args || {};
    const { field, direction } = this.parseOrderBy(orderBy);

    this.logger.debug(`InMemoryMCPClientsStorage: list called`);

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

    // Get all MCP clients and apply filters
    let configs = Array.from(this.db.mcpClients.values());

    // Filter by status
    if (status) {
      configs = configs.filter(config => config.status === status);
    }

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
      mcpClients: clonedConfigs.slice(offset, offset + perPage),
      total: clonedConfigs.length,
      page,
      perPage: perPageForResponse,
      hasMore: offset + perPage < clonedConfigs.length,
    };
  }

  // ==========================================================================
  // MCP Client Version Methods
  // ==========================================================================

  async createVersion(input: CreateMCPClientVersionInput): Promise<MCPClientVersion> {
    this.logger.debug(`InMemoryMCPClientsStorage: createVersion called for MCP client ${input.mcpClientId}`);

    // Check if version with this ID already exists
    if (this.db.mcpClientVersions.has(input.id)) {
      throw new Error(`Version with id ${input.id} already exists`);
    }

    // Check for duplicate (mcpClientId, versionNumber) pair
    for (const version of this.db.mcpClientVersions.values()) {
      if (version.mcpClientId === input.mcpClientId && version.versionNumber === input.versionNumber) {
        throw new Error(`Version number ${input.versionNumber} already exists for MCP client ${input.mcpClientId}`);
      }
    }

    const version: MCPClientVersion = {
      ...input,
      createdAt: new Date(),
    };

    // Deep clone before storing
    this.db.mcpClientVersions.set(input.id, this.deepCopyVersion(version));
    return this.deepCopyVersion(version);
  }

  async getVersion(id: string): Promise<MCPClientVersion | null> {
    this.logger.debug(`InMemoryMCPClientsStorage: getVersion called for ${id}`);
    const version = this.db.mcpClientVersions.get(id);
    return version ? this.deepCopyVersion(version) : null;
  }

  async getVersionByNumber(mcpClientId: string, versionNumber: number): Promise<MCPClientVersion | null> {
    this.logger.debug(
      `InMemoryMCPClientsStorage: getVersionByNumber called for MCP client ${mcpClientId}, v${versionNumber}`,
    );

    for (const version of this.db.mcpClientVersions.values()) {
      if (version.mcpClientId === mcpClientId && version.versionNumber === versionNumber) {
        return this.deepCopyVersion(version);
      }
    }
    return null;
  }

  async getLatestVersion(mcpClientId: string): Promise<MCPClientVersion | null> {
    this.logger.debug(`InMemoryMCPClientsStorage: getLatestVersion called for MCP client ${mcpClientId}`);

    let latest: MCPClientVersion | null = null;
    for (const version of this.db.mcpClientVersions.values()) {
      if (version.mcpClientId === mcpClientId) {
        if (!latest || version.versionNumber > latest.versionNumber) {
          latest = version;
        }
      }
    }
    return latest ? this.deepCopyVersion(latest) : null;
  }

  async listVersions(input: ListMCPClientVersionsInput): Promise<ListMCPClientVersionsOutput> {
    const { mcpClientId, page = 0, perPage: perPageInput, orderBy } = input;
    const { field, direction } = this.parseVersionOrderBy(orderBy);

    this.logger.debug(`InMemoryMCPClientsStorage: listVersions called for MCP client ${mcpClientId}`);

    // Normalize perPage (false -> MAX_SAFE_INTEGER, 0 -> 0, undefined -> 20)
    const perPage = normalizePerPage(perPageInput, 20);

    if (page < 0) {
      throw new Error('page must be >= 0');
    }

    const maxOffset = Number.MAX_SAFE_INTEGER / 2;
    if (page * perPage > maxOffset) {
      throw new Error('page value too large');
    }

    // Filter versions by mcpClientId
    let versions = Array.from(this.db.mcpClientVersions.values()).filter(v => v.mcpClientId === mcpClientId);

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
    this.logger.debug(`InMemoryMCPClientsStorage: deleteVersion called for ${id}`);
    this.db.mcpClientVersions.delete(id);
  }

  async deleteVersionsByParentId(entityId: string): Promise<void> {
    this.logger.debug(`InMemoryMCPClientsStorage: deleteVersionsByParentId called for MCP client ${entityId}`);

    const idsToDelete: string[] = [];
    for (const [id, version] of this.db.mcpClientVersions.entries()) {
      if (version.mcpClientId === entityId) {
        idsToDelete.push(id);
      }
    }

    for (const id of idsToDelete) {
      this.db.mcpClientVersions.delete(id);
    }
  }

  async countVersions(mcpClientId: string): Promise<number> {
    this.logger.debug(`InMemoryMCPClientsStorage: countVersions called for MCP client ${mcpClientId}`);

    let count = 0;
    for (const version of this.db.mcpClientVersions.values()) {
      if (version.mcpClientId === mcpClientId) {
        count++;
      }
    }
    return count;
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  private deepCopyConfig(config: StorageMCPClientType): StorageMCPClientType {
    return {
      ...config,
      metadata: config.metadata ? { ...config.metadata } : config.metadata,
    };
  }

  private deepCopyVersion(version: MCPClientVersion): MCPClientVersion {
    return {
      ...version,
      servers: version.servers ? JSON.parse(JSON.stringify(version.servers)) : version.servers,
      changedFields: version.changedFields ? [...version.changedFields] : version.changedFields,
    };
  }

  private sortConfigs(
    configs: StorageMCPClientType[],
    field: EntityOrderBy,
    direction: ThreadSortDirection,
  ): StorageMCPClientType[] {
    return configs.sort((a, b) => {
      const aValue = a[field].getTime();
      const bValue = b[field].getTime();

      return direction === 'ASC' ? aValue - bValue : bValue - aValue;
    });
  }

  private sortVersions(
    versions: MCPClientVersion[],
    field: MCPClientVersionOrderBy,
    direction: MCPClientVersionSortDirection,
  ): MCPClientVersion[] {
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
