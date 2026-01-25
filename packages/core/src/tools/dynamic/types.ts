import type { Tool, ToolExecutionContext } from '../';

/**
 * A Tool type that accepts any generic parameters.
 * This allows mixing tools with different input/output schemas.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyTool = Tool<any, any, any, any, any, any>;

/**
 * Result returned from a tool search query
 */
export interface ToolSearchResult {
  /** Tool identifier */
  name: string;
  /** Brief description of what the tool does */
  description: string;
  /** Search relevance score (higher = more relevant) */
  score: number;
}

/**
 * Entry stored in the tool registry
 */
export interface ToolRegistryEntry {
  /** The actual tool instance */
  tool: AnyTool;
  /** Tool identifier */
  name: string;
  /** Tool description */
  description: string;
  /** Tokenized search text (name + description) for BM25 matching */
  tokens: string[];
}

/**
 * Configuration options for the dynamic tool set
 */
export interface DynamicToolSetConfig {
  /**
   * Tools that should be searchable but not loaded by default.
   * Can be a record of tools or an array of tools.
   */
  tools: Record<string, AnyTool> | AnyTool[];

  /**
   * Search configuration options
   */
  search?: {
    /**
     * Number of results to return from search queries.
     * @default 5
     */
    topK?: number;

    /**
     * Minimum score threshold for search results.
     * Results below this score will be filtered out.
     * @default 0
     */
    minScore?: number;
  };

  /**
   * Custom name for the search tool.
   * @default 'search_tools'
   */
  searchToolName?: string;

  /**
   * Custom name for the load tool.
   * @default 'load_tool'
   */
  loadToolName?: string;

  /**
   * Custom description for the search tool.
   */
  searchToolDescription?: string;

  /**
   * Custom description for the load tool.
   */
  loadToolDescription?: string;
}

/**
 * State manager interface for tracking loaded tools
 */
export interface LoadedToolsState {
  /**
   * Get the list of currently loaded tool names
   */
  getLoadedToolNames(context: ToolExecutionContext): Promise<string[]>;

  /**
   * Add a tool to the loaded set
   */
  addLoadedTool(context: ToolExecutionContext, toolName: string): Promise<void>;

  /**
   * Check if a tool is already loaded
   */
  isToolLoaded(context: ToolExecutionContext, toolName: string): Promise<boolean>;
}

/**
 * Return type from createDynamicToolSet
 */
export interface DynamicToolSet {
  /**
   * Tool that searches for available tools by keyword.
   * Add this to your agent's tools.
   */
  searchTool: AnyTool;

  /**
   * Tool that loads a specific tool into context.
   * Add this to your agent's tools.
   */
  loadTool: AnyTool;

  /**
   * Get the tools that have been loaded during the current conversation.
   * Use this to pass loaded tools to the agent via toolsets.
   *
   * @param context - Tool execution context (or just threadId)
   * @returns Record of loaded tools
   */
  getLoadedTools(context: ToolExecutionContext | { threadId?: string }): Promise<Record<string, AnyTool>>;

  /**
   * The underlying tool registry for advanced use cases.
   */
  registry: ToolRegistry;
}

/**
 * Interface for the tool registry
 */
export interface ToolRegistry {
  /**
   * Register a tool in the registry
   */
  register(tool: AnyTool): void;

  /**
   * Search for tools matching the query
   */
  search(query: string, topK?: number, minScore?: number): ToolSearchResult[];

  /**
   * Get a tool by name
   */
  get(name: string): AnyTool | undefined;

  /**
   * Get all registered tool names
   */
  getToolNames(): string[];

  /**
   * Get the count of registered tools
   */
  size(): number;
}
