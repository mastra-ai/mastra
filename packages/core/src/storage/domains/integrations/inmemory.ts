import { normalizePerPage, calculatePagination } from '../../base';
import type {
  StorageIntegrationConfig,
  StorageCachedTool,
  StorageCreateIntegrationInput,
  StorageUpdateIntegrationInput,
  StorageListIntegrationsInput,
  StorageListIntegrationsOutput,
  StorageListCachedToolsInput,
  StorageListCachedToolsOutput,
  ThreadOrderBy,
  ThreadSortDirection,
} from '../../types';
import type { InMemoryDB } from '../inmemory-db';
import { IntegrationsStorage } from './base';

export class InMemoryIntegrationsStorage extends IntegrationsStorage {
  private db: InMemoryDB;

  constructor({ db }: { db: InMemoryDB }) {
    super();
    this.db = db;
  }

  async dangerouslyClearAll(): Promise<void> {
    this.db.integrations.clear();
    this.db.cachedTools.clear();
  }

  // ==========================================================================
  // Integration CRUD Methods
  // ==========================================================================

  async getIntegrationById({ id }: { id: string }): Promise<StorageIntegrationConfig | null> {
    this.logger.debug(`InMemoryIntegrationsStorage: getIntegrationById called for ${id}`);
    const integration = this.db.integrations.get(id);
    return integration
      ? {
          ...integration,
          selectedToolkits: [...integration.selectedToolkits],
          metadata: integration.metadata ? { ...integration.metadata } : integration.metadata,
        }
      : null;
  }

  async createIntegration({
    integration,
  }: {
    integration: StorageCreateIntegrationInput;
  }): Promise<StorageIntegrationConfig> {
    this.logger.debug(`InMemoryIntegrationsStorage: createIntegration called for ${integration.id}`);

    if (this.db.integrations.has(integration.id)) {
      throw new Error(`Integration with id ${integration.id} already exists`);
    }

    const now = new Date();
    const newIntegration: StorageIntegrationConfig = {
      ...integration,
      createdAt: now,
      updatedAt: now,
    };

    this.db.integrations.set(integration.id, newIntegration);
    return { ...newIntegration };
  }

  async updateIntegration({
    id,
    ...updates
  }: StorageUpdateIntegrationInput): Promise<StorageIntegrationConfig> {
    this.logger.debug(`InMemoryIntegrationsStorage: updateIntegration called for ${id}`);

    const existingIntegration = this.db.integrations.get(id);
    if (!existingIntegration) {
      throw new Error(`Integration with id ${id} not found`);
    }

    const updatedIntegration: StorageIntegrationConfig = {
      ...existingIntegration,
      ...(updates.name !== undefined && { name: updates.name }),
      ...(updates.enabled !== undefined && { enabled: updates.enabled }),
      ...(updates.selectedToolkits !== undefined && { selectedToolkits: updates.selectedToolkits }),
      ...(updates.metadata !== undefined && {
        metadata: { ...existingIntegration.metadata, ...updates.metadata },
      }),
      ...(updates.ownerId !== undefined && { ownerId: updates.ownerId }),
      updatedAt: new Date(),
    };

    this.db.integrations.set(id, updatedIntegration);
    return { ...updatedIntegration };
  }

  async deleteIntegration({ id }: { id: string }): Promise<void> {
    this.logger.debug(`InMemoryIntegrationsStorage: deleteIntegration called for ${id}`);
    // Idempotent delete - no-op if integration doesn't exist
    this.db.integrations.delete(id);
    // Also delete all cached tools for this integration
    await this.deleteCachedToolsByIntegration({ integrationId: id });
  }

  async listIntegrations(args?: StorageListIntegrationsInput): Promise<StorageListIntegrationsOutput> {
    const { page = 0, perPage: perPageInput, orderBy, ownerId, provider, enabled } = args || {};
    const { field, direction } = this.parseOrderBy(orderBy);

    this.logger.debug(`InMemoryIntegrationsStorage: listIntegrations called`);

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

    // Get all integrations and apply filters
    let integrations = Array.from(this.db.integrations.values());

    // Filter by ownerId if provided
    if (ownerId !== undefined) {
      integrations = integrations.filter(integration => integration.ownerId === ownerId);
    }

    // Filter by provider if provided
    if (provider !== undefined) {
      integrations = integrations.filter(integration => integration.provider === provider);
    }

    // Filter by enabled if provided
    if (enabled !== undefined) {
      integrations = integrations.filter(integration => integration.enabled === enabled);
    }

    // Sort filtered integrations
    const sortedIntegrations = this.sortIntegrations(integrations, field, direction);

    // Clone integrations to avoid mutation
    const clonedIntegrations = sortedIntegrations.map(integration => ({
      ...integration,
      selectedToolkits: [...integration.selectedToolkits],
      metadata: integration.metadata ? { ...integration.metadata } : integration.metadata,
    }));

    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    return {
      integrations: clonedIntegrations.slice(offset, offset + perPage),
      total: clonedIntegrations.length,
      page,
      perPage: perPageForResponse,
      hasMore: offset + perPage < clonedIntegrations.length,
    };
  }

  // ==========================================================================
  // Cached Tool Methods
  // ==========================================================================

  async cacheTool({
    tool,
  }: {
    tool: Omit<StorageCachedTool, 'cachedAt' | 'updatedAt'>;
  }): Promise<StorageCachedTool> {
    this.logger.debug(`InMemoryIntegrationsStorage: cacheTool called for ${tool.id}`);

    if (this.db.cachedTools.has(tool.id)) {
      throw new Error(`Cached tool with id ${tool.id} already exists`);
    }

    const now = new Date();
    const newTool: StorageCachedTool = {
      ...tool,
      cachedAt: now,
      updatedAt: now,
    };

    this.db.cachedTools.set(tool.id, newTool);
    return { ...newTool };
  }

  async cacheTools({
    tools,
  }: {
    tools: Omit<StorageCachedTool, 'cachedAt' | 'updatedAt'>[];
  }): Promise<StorageCachedTool[]> {
    this.logger.debug(`InMemoryIntegrationsStorage: cacheTools called for ${tools.length} tools`);

    const now = new Date();
    const cachedTools: StorageCachedTool[] = [];

    for (const tool of tools) {
      if (this.db.cachedTools.has(tool.id)) {
        throw new Error(`Cached tool with id ${tool.id} already exists`);
      }

      const newTool: StorageCachedTool = {
        ...tool,
        cachedAt: now,
        updatedAt: now,
      };

      this.db.cachedTools.set(tool.id, newTool);
      cachedTools.push({ ...newTool });
    }

    return cachedTools;
  }

  async getCachedTool({ id }: { id: string }): Promise<StorageCachedTool | null> {
    this.logger.debug(`InMemoryIntegrationsStorage: getCachedTool called for ${id}`);
    const tool = this.db.cachedTools.get(id);
    return tool
      ? {
          ...tool,
          inputSchema: tool.inputSchema ? { ...tool.inputSchema } : tool.inputSchema,
          outputSchema: tool.outputSchema ? { ...tool.outputSchema } : tool.outputSchema,
          rawDefinition: tool.rawDefinition ? { ...tool.rawDefinition } : tool.rawDefinition,
        }
      : null;
  }

  async getCachedToolBySlug({
    integrationId,
    toolSlug,
  }: {
    integrationId: string;
    toolSlug: string;
  }): Promise<StorageCachedTool | null> {
    this.logger.debug(
      `InMemoryIntegrationsStorage: getCachedToolBySlug called for integration ${integrationId}, tool ${toolSlug}`,
    );

    for (const tool of this.db.cachedTools.values()) {
      if (tool.integrationId === integrationId && tool.toolSlug === toolSlug) {
        return {
          ...tool,
          inputSchema: tool.inputSchema ? { ...tool.inputSchema } : tool.inputSchema,
          outputSchema: tool.outputSchema ? { ...tool.outputSchema } : tool.outputSchema,
          rawDefinition: tool.rawDefinition ? { ...tool.rawDefinition } : tool.rawDefinition,
        };
      }
    }

    return null;
  }

  async listCachedTools(args?: StorageListCachedToolsInput): Promise<StorageListCachedToolsOutput> {
    const {
      page = 0,
      perPage: perPageInput,
      orderBy,
      integrationId,
      provider,
      toolkitSlug,
    } = args || {};
    const { field, direction } = this.parseCachedToolOrderBy(orderBy);

    this.logger.debug(`InMemoryIntegrationsStorage: listCachedTools called`);

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

    // Get all cached tools and apply filters
    let tools = Array.from(this.db.cachedTools.values());

    // Filter by integrationId if provided
    if (integrationId !== undefined) {
      tools = tools.filter(tool => tool.integrationId === integrationId);
    }

    // Filter by provider if provided
    if (provider !== undefined) {
      tools = tools.filter(tool => tool.provider === provider);
    }

    // Filter by toolkitSlug if provided
    if (toolkitSlug !== undefined) {
      tools = tools.filter(tool => tool.toolkitSlug === toolkitSlug);
    }

    // Sort filtered tools
    const sortedTools = this.sortCachedTools(tools, field, direction);

    // Clone tools to avoid mutation
    const clonedTools = sortedTools.map(tool => ({
      ...tool,
      inputSchema: tool.inputSchema ? { ...tool.inputSchema } : tool.inputSchema,
      outputSchema: tool.outputSchema ? { ...tool.outputSchema } : tool.outputSchema,
      rawDefinition: tool.rawDefinition ? { ...tool.rawDefinition } : tool.rawDefinition,
    }));

    const { offset, perPage: perPageForResponse } = calculatePagination(page, perPageInput, perPage);

    return {
      tools: clonedTools.slice(offset, offset + perPage),
      total: clonedTools.length,
      page,
      perPage: perPageForResponse,
      hasMore: offset + perPage < clonedTools.length,
    };
  }

  async deleteCachedToolsByIntegration({ integrationId }: { integrationId: string }): Promise<void> {
    this.logger.debug(
      `InMemoryIntegrationsStorage: deleteCachedToolsByIntegration called for integration ${integrationId}`,
    );

    for (const [id, tool] of this.db.cachedTools.entries()) {
      if (tool.integrationId === integrationId) {
        this.db.cachedTools.delete(id);
      }
    }
  }

  async updateCachedToolsTimestamp({ integrationId }: { integrationId: string }): Promise<void> {
    this.logger.debug(
      `InMemoryIntegrationsStorage: updateCachedToolsTimestamp called for integration ${integrationId}`,
    );

    const now = new Date();

    for (const [id, tool] of this.db.cachedTools.entries()) {
      if (tool.integrationId === integrationId) {
        this.db.cachedTools.set(id, {
          ...tool,
          updatedAt: now,
        });
      }
    }
  }

  async deleteCachedTool({ id }: { id: string }): Promise<void> {
    this.logger.debug(`InMemoryIntegrationsStorage: deleteCachedTool called for ${id}`);
    // Idempotent delete - no-op if tool doesn't exist
    this.db.cachedTools.delete(id);
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  private sortIntegrations(
    integrations: StorageIntegrationConfig[],
    field: ThreadOrderBy,
    direction: ThreadSortDirection,
  ): StorageIntegrationConfig[] {
    return integrations.sort((a, b) => {
      const aValue = new Date(a[field]).getTime();
      const bValue = new Date(b[field]).getTime();

      return direction === 'ASC' ? aValue - bValue : bValue - aValue;
    });
  }

  private sortCachedTools(
    tools: StorageCachedTool[],
    field: 'cachedAt' | 'updatedAt',
    direction: ThreadSortDirection,
  ): StorageCachedTool[] {
    return tools.sort((a, b) => {
      const aValue = new Date(a[field]).getTime();
      const bValue = new Date(b[field]).getTime();

      return direction === 'ASC' ? aValue - bValue : bValue - aValue;
    });
  }
}
