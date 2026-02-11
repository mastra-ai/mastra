import type { StorageToolConfig } from '../storage/types';
import type { ToolAction } from '../tools/types';

/**
 * Metadata about a tool provider.
 */
export interface ToolProviderInfo {
  /** Unique identifier for this provider (e.g., 'composio') */
  id: string;
  /** Human-readable name */
  name: string;
  /** Short description of the provider */
  description?: string;
}

/**
 * A toolkit (group of related tools) from a tool provider.
 */
export interface ToolProviderToolkit {
  /** Unique slug for this toolkit (e.g., 'GITHUB', 'SLACK') */
  slug: string;
  /** Human-readable name */
  name: string;
  /** Description of the toolkit */
  description?: string;
  /** Icon URL or identifier */
  icon?: string;
}

/**
 * A tool listing entry from a tool provider.
 * Used for UI discovery — does not include the full executable tool.
 */
export interface ToolProviderToolInfo {
  /** Unique slug for this tool (e.g., 'GITHUB_CREATE_ISSUE') */
  slug: string;
  /** Human-readable name */
  name: string;
  /** Description of what this tool does */
  description?: string;
  /** Toolkit this tool belongs to */
  toolkit?: string;
}

/**
 * Options for listing tools from a provider.
 */
export interface ListToolProviderToolsOptions {
  /** Filter by toolkit slug */
  toolkit?: string;
  /** Search query for filtering tools */
  search?: string;
  /** Pagination cursor or page */
  page?: number;
  /** Number of tools per page */
  perPage?: number;
}

/**
 * Paginated result from tool provider list operations.
 */
export interface ToolProviderListResult<T> {
  data: T[];
  pagination?: {
    total?: number;
    page?: number;
    perPage?: number;
    hasMore: boolean;
  };
}

/**
 * Options for resolving executable tools at agent runtime.
 */
export interface ResolveToolProviderToolsOptions {
  /** User ID for user-scoped tool execution (e.g., Composio) */
  userId?: string;
  /** Per-request context (e.g., user-specific API keys, tenant IDs) */
  requestContext?: Record<string, unknown>;
  /** Additional provider-specific options */
  [key: string]: unknown;
}

/**
 * Interface for tool providers (e.g., Composio) that supply tools to agents.
 *
 * Tool providers serve two purposes:
 * 1. **Discovery** — UI uses `listToolkits()`, `listTools()`, `getToolSchema()` to browse available tools
 * 2. **Runtime** — Agent hydration uses `resolveTools()` to get executable tools for selected tool slugs
 */
export interface ToolProvider {
  /** Provider metadata */
  readonly info: ToolProviderInfo;

  /**
   * List available toolkits from this provider.
   * Used by UI for browsing.
   */
  listToolkits?(): Promise<ToolProviderListResult<ToolProviderToolkit>>;

  /**
   * List available tools, optionally filtered by toolkit or search query.
   * Used by UI for browsing/selecting tools.
   */
  listTools(options?: ListToolProviderToolsOptions): Promise<ToolProviderListResult<ToolProviderToolInfo>>;

  /**
   * Get the JSON schema for a specific tool's input.
   * Used by UI to display tool details.
   */
  getToolSchema?(toolSlug: string): Promise<Record<string, unknown> | null>;

  /**
   * Resolve executable tools for the given slugs.
   * Called during agent hydration to resolve `integrationTools` references.
   *
   * @param toolSlugs - Array of tool slugs to resolve
   * @param toolConfigs - Per-tool configuration (description overrides)
   * @param options - Provider-specific options (userId, requestContext, etc.)
   * @returns Record of tool ID to executable tool
   */
  resolveTools(
    toolSlugs: string[],
    toolConfigs?: Record<string, StorageToolConfig>,
    options?: ResolveToolProviderToolsOptions,
  ): Promise<Record<string, ToolAction<any, any, any>>>;
}
