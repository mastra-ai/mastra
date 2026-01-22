import type {
  StorageIntegrationConfig,
  StorageCachedTool,
  StorageCreateIntegrationInput,
  StorageUpdateIntegrationInput,
  StorageListIntegrationsInput,
  StorageListIntegrationsOutput,
  StorageListCachedToolsInput,
  StorageListCachedToolsOutput,
  StorageOrderBy,
  ThreadOrderBy,
  ThreadSortDirection,
} from '../../types';
import { StorageDomain } from '../base';

// ============================================================================
// Constants for validation
// ============================================================================

const INTEGRATION_ORDER_BY_SET: Record<ThreadOrderBy, true> = {
  createdAt: true,
  updatedAt: true,
};

const INTEGRATION_SORT_DIRECTION_SET: Record<ThreadSortDirection, true> = {
  ASC: true,
  DESC: true,
};

const CACHED_TOOL_ORDER_BY_SET: Record<'cachedAt' | 'updatedAt', true> = {
  cachedAt: true,
  updatedAt: true,
};

// ============================================================================
// IntegrationsStorage Base Class
// ============================================================================

/**
 * Abstract base class for integration storage operations.
 * Manages storage for integration configurations and cached tool definitions.
 */
export abstract class IntegrationsStorage extends StorageDomain {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'INTEGRATIONS',
    });
  }

  // ==========================================================================
  // Integration CRUD Methods
  // ==========================================================================

  /**
   * Creates a new integration configuration.
   * @param integration - The integration data to create
   * @returns The created integration with timestamps
   */
  abstract createIntegration({
    integration,
  }: {
    integration: StorageCreateIntegrationInput;
  }): Promise<StorageIntegrationConfig>;

  /**
   * Retrieves an integration by its unique identifier.
   * @param id - The unique identifier of the integration
   * @returns The integration if found, null otherwise
   */
  abstract getIntegrationById({ id }: { id: string }): Promise<StorageIntegrationConfig | null>;

  /**
   * Updates an existing integration configuration.
   * @param id - The unique identifier of the integration to update
   * @param updates - The fields to update
   * @returns The updated integration
   */
  abstract updateIntegration({ id, ...updates }: StorageUpdateIntegrationInput): Promise<StorageIntegrationConfig>;

  /**
   * Deletes an integration from storage.
   * This should also delete all cached tools associated with this integration.
   * @param id - The unique identifier of the integration to delete
   */
  abstract deleteIntegration({ id }: { id: string }): Promise<void>;

  /**
   * Lists all integrations with optional pagination and filtering.
   * @param args - Pagination, ordering, and filtering options
   * @returns Paginated list of integrations
   */
  abstract listIntegrations(args?: StorageListIntegrationsInput): Promise<StorageListIntegrationsOutput>;

  // ==========================================================================
  // Cached Tool Methods
  // ==========================================================================

  /**
   * Caches a single tool definition from an integration provider.
   * @param tool - The tool data to cache
   * @returns The cached tool with timestamp
   */
  abstract cacheTool({ tool }: { tool: Omit<StorageCachedTool, 'cachedAt' | 'updatedAt'> }): Promise<StorageCachedTool>;

  /**
   * Caches multiple tool definitions at once.
   * This is more efficient than calling cacheTool repeatedly.
   * @param tools - Array of tool data to cache
   * @returns Array of cached tools with timestamps
   */
  abstract cacheTools({
    tools,
  }: {
    tools: Omit<StorageCachedTool, 'cachedAt' | 'updatedAt'>[];
  }): Promise<StorageCachedTool[]>;

  /**
   * Retrieves a cached tool by its unique identifier.
   * @param id - The unique identifier of the cached tool
   * @returns The cached tool if found, null otherwise
   */
  abstract getCachedTool({ id }: { id: string }): Promise<StorageCachedTool | null>;

  /**
   * Retrieves a cached tool by integration ID and tool slug.
   * @param integrationId - The integration ID
   * @param toolSlug - The tool slug from the provider
   * @returns The cached tool if found, null otherwise
   */
  abstract getCachedToolBySlug({
    integrationId,
    toolSlug,
  }: {
    integrationId: string;
    toolSlug: string;
  }): Promise<StorageCachedTool | null>;

  /**
   * Lists cached tools with optional filtering and pagination.
   * @param args - Filtering, pagination, and ordering options
   * @returns Paginated list of cached tools
   */
  abstract listCachedTools(args?: StorageListCachedToolsInput): Promise<StorageListCachedToolsOutput>;

  /**
   * Deletes all cached tools for a specific integration.
   * This is typically called when an integration is deleted or refreshed.
   * @param integrationId - The integration ID
   */
  abstract deleteCachedToolsByIntegration({ integrationId }: { integrationId: string }): Promise<void>;

  /**
   * Deletes a single cached tool by its unique identifier.
   * @param id - The unique identifier of the cached tool to delete
   */
  abstract deleteCachedTool({ id }: { id: string }): Promise<void>;

  /**
   * Updates the cached timestamp for tools belonging to an integration.
   * This can be used to track when tools were last synced.
   * @param integrationId - The integration ID
   */
  abstract updateCachedToolsTimestamp({ integrationId }: { integrationId: string }): Promise<void>;

  // ==========================================================================
  // Protected Helper Methods
  // ==========================================================================

  /**
   * Parses orderBy input for consistent integration sorting behavior.
   */
  protected parseOrderBy(
    orderBy?: StorageOrderBy,
    defaultDirection: ThreadSortDirection = 'DESC',
  ): { field: ThreadOrderBy; direction: ThreadSortDirection } {
    return {
      field: orderBy?.field && orderBy.field in INTEGRATION_ORDER_BY_SET ? orderBy.field : 'createdAt',
      direction:
        orderBy?.direction && orderBy.direction in INTEGRATION_SORT_DIRECTION_SET
          ? orderBy.direction
          : defaultDirection,
    };
  }

  /**
   * Parses orderBy input for consistent cached tool sorting behavior.
   */
  protected parseCachedToolOrderBy(
    orderBy?: StorageListCachedToolsInput['orderBy'],
    defaultDirection: ThreadSortDirection = 'DESC',
  ): { field: 'cachedAt' | 'updatedAt'; direction: ThreadSortDirection } {
    return {
      field: orderBy?.field && orderBy.field in CACHED_TOOL_ORDER_BY_SET ? orderBy.field : 'cachedAt',
      direction:
        orderBy?.direction && orderBy.direction in INTEGRATION_SORT_DIRECTION_SET
          ? orderBy.direction
          : defaultDirection,
    };
  }
}
