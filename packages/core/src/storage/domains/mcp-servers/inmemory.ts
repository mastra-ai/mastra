import { deepEqual } from '../../../utils';
import { normalizePerPage, calculatePagination } from '../../base';
import type {
  StorageMCPServerType,
  StorageCreateMCPServerInput,
  StorageUpdateMCPServerInput,
  StorageListMCPServersInput,
  StorageListMCPServersOutput,
  ThreadOrderBy,
  ThreadSortDirection,
} from '../../types';
import type { InMemoryDB } from '../inmemory-db';
import type {
  MCPServerVersion,
  CreateMCPServerVersionInput,
  ListMCPServerVersionsInput,
  ListMCPServerVersionsOutput,
  MCPServerVersionOrderBy,
  MCPServerVersionSortDirection,
} from './base';
import { MCPServersStorage } from './base';

export class InMemoryMCPServersStorage extends MCPServersStorage {
  private db: InMemoryDB;

  constructor({ db }: { db: InMemoryDB }) {
    super();
    this.db = db;
  }

  async dangerouslyClearAll(): Promise<void> {
    this.db.mcpServers.clear();
    this.db.mcpServerVersions.clear();
  }

  // ==========================================================================
  // MCP Server CRUD Methods
  // ==========================================================================

  async getById(id: string): Promise<StorageMCPServerType | null> {
    this.logger.debug(`InMemoryMCPServersStorage: getById called for ${id}`);
    const config = this.db.mcpServers.get(id);
    return config ? this.deepCopyConfig(config) : null;
  }

  async create(input: { mcpServer: StorageCreateMCPServerInput }): Promise<StorageMCPServerType> {
    const { mcpServer } = input;
    this.logger.debug(`InMemoryMCPServersStorage: create called for ${mcpServer.id}`);

    if (this.db.mcpServers.has(mcpServer.id)) {
      throw new Error(`MCP server with id ${mcpServer.id} already exists`);
    }

    const now = new Date();
    const newConfig: StorageMCPServerType = {
      id: mcpServer.id,
      status: 'draft',
      activeVersionId: undefined,
      authorId: mcpServer.authorId,
      metadata: mcpServer.metadata,
      createdAt: now,
      updatedAt: now,
    };

    this.db.mcpServers.set(mcpServer.id, newConfig);

    // Extract config fields from the flat input (everything except record fields)
    const { id: _id, authorId: _authorId, metadata: _metadata, ...snapshotConfig } = mcpServer;

    // Create version 1 from the config
    const versionId = crypto.randomUUID();
    await this.createVersion({
      id: versionId,
      mcpServerId: mcpServer.id,
      versionNumber: 1,
      ...snapshotConfig,
      changedFields: Object.keys(snapshotConfig),
      changeMessage: 'Initial version',
    });

    // Return the thin record
    return this.deepCopyConfig(newConfig);
  }

  async update(input: StorageUpdateMCPServerInput): Promise<StorageMCPServerType> {
    const { id, ...updates } = input;
    this.logger.debug(`InMemoryMCPServersStorage: update called for ${id}`);

    const existingConfig = this.db.mcpServers.get(id);
    if (!existingConfig) {
      throw new Error(`MCP server with id ${id} not found`);
    }

    // Separate metadata fields from config fields
    const { authorId, activeVersionId, metadata, status } = updates;

    // Update metadata fields on the record
    const updatedConfig: StorageMCPServerType = {
      ...existingConfig,
      ...(authorId !== undefined && { authorId }),
      ...(activeVersionId !== undefined && { activeVersionId }),
      ...(status !== undefined && { status: status as StorageMCPServerType['status'] }),
      ...(metadata !== undefined && {
        metadata: { ...existingConfig.metadata, ...metadata },
      }),
      updatedAt: new Date(),
    };

    // Save the updated record
    this.db.mcpServers.set(id, updatedConfig);
    return this.deepCopyConfig(updatedConfig);
  }

  async delete(id: string): Promise<void> {
    this.logger.debug(`InMemoryMCPServersStorage: delete called for ${id}`);
    // Idempotent delete
    this.db.mcpServers.delete(id);
    // Also delete all versions for this server
    await this.deleteVersionsByParentId(id);
  }

  async list(args?: StorageListMCPServersInput): Promise<StorageListMCPServersOutput> {
    const { page = 0, perPage: perPageInput, orderBy, authorId, metadata, status } = args || {};
    const { field, direction } = this.parseOrderBy(orderBy);

    this.logger.debug(`InMemoryMCPServersStorage: list called`);

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

    // Get all MCP servers and apply filters
    let configs = Array.from(this.db.mcpServers.values());

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
      mcpServers: clonedConfigs.slice(offset, offset + perPage),
      total: clonedConfigs.length,
      page,
      perPage: perPageForResponse,
      hasMore: offset + perPage < clonedConfigs.length,
    };
  }

  // ==========================================================================
  // MCP Server Version Methods
  // ==========================================================================

  async createVersion(input: CreateMCPServerVersionInput): Promise<MCPServerVersion> {
    this.logger.debug(`InMemoryMCPServersStorage: createVersion called for MCP server ${input.mcpServerId}`);

    // Check if version with this ID already exists
    if (this.db.mcpServerVersions.has(input.id)) {
      throw new Error(`Version with id ${input.id} already exists`);
    }

    // Check for duplicate (mcpServerId, versionNumber) pair
    for (const version of this.db.mcpServerVersions.values()) {
      if (version.mcpServerId === input.mcpServerId && version.versionNumber === input.versionNumber) {
        throw new Error(`Version number ${input.versionNumber} already exists for MCP server ${input.mcpServerId}`);
      }
    }

    const version: MCPServerVersion = {
      ...input,
      createdAt: new Date(),
    };

    // Deep clone before storing
    this.db.mcpServerVersions.set(input.id, this.deepCopyVersion(version));
    return this.deepCopyVersion(version);
  }

  async getVersion(id: string): Promise<MCPServerVersion | null> {
    this.logger.debug(`InMemoryMCPServersStorage: getVersion called for ${id}`);
    const version = this.db.mcpServerVersions.get(id);
    return version ? this.deepCopyVersion(version) : null;
  }

  async getVersionByNumber(mcpServerId: string, versionNumber: number): Promise<MCPServerVersion | null> {
    this.logger.debug(
      `InMemoryMCPServersStorage: getVersionByNumber called for MCP server ${mcpServerId}, v${versionNumber}`,
    );

    for (const version of this.db.mcpServerVersions.values()) {
      if (version.mcpServerId === mcpServerId && version.versionNumber === versionNumber) {
        return this.deepCopyVersion(version);
      }
    }
    return null;
  }

  async getLatestVersion(mcpServerId: string): Promise<MCPServerVersion | null> {
    this.logger.debug(`InMemoryMCPServersStorage: getLatestVersion called for MCP server ${mcpServerId}`);

    let latest: MCPServerVersion | null = null;
    for (const version of this.db.mcpServerVersions.values()) {
      if (version.mcpServerId === mcpServerId) {
        if (!latest || version.versionNumber > latest.versionNumber) {
          latest = version;
        }
      }
    }
    return latest ? this.deepCopyVersion(latest) : null;
  }

  async listVersions(input: ListMCPServerVersionsInput): Promise<ListMCPServerVersionsOutput> {
    const { mcpServerId, page = 0, perPage: perPageInput, orderBy } = input;
    const { field, direction } = this.parseVersionOrderBy(orderBy);

    this.logger.debug(`InMemoryMCPServersStorage: listVersions called for MCP server ${mcpServerId}`);

    // Normalize perPage (false -> MAX_SAFE_INTEGER, 0 -> 0, undefined -> 20)
    const perPage = normalizePerPage(perPageInput, 20);

    if (page < 0) {
      throw new Error('page must be >= 0');
    }

    const maxOffset = Number.MAX_SAFE_INTEGER / 2;
    if (page * perPage > maxOffset) {
      throw new Error('page value too large');
    }

    // Filter versions by mcpServerId
    let versions = Array.from(this.db.mcpServerVersions.values()).filter(v => v.mcpServerId === mcpServerId);

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
    this.logger.debug(`InMemoryMCPServersStorage: deleteVersion called for ${id}`);
    this.db.mcpServerVersions.delete(id);
  }

  async deleteVersionsByParentId(entityId: string): Promise<void> {
    this.logger.debug(`InMemoryMCPServersStorage: deleteVersionsByParentId called for MCP server ${entityId}`);

    const idsToDelete: string[] = [];
    for (const [id, version] of this.db.mcpServerVersions.entries()) {
      if (version.mcpServerId === entityId) {
        idsToDelete.push(id);
      }
    }

    for (const id of idsToDelete) {
      this.db.mcpServerVersions.delete(id);
    }
  }

  async countVersions(mcpServerId: string): Promise<number> {
    this.logger.debug(`InMemoryMCPServersStorage: countVersions called for MCP server ${mcpServerId}`);

    let count = 0;
    for (const version of this.db.mcpServerVersions.values()) {
      if (version.mcpServerId === mcpServerId) {
        count++;
      }
    }
    return count;
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  private deepCopyConfig(config: StorageMCPServerType): StorageMCPServerType {
    return {
      ...config,
      metadata: config.metadata ? { ...config.metadata } : config.metadata,
    };
  }

  private deepCopyVersion(version: MCPServerVersion): MCPServerVersion {
    return {
      ...version,
      tools: version.tools ? JSON.parse(JSON.stringify(version.tools)) : version.tools,
      agents: version.agents ? JSON.parse(JSON.stringify(version.agents)) : version.agents,
      workflows: version.workflows ? JSON.parse(JSON.stringify(version.workflows)) : version.workflows,
      repository: version.repository ? { ...version.repository } : version.repository,
      changedFields: version.changedFields ? [...version.changedFields] : version.changedFields,
    };
  }

  private sortConfigs(
    configs: StorageMCPServerType[],
    field: ThreadOrderBy,
    direction: ThreadSortDirection,
  ): StorageMCPServerType[] {
    return configs.sort((a, b) => {
      const aValue = a[field].getTime();
      const bValue = b[field].getTime();

      return direction === 'ASC' ? aValue - bValue : bValue - aValue;
    });
  }

  private sortVersions(
    versions: MCPServerVersion[],
    field: MCPServerVersionOrderBy,
    direction: MCPServerVersionSortDirection,
  ): MCPServerVersion[] {
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
