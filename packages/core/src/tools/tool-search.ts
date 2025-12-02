import { embed } from '@internal/ai-sdk-v4';
import { embed as embedV2 } from 'ai-v5';
import { z } from 'zod';

import type { MastraEmbeddingModel } from '../vector';

import type { Tool } from './tool';
import { createTool } from './tool';
import type { ToolAction, ToolExecutionContext } from './types';

/**
 * Represents a tool with its computed embedding for search
 */
interface IndexedTool {
  id: string;
  description: string;
  embedding: number[];
  tool: ToolAction<any, any, any>;
}

/**
 * Result from a tool search operation
 */
export interface ToolSearchResult {
  /** The tool ID */
  id: string;
  /** The tool description */
  description: string;
  /** Similarity score (0-1, higher is more similar) */
  score: number;
  /** The original tool */
  tool: ToolAction<any, any, any>;
}

/**
 * Options for the tool search operation
 */
export interface ToolSearchOptions {
  /** Maximum number of tools to return */
  topK?: number;
  /** Minimum similarity score threshold (0-1) */
  minScore?: number;
}

/**
 * Computes cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

/**
 * Default function to generate search text from a tool
 */
function defaultGetSearchText(tool: ToolAction<any, any, any>, id: string): string {
  const parts = [id, tool.description];

  // Include input schema field names if available
  if (tool.inputSchema) {
    try {
      const shape = (tool.inputSchema as any)._def?.shape?.();
      if (shape) {
        parts.push(`Parameters: ${Object.keys(shape).join(', ')}`);
      }
    } catch {
      // Ignore schema parsing errors
    }
  }

  return parts.filter(Boolean).join('. ');
}

// Global key for when no threadId is provided
const GLOBAL_THREAD_KEY = '__global__';

/**
 * Configuration for DeferredToolset
 */
export interface DeferredToolsetConfig {
  /** The embedding model to use for creating tool embeddings */
  embedder: MastraEmbeddingModel<string>;
  /** Optional: Custom function to generate search text from a tool */
  getSearchText?: (tool: ToolAction<any, any, any>, id: string) => string;
  /** Custom ID for the search tool (defaults to 'tool_search') */
  searchToolId?: string;
  /** Custom description for the search tool */
  searchToolDescription?: string;
  /** Maximum number of tools to return in search results (defaults to 5) */
  topK?: number;
  /** Minimum similarity score to load a tool (defaults to 0.3) */
  minScore?: number;
}

/**
 * Options for adding tools to a DeferredToolset
 */
export interface AddToolOptions {
  /**
   * Whether to defer loading this tool.
   * If not specified, uses the tool's `deferred` property.
   * If the tool doesn't have a `deferred` property, defaults to false.
   */
  deferLoading?: boolean;
}

/**
 * Schema for the tool search input
 */
const toolSearchInputSchema = z.object({
  query: z.string().describe('Natural language description of the capability or tool you need'),
});

/**
 * DeferredToolset manages tools with deferred loading, similar to Anthropic's Tool Search Tool.
 *
 * Tools marked with `deferred: true` are not loaded into the agent's context initially.
 * Instead, the agent gets a search tool that can discover and load relevant tools on-demand.
 * Once loaded, tools remain available for subsequent calls within the same thread/session.
 *
 * This approach:
 * - Reduces initial context size (fewer tokens)
 * - Improves tool selection accuracy (agent only sees relevant tools)
 * - Preserves prompt caching (deferred tools not in initial prompt)
 * - Scales to hundreds of tools efficiently
 *
 * @example
 * ```typescript
 * import { DeferredToolset, createTool } from '@mastra/core/tools';
 * import { openai } from '@ai-sdk/openai';
 *
 * // Define tools with deferred: true on the tool itself
 * const helpTool = createTool({
 *   id: 'help',
 *   description: 'Get help',
 *   execute: async () => ({ message: 'How can I help?' }),
 * });
 *
 * const createPRTool = createTool({
 *   id: 'github.createPR',
 *   description: 'Create a GitHub pull request',
 *   deferred: true, // This tool will be loaded on-demand
 *   inputSchema: z.object({ title: z.string(), body: z.string() }),
 *   execute: async ({ title, body }) => { ... },
 * });
 *
 * const sendMessageTool = createTool({
 *   id: 'slack.sendMessage',
 *   description: 'Send a Slack message',
 *   deferred: true, // This tool will be loaded on-demand
 *   inputSchema: z.object({ channel: z.string(), message: z.string() }),
 *   execute: async ({ channel, message }) => { ... },
 * });
 *
 * // Create toolset and add tools - deferred property is respected automatically
 * const toolset = new DeferredToolset({
 *   embedder: openai.embedding('text-embedding-3-small'),
 * });
 *
 * await toolset.addTools({
 *   help: helpTool,           // Not deferred - always loaded
 *   createPR: createPRTool,   // Deferred - loaded on-demand
 *   sendMessage: sendMessageTool, // Deferred - loaded on-demand
 * });
 *
 * // Use with an agent
 * const response = await agent.generate('Create a GitHub PR for this fix', {
 *   toolsets: {
 *     myTools: toolset.getTools(threadId),
 *   },
 * });
 *
 * // The agent will:
 * // 1. See only help + tool_search initially
 * // 2. Call tool_search with "github PR"
 * // 3. createPR gets loaded into context
 * // 4. Agent can now call createPR directly
 * ```
 */
export class DeferredToolset {
  private embedder: MastraEmbeddingModel<string>;
  private getSearchText: (tool: ToolAction<any, any, any>, id: string) => string;

  /** Always-loaded tools (deferLoading: false) */
  private alwaysLoadedTools: Map<string, ToolAction<any, any, any>> = new Map();

  /** Deferred tools with their embeddings */
  private deferredTools: Map<string, IndexedTool> = new Map();

  /** Loaded tool IDs per thread */
  private loadedToolsByThread: Map<string, Set<string>> = new Map();

  /** Search tool configuration */
  private searchToolId: string;
  private searchToolDescription: string;
  private topK: number;
  private minScore: number;

  /** The search tool instance */
  private _searchTool: Tool<typeof toolSearchInputSchema, any, any, any, any, string> | null = null;

  constructor(config: DeferredToolsetConfig) {
    this.embedder = config.embedder;
    this.getSearchText = config.getSearchText ?? defaultGetSearchText;
    this.searchToolId = config.searchToolId ?? 'tool_search';
    this.searchToolDescription =
      config.searchToolDescription ??
      'Search for available tools based on what you need to accomplish. Found tools will be loaded and available for use.';
    this.topK = config.topK ?? 5;
    this.minScore = config.minScore ?? 0.3;
  }

  /**
   * Embeds text using the configured embedding model
   */
  private async embed(text: string): Promise<number[]> {
    const isV2 = (this.embedder as any).specificationVersion === 'v2';

    if (isV2) {
      const result = await embedV2({
        model: this.embedder as any,
        value: text,
      });
      return result.embedding;
    } else {
      const result = await embed({
        model: this.embedder as any,
        value: text,
      });
      return result.embedding;
    }
  }

  /**
   * Adds a single tool to the toolset.
   *
   * @param id - The tool identifier
   * @param tool - The tool to add
   * @param options - Options including whether to defer loading. If not specified, uses the tool's `deferred` property.
   */
  async addTool(id: string, tool: ToolAction<any, any, any>, options: AddToolOptions = {}): Promise<void> {
    // Use explicit option if provided, otherwise fall back to tool's deferred property
    const shouldDefer = options.deferLoading ?? tool.deferred ?? false;

    if (shouldDefer) {
      const searchText = this.getSearchText(tool, id);
      const embedding = await this.embed(searchText);

      this.deferredTools.set(id, {
        id,
        description: tool.description,
        embedding,
        tool,
      });
    } else {
      this.alwaysLoadedTools.set(id, tool);
    }
  }

  /**
   * Adds multiple tools to the toolset, automatically respecting each tool's `deferred` property.
   *
   * @param tools - Record of tool ID to tool instance
   * @param options - Options including whether to defer loading. If not specified, uses each tool's `deferred` property.
   *
   * @example
   * ```typescript
   * // Tools with deferred: true are automatically deferred
   * await toolset.addTools({
   *   alwaysLoaded: createTool({ id: 'always', description: '...', execute: ... }),
   *   deferredTool: createTool({ id: 'deferred', description: '...', deferred: true, execute: ... }),
   * });
   *
   * // Or override for all tools
   * await toolset.addTools(tools, { deferLoading: true });
   * ```
   */
  async addTools(tools: Record<string, ToolAction<any, any, any>>, options: AddToolOptions = {}): Promise<void> {
    // If deferLoading is explicitly set, apply to all tools
    // Otherwise, respect each tool's individual deferred property
    const explicitDeferLoading = options.deferLoading;

    const entries = Object.entries(tools);

    // Separate tools into deferred and always-loaded based on their properties
    const deferredEntries: [string, ToolAction<any, any, any>][] = [];
    const alwaysLoadedEntries: [string, ToolAction<any, any, any>][] = [];

    for (const [id, tool] of entries) {
      const shouldDefer = explicitDeferLoading ?? tool.deferred ?? false;
      if (shouldDefer) {
        deferredEntries.push([id, tool]);
      } else {
        alwaysLoadedEntries.push([id, tool]);
      }
    }

    // Add always-loaded tools immediately
    for (const [id, tool] of alwaysLoadedEntries) {
      this.alwaysLoadedTools.set(id, tool);
    }

    // Create embeddings for deferred tools in parallel
    if (deferredEntries.length > 0) {
      const embeddings = await Promise.all(
        deferredEntries.map(async ([id, tool]) => {
          const searchText = this.getSearchText(tool, id);
          const embedding = await this.embed(searchText);
          return { id, embedding };
        }),
      );

      for (let i = 0; i < deferredEntries.length; i++) {
        const [id, tool] = deferredEntries[i]!;
        const { embedding } = embeddings[i]!;

        this.deferredTools.set(id, {
          id,
          description: tool.description,
          embedding,
          tool,
        });
      }
    }
  }

  /**
   * Searches for tools matching the query.
   *
   * @param query - Natural language query
   * @param options - Search options
   * @returns Matching tools sorted by relevance
   */
  async search(query: string, options: ToolSearchOptions = {}): Promise<ToolSearchResult[]> {
    const { topK = this.topK, minScore = this.minScore } = options;

    if (this.deferredTools.size === 0) {
      return [];
    }

    const queryEmbedding = await this.embed(query);
    const results: ToolSearchResult[] = [];

    for (const indexed of this.deferredTools.values()) {
      const score = cosineSimilarity(queryEmbedding, indexed.embedding);

      if (score >= minScore) {
        results.push({
          id: indexed.id,
          description: indexed.description,
          score,
          tool: indexed.tool,
        });
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  /**
   * Loads a deferred tool for a specific thread, making it available in subsequent calls.
   *
   * @param toolId - The tool ID to load
   * @param threadId - Optional thread ID (uses global scope if not provided)
   * @returns true if the tool was loaded, false if it doesn't exist or is already loaded
   */
  loadTool(toolId: string, threadId?: string): boolean {
    if (!this.deferredTools.has(toolId)) {
      return false;
    }

    const key = threadId ?? GLOBAL_THREAD_KEY;
    let loaded = this.loadedToolsByThread.get(key);

    if (!loaded) {
      loaded = new Set();
      this.loadedToolsByThread.set(key, loaded);
    }

    loaded.add(toolId);
    return true;
  }

  /**
   * Loads multiple deferred tools for a specific thread.
   *
   * @param toolIds - Array of tool IDs to load
   * @param threadId - Optional thread ID
   * @returns Number of tools successfully loaded
   */
  loadTools(toolIds: string[], threadId?: string): number {
    let count = 0;
    for (const toolId of toolIds) {
      if (this.loadTool(toolId, threadId)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Unloads a tool from a thread's context.
   *
   * @param toolId - The tool ID to unload
   * @param threadId - Optional thread ID
   */
  unloadTool(toolId: string, threadId?: string): boolean {
    const key = threadId ?? GLOBAL_THREAD_KEY;
    const loaded = this.loadedToolsByThread.get(key);
    return loaded?.delete(toolId) ?? false;
  }

  /**
   * Unloads all tools for a specific thread.
   *
   * @param threadId - Optional thread ID
   */
  unloadAllTools(threadId?: string): void {
    const key = threadId ?? GLOBAL_THREAD_KEY;
    this.loadedToolsByThread.delete(key);
  }

  /**
   * Gets the list of currently loaded tool IDs for a thread.
   *
   * @param threadId - Optional thread ID
   */
  getLoadedToolIds(threadId?: string): string[] {
    const key = threadId ?? GLOBAL_THREAD_KEY;
    const loaded = this.loadedToolsByThread.get(key);
    return loaded ? Array.from(loaded) : [];
  }

  /**
   * Gets all deferred tool IDs.
   */
  getDeferredToolIds(): string[] {
    return Array.from(this.deferredTools.keys());
  }

  /**
   * Gets all always-loaded tool IDs.
   */
  getAlwaysLoadedToolIds(): string[] {
    return Array.from(this.alwaysLoadedTools.keys());
  }

  /**
   * Checks if a tool exists (in either always-loaded or deferred).
   */
  hasTool(toolId: string): boolean {
    return this.alwaysLoadedTools.has(toolId) || this.deferredTools.has(toolId);
  }

  /**
   * Gets a tool by ID (from either always-loaded or deferred).
   */
  getTool(toolId: string): ToolAction<any, any, any> | undefined {
    return this.alwaysLoadedTools.get(toolId) ?? this.deferredTools.get(toolId)?.tool;
  }

  /**
   * Creates the search tool that agents use to discover and load deferred tools.
   */
  private createSearchTool(threadId?: string): Tool<typeof toolSearchInputSchema, any, any, any, any, string> {
    const toolset = this;

    return createTool({
      id: this.searchToolId,
      description: this.searchToolDescription,
      inputSchema: toolSearchInputSchema,
      execute: async (inputData: z.infer<typeof toolSearchInputSchema>, _context?: ToolExecutionContext) => {
        const { query } = inputData;

        // Search for matching tools
        const results = await toolset.search(query, {
          topK: toolset.topK,
          minScore: toolset.minScore,
        });

        if (results.length === 0) {
          return {
            success: false,
            loadedTools: [],
            message: 'No matching tools found for your query.',
            suggestion: `Available deferred tools: ${toolset.getDeferredToolIds().join(', ')}`,
            query,
          };
        }

        // Load matching tools into the thread's context
        const loadedToolIds: string[] = [];
        for (const result of results) {
          toolset.loadTool(result.id, threadId);
          loadedToolIds.push(result.id);
        }

        return {
          success: true,
          loadedTools: results.map(r => ({
            id: r.id,
            description: r.description,
            score: r.score,
            // Include input schema info for the agent
            inputSchema: (() => {
              try {
                const shape = (r.tool.inputSchema as any)?._def?.shape?.();
                return shape ? { fields: Object.keys(shape) } : undefined;
              } catch {
                return undefined;
              }
            })(),
          })),
          message: `Loaded ${loadedToolIds.length} tool(s). You can now call them directly.`,
          query,
        };
      },
    });
  }

  /**
   * The search tool instance (for reference/direct use).
   * Note: Use getTools() to get all available tools including the search tool.
   */
  get searchTool(): Tool<typeof toolSearchInputSchema, any, any, any, any, string> {
    if (!this._searchTool) {
      this._searchTool = this.createSearchTool();
    }
    return this._searchTool;
  }

  /**
   * Gets the tools that should be available to an agent for a specific thread.
   *
   * Returns:
   * - All always-loaded tools
   * - The search tool (for discovering more tools)
   * - Any deferred tools that have been loaded for this thread
   *
   * @param threadId - Optional thread ID for thread-specific loaded tools
   * @returns A ToolsInput object that can be used with agent.generate() or agent.stream()
   *
   * @example
   * ```typescript
   * // Use as a toolset with an agent
   * const response = await agent.generate('Create a GitHub PR', {
   *   toolsets: {
   *     myTools: toolset.getTools(threadId),
   *   },
   * });
   * ```
   */
  getTools(threadId?: string): Record<string, ToolAction<any, any, any>> {
    const tools: Record<string, ToolAction<any, any, any>> = {};

    // Add always-loaded tools
    for (const [id, tool] of this.alwaysLoadedTools) {
      tools[id] = tool;
    }

    // Add the search tool (creates a new one bound to this threadId)
    tools[this.searchToolId] = this.createSearchTool(threadId);

    // Add loaded deferred tools for this thread
    const key = threadId ?? GLOBAL_THREAD_KEY;
    const loadedIds = this.loadedToolsByThread.get(key);

    if (loadedIds) {
      for (const toolId of loadedIds) {
        const indexed = this.deferredTools.get(toolId);
        if (indexed) {
          tools[toolId] = indexed.tool;
        }
      }
    }

    return tools;
  }

  /**
   * Gets statistics about the toolset.
   */
  getStats(): {
    alwaysLoadedCount: number;
    deferredCount: number;
    loadedByThread: Record<string, number>;
  } {
    const loadedByThread: Record<string, number> = {};

    for (const [threadId, loaded] of this.loadedToolsByThread) {
      loadedByThread[threadId] = loaded.size;
    }

    return {
      alwaysLoadedCount: this.alwaysLoadedTools.size,
      deferredCount: this.deferredTools.size,
      loadedByThread,
    };
  }
}
