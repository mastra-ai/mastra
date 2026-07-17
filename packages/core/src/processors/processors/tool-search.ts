import { z } from 'zod/v4';
import { MASTRA_THREAD_ID_KEY } from '../../request-context';
import type { RequestContext } from '../../request-context';
import { createTool } from '../../tools';
import type { Tool } from '../../tools';
import { BM25Index } from '../../workspace/search/bm25';
import type { BM25SearchResult, TokenizeOptions } from '../../workspace/search/bm25';
import type { ProcessInputStepArgs, Processor } from '../index';
import type { LoadedToolStore, LoadedToolStoreContext } from './tool-search-stores';
import { LegacyMapLoadedToolStore, ContextLoadedToolStore } from './tool-search-stores';

export type ToolSearchFilterPhase = 'search' | 'load' | 'active';

export type ToolSearchFilterArgs = {
  /** The resolved tool id. */
  toolName: string;
  tool: Tool<any, any>;
  requestContext?: RequestContext;
  phase: ToolSearchFilterPhase;
};

/**
 * Configuration options for ToolSearchProcessor
 */
export interface ToolSearchProcessorOptions {
  /**
   * All tools that can be searched and loaded dynamically.
   * These tools are not immediately available - they must be discovered via search and loaded on demand.
   */
  tools: Record<string, Tool<any, any>>;

  /**
   * Configuration for the search behavior
   */
  search?: {
    /**
     * Maximum number of tools to return in search results
     * @default 5
     */
    topK?: number;

    /**
     * Minimum relevance score (0-1) for including a tool in search results
     * @default 0
     */
    minScore?: number;

    /**
     * When true, tools returned by `search_tools` are activated immediately as a
     * side effect of the search — there is no separate `load_tool` step and the
     * `load_tool` meta-tool is not exposed. The discovered tools become available
     * on the model's next turn.
     *
     * This collapses the two-turn `search -> load -> use` flow into a single
     * `search -> use` flow, mirroring native provider tool-search features that
     * auto-expand the discovered tool references. Discovery stays model-driven;
     * only the explicit load decision is removed.
     *
     * Because every match is activated, keep `topK` conservative in this mode.
     * @default false
     */
    autoLoad?: boolean;
  };

  /**
   * Where loaded-tool state lives. The `'context'` store is opt-in.
   *
   * - `'in-memory'` (default): the original behavior — loaded state lives in an
   *   in-memory `Map<threadId, Set>` with TTL cleanup (see `ttl`). Lost on restart;
   *   anonymous requests share a `'default'` entry.
   * - `'context'`: derived from the conversation messages. A tool is loaded iff a
   *   prior `search_tools`/`load_tool` result naming it is still present in the
   *   conversation. Restart-safe, requires no memory, and de-loads automatically
   *   when the result block is no longer present in the messages — parity with
   *   native provider tool-search.
   *
   * @default 'in-memory'
   */
  storage?: 'in-memory' | 'context';

  /**
   * Time-to-live for in-memory thread state, in milliseconds. Only applies to the
   * default `storage: 'in-memory'` store. After this duration of inactivity, thread
   * state is eligible for cleanup. Set to 0 to disable cleanup.
   *
   * Ignored for `storage: 'context'`.
   *
   * @default 3600000 (1 hour)
   */
  ttl?: number;

  /**
   * Optional request-aware hook for filtering tools during search, load, and active tool injection.
   * Return false to hide or block a tool for the current request.
   */
  filter?: (args: ToolSearchFilterArgs) => boolean | Promise<boolean>;

  /**
   * When true, per-request tools in `args.tools` (e.g. MCP) are searchable via the meta-tools
   * and omitted from the prompt until loaded.
   *
   * @default false
   */
  includeResolvedTools?: boolean;
}

/**
 * Search result with ranking score
 */
interface SearchResult {
  name: string;
  description: string;
  score: number;
}

/**
 * Tokenization options tuned for tool names and descriptions.
 * Splits on underscores, hyphens, and punctuation (common in tool IDs).
 * No stopwords filtering since tool descriptions are short.
 */
const TOOL_SEARCH_TOKENIZE_OPTIONS: TokenizeOptions = {
  lowercase: true,
  removePunctuation: false,
  minLength: 2,
  stopwords: new Set(),
  splitPattern: /[\s\-_.,;:!?()[\]{}'"]+/,
};

const TOOL_SEARCH_META_TOOL_IDS = new Set(['search_tools', 'load_tool']);

/**
 * Processor that enables dynamic tool discovery and loading.
 *
 * Instead of providing all tools to the agent upfront, this processor:
 * 1. Gives the agent two meta-tools: search_tools and load_tool
 * 2. Agent searches for relevant tools using keywords
 * 3. Agent loads specific tools into the conversation on demand
 * 4. Loaded tools become immediately available for use
 *
 * This pattern dramatically reduces context usage when working with many tools (100+).
 *
 * @example
 * ```typescript
 * const toolSearch = new ToolSearchProcessor({
 *   tools: {
 *     createIssue: githubTools.createIssue,
 *     sendEmail: emailTools.send,
 *     // ... 100+ tools
 *   },
 *   search: { topK: 5, minScore: 0 },
 *   ttl: 3600000, // 1 hour (default)
 * });
 *
 * const agent = new Agent({
 *   name: 'my-agent',
 *   inputProcessors: [toolSearch],
 *   tools: {}, // Always-available tools (if any)
 * });
 * ```
 */
export class ToolSearchProcessor implements Processor<'tool-search'> {
  readonly id = 'tool-search';
  readonly name = 'Tool Search Processor';
  readonly description = 'Enables dynamic tool discovery and loading via search';

  private allTools: Record<string, Tool<any, any>>;
  private includeResolvedTools: boolean;
  private searchConfig: Required<NonNullable<ToolSearchProcessorOptions['search']>>;
  private filter?: ToolSearchProcessorOptions['filter'];
  private indexedToolIds = new Set<string>();

  /** Pluggable backend for loaded-tool state. */
  private store: LoadedToolStore;

  /** BM25 index for constructor-time tools only (immutable per processor instance) */
  private bm25Index: BM25Index;
  /** Map from constructor tool ID to full description (for result formatting) */
  private toolDescriptions = new Map<string, string>();

  constructor(options: ToolSearchProcessorOptions) {
    this.allTools = options.tools;
    this.includeResolvedTools = options.includeResolvedTools ?? false;
    this.filter = options.filter;
    this.searchConfig = {
      topK: options.search?.topK ?? 5,
      minScore: options.search?.minScore ?? 0,
      autoLoad: options.search?.autoLoad ?? false,
    };

    const storage = options.storage ?? 'in-memory';

    this.store =
      storage === 'context' ? new ContextLoadedToolStore() : new LegacyMapLoadedToolStore({ ttl: options.ttl });

    // Create BM25 index with tool-search-specific tokenization
    this.bm25Index = new BM25Index({}, TOOL_SEARCH_TOKENIZE_OPTIONS);

    // Index all tools
    this.indexTools();
  }

  /**
   * Get the thread ID from the request context, or undefined when no thread is active.
   * Both stores tolerate an undefined thread ID.
   */
  private getThreadId(args: ProcessInputStepArgs): string | undefined {
    return (args.requestContext?.get(MASTRA_THREAD_ID_KEY) as string | undefined) || undefined;
  }

  private makeStoreContext(args: ProcessInputStepArgs): LoadedToolStoreContext {
    return { threadId: this.getThreadId(args), args };
  }

  private isTool(value: unknown): value is Tool<any, any> {
    return typeof value === 'object' && value !== null && 'id' in value && typeof (value as Tool).id === 'string';
  }

  private extractResolvedTools(tools?: Record<string, unknown>): Record<string, Tool<any, any>> {
    if (!tools) return {};

    const resolved: Record<string, Tool<any, any>> = {};
    for (const [key, tool] of Object.entries(tools)) {
      if (!this.isTool(tool)) continue;
      if (TOOL_SEARCH_META_TOOL_IDS.has(key) || TOOL_SEARCH_META_TOOL_IDS.has(tool.id)) {
        continue;
      }
      resolved[key] = tool;
    }
    return resolved;
  }

  private buildSearchableTools(resolvedTools: Record<string, Tool<any, any>>): Record<string, Tool<any, any>> {
    return { ...this.allTools, ...resolvedTools };
  }

  private findToolById(toolId: string, searchableTools: Record<string, Tool<any, any>>): Tool<any, any> | undefined {
    return Object.values(searchableTools).find(tool => tool.id === toolId);
  }

  private findToolForDynamicName(
    toolName: string,
    searchableTools: Record<string, Tool<any, any>>,
  ): Tool<any, any> | undefined {
    const toolByKey = searchableTools[toolName];
    const toolById = this.findToolById(toolName, searchableTools);
    return this.filter ? (toolById ?? toolByKey) : (toolByKey ?? toolById);
  }

  private async isToolAllowed(
    tool: Tool<any, any>,
    requestContext: RequestContext | undefined,
    phase: ToolSearchFilterPhase,
  ): Promise<boolean> {
    if (!this.filter) {
      return true;
    }

    try {
      return await this.filter({ toolName: tool.id, tool, requestContext, phase });
    } catch {
      return false;
    }
  }

  private async getSuggestedToolNames(
    toolName: string,
    searchableTools: Record<string, Tool<any, any>>,
    requestContext?: RequestContext,
  ): Promise<string[]> {
    const matchesToolName = (name: string) =>
      name.toLowerCase().includes(toolName.toLowerCase()) || toolName.toLowerCase().includes(name.toLowerCase());

    if (!this.filter) {
      return Object.keys(searchableTools).filter(matchesToolName);
    }

    const allowedNames: string[] = [];

    for (const name of Object.keys(searchableTools)) {
      if (!matchesToolName(name)) continue;

      const tool = this.findToolForDynamicName(name, searchableTools);
      if (!tool) continue;

      const isAllowed = await this.isToolAllowed(tool, requestContext, 'load');
      if (isAllowed) {
        allowedNames.push(name);
        if (allowedNames.length >= 3) break;
      }
    }

    return allowedNames;
  }

  /**
   * Get loaded tools as Tool objects for the given loaded names.
   * Loaded names are resolved by the configured store.
   */
  private async getLoadedTools(
    loadedNames: Set<string>,
    searchableTools: Record<string, Tool<any, any>>,
    requestContext?: RequestContext,
  ): Promise<Record<string, Tool<any, any>>> {
    const loadedTools: Record<string, Tool<any, any>> = {};

    for (const toolName of loadedNames) {
      const tool = this.findToolForDynamicName(toolName, searchableTools);
      if (tool) {
        const isAllowed = await this.isToolAllowed(tool, requestContext, 'active');
        if (isAllowed) {
          loadedTools[toolName] = tool;
        }
      }
    }

    return loadedTools;
  }

  /**
   * Get loaded tools for the given request context.
   * Used by agent resume paths to rebuild tool executors after approval suspension.
   *
   * Resolution:
   * - If `stepArgs` are supplied, resolve through the store with the live messages.
   * - Otherwise (resume path) resolve from the store using the thread ID derived
   *   from the request context. The context store falls back to its same-process
   *   supplemental set.
   */
  public async getLoadedToolsForRequestContext(args?: {
    requestContext?: RequestContext;
    stepArgs?: ProcessInputStepArgs;
  }): Promise<Record<string, Tool<any, any>>> {
    const resolvedTools =
      this.includeResolvedTools && args?.stepArgs?.tools ? this.extractResolvedTools(args.stepArgs.tools) : {};
    const searchableTools = this.buildSearchableTools(resolvedTools);

    if (args?.stepArgs) {
      const loadedNames = await this.store.getLoadedNames(this.makeStoreContext(args.stepArgs));
      // Fall back to the step's own request context so active-phase filtering still
      // runs when the caller only supplies stepArgs.
      return this.getLoadedTools(loadedNames, searchableTools, args.requestContext ?? args.stepArgs.requestContext);
    }

    const threadId = (args?.requestContext?.get(MASTRA_THREAD_ID_KEY) as string | undefined) || undefined;
    const loadedNames = await this.store.getLoadedNames({ threadId, args: undefined });
    return this.getLoadedTools(loadedNames, this.allTools, args?.requestContext);
  }

  /**
   * Clear loaded tools for a specific thread (useful for testing).
   *
   * Only affects the default `storage: 'in-memory'` store; a no-op for the
   * `'context'` store, where loaded state lives in the conversation messages.
   *
   * @param threadId - The thread ID to clear, or 'default' if not provided
   */
  public clearState(threadId: string = 'default'): void {
    if (this.store instanceof LegacyMapLoadedToolStore) this.store.clearState(threadId);
  }

  /**
   * Clear all thread state for this processor instance (useful for testing).
   *
   * Only affects the default `storage: 'in-memory'` store.
   */
  public clearAllState(): void {
    if (this.store instanceof LegacyMapLoadedToolStore) this.store.clearAllState();
  }

  /**
   * Get statistics about current in-memory thread state (useful for monitoring).
   *
   * Only meaningful for the default `storage: 'in-memory'` store; returns zero
   * counts for the `'context'` store.
   */
  public getStateStats(): { threadCount: number; oldestAccessTime: number | null } {
    return this.store instanceof LegacyMapLoadedToolStore
      ? this.store.getStateStats()
      : { threadCount: 0, oldestAccessTime: null };
  }

  /**
   * Manually trigger cleanup of stale in-memory state (useful for testing).
   *
   * Only affects the default `storage: 'in-memory'` store; returns 0 for the
   * `'context'` store.
   *
   * @returns Number of threads cleaned up
   */
  public cleanupNow(): number {
    return this.store instanceof LegacyMapLoadedToolStore ? this.store.cleanupStaleState() : 0;
  }

  private indexTool(tool: Tool<any, any>): void {
    const name = tool.id;
    if (this.indexedToolIds.has(name)) {
      return;
    }

    const description = tool.description || '';
    this.bm25Index.add(name, `${name} ${description}`);
    this.toolDescriptions.set(name, description);
    this.indexedToolIds.add(name);
  }

  /**
   * Index all tools into the BM25 index
   */
  private indexTools(): void {
    for (const tool of Object.values(this.allTools)) {
      this.indexTool(tool);
    }
  }

  private buildResolvedToolIndex(resolvedTools: Record<string, Tool<any, any>>): {
    index: BM25Index;
    descriptions: Map<string, string>;
  } {
    const index = new BM25Index({}, TOOL_SEARCH_TOKENIZE_OPTIONS);
    const descriptions = new Map<string, string>();

    for (const tool of Object.values(resolvedTools)) {
      const name = tool.id;
      const description = tool.description || '';
      index.add(name, `${name} ${description}`);
      descriptions.set(name, description);
    }

    return { index, descriptions };
  }

  private mergeBm25Results(...resultSets: BM25SearchResult[][]): BM25SearchResult[] {
    const byId = new Map<string, BM25SearchResult>();

    for (const results of resultSets) {
      for (const result of results) {
        const existing = byId.get(result.id);
        if (!existing || result.score > existing.score) {
          byId.set(result.id, result);
        }
      }
    }

    return Array.from(byId.values()).sort((a, b) => b.score - a.score);
  }

  /**
   * Search for tools matching the query using BM25 ranking
   * with name-match boosting.
   *
   * @param query - Search keywords
   * @returns Array of matching tools with scores, sorted by relevance
   */
  private async searchTools(
    query: string,
    searchableTools: Record<string, Tool<any, any>>,
    requestContext?: RequestContext,
    resolvedIndex?: { index: BM25Index; descriptions: Map<string, string> },
  ): Promise<SearchResult[]> {
    const resolvedSize = resolvedIndex?.index.size ?? 0;
    const totalSize = this.bm25Index.size + resolvedSize;
    if (totalSize === 0) return [];

    // Get BM25 results (request more than topK to allow for re-ranking after boosting).
    // When filtering is enabled, inspect every BM25 match so denied high-ranking tools
    // do not prevent lower-ranking allowed tools from filling the result set.
    const searchLimit = this.filter ? totalSize : this.searchConfig.topK * 2;
    const bm25Results = this.mergeBm25Results(
      this.bm25Index.search(query, searchLimit, 0),
      resolvedIndex ? resolvedIndex.index.search(query, searchLimit, 0) : [],
    ).slice(0, searchLimit);

    if (bm25Results.length === 0) return [];

    // Apply name-match boosting on top of BM25 scores
    const queryTokens = query
      .toLowerCase()
      .split(/[\s\-_.,;:!?()[\]{}'"]+/)
      .filter(t => t.length > 1);

    const boostedResults = bm25Results.map(result => {
      let score = result.score;
      const nameLower = result.id.toLowerCase();

      for (const term of queryTokens) {
        if (nameLower === term) {
          score += 5;
        } else if (nameLower.includes(term)) {
          score += 2;
        }
      }

      return { id: result.id, score };
    });

    const filteredResults: typeof boostedResults = [];
    for (const result of boostedResults.sort((a, b) => b.score - a.score)) {
      if (result.score <= this.searchConfig.minScore) continue;

      const tool = this.findToolById(result.id, searchableTools);
      if (!tool) continue;

      const isAllowed = await this.isToolAllowed(tool, requestContext, 'search');
      if (isAllowed) {
        filteredResults.push(result);
        if (filteredResults.length >= this.searchConfig.topK) break;
      }
    }

    // Apply topK and format results.
    return filteredResults.slice(0, this.searchConfig.topK).map(r => {
      const description = resolvedIndex?.descriptions.get(r.id) ?? this.toolDescriptions.get(r.id) ?? '';
      return {
        name: r.id,
        description: description.length > 150 ? description.slice(0, 147) + '...' : description,
        score: Math.round(r.score * 100) / 100,
      };
    });
  }

  async processInputStep(args: ProcessInputStepArgs) {
    const { tools, messageList } = args;
    const storeContext = this.makeStoreContext(args);
    const resolvedTools = this.includeResolvedTools ? this.extractResolvedTools(tools) : {};
    const resolvedIndex =
      this.includeResolvedTools && Object.keys(resolvedTools).length > 0
        ? this.buildResolvedToolIndex(resolvedTools)
        : undefined;
    const searchableTools = this.buildSearchableTools(resolvedTools);
    const passthroughTools = this.includeResolvedTools ? {} : (tools ?? {});

    // Snapshot of names already loaded as of this step. Newly activated tools are
    // recorded via the store and become available on the model's next turn.
    const loadedToolNames = await this.store.getLoadedNames(storeContext);

    const autoLoad = this.searchConfig.autoLoad;

    // Add system instruction about the meta-tools
    messageList.addSystem(
      autoLoad
        ? 'To discover available tools, call search_tools with a keyword query. ' +
            'Matching tools are loaded automatically and become available on your next turn — ' +
            'there is no separate load step. After searching, use the tool directly.'
        : 'To discover available tools, call search_tools with a keyword query. ' +
            'To add one or more tools to the conversation, call load_tool with a toolName or toolNames array. ' +
            'Tools must be loaded before they can be used.',
    );

    // Create the search tool with BM25 ranking
    const searchTool = createTool({
      id: 'search_tools',
      description: autoLoad
        ? 'Search for available tools by keyword. ' +
          "Use this when you need a capability you don't currently have. " +
          'Returns a list of matching tools, which are loaded automatically and ' +
          'become available on your next turn — no separate load step is required.'
        : 'Search for available tools by keyword. ' +
          "Use this when you need a capability you don't currently have. " +
          'Returns a list of matching tools with their names and descriptions. ' +
          'After finding a useful tool, use load_tool to make it available.',
      inputSchema: z.object({
        query: z.string().describe('Search keywords (e.g., "weather", "github issue", "database query")'),
      }),
      outputSchema: z.object({
        results: z.array(
          z.object({
            name: z.string(),
            description: z.string(),
            score: z.number(),
          }),
        ),
        message: z.string(),
      }),
      execute: async ({ query }) => {
        // Use BM25 search for relevance-ranked results
        const results = await this.searchTools(query, searchableTools, args.requestContext, resolvedIndex);

        if (results.length === 0) {
          return {
            results: [],
            message: `No tools found matching "${query}". Try different keywords.`,
          };
        }

        if (autoLoad) {
          // Activate the matches immediately. They become usable on the next turn —
          // no explicit load_tool call needed. The store records the activation;
          // for the context store this result in the conversation messages is the durable record.
          const newlyLoaded: string[] = [];
          for (const result of results) {
            if (!loadedToolNames.has(result.name)) {
              newlyLoaded.push(result.name);
            }
          }
          await this.store.addLoaded(newlyLoaded, storeContext);
          for (const name of newlyLoaded) loadedToolNames.add(name);

          return {
            results,
            message:
              `Found and loaded ${results.length} tool(s): ${results.map(r => r.name).join(', ')}. ` +
              `They are available on your next turn — call them directly.` +
              (newlyLoaded.length < results.length ? ' Some were already loaded.' : ''),
          };
        }

        return {
          results,
          message: `Found ${results.length} tool(s). Use load_tool with an exact toolName or a toolNames array to make them available.`,
        };
      },
    });

    // Create the load tool that uses thread-scoped state.
    // In auto-load mode this meta-tool is not exposed (search_tools activates matches itself).
    const loadTool = createTool({
      id: 'load_tool',
      description:
        'Load one or more tools into your context. ' +
        'Call this after finding tools with search_tools. ' +
        'Once loaded, tools will be available for use. ' +
        'Pass a single toolName or an array of toolNames to load multiple tools at once.',
      inputSchema: z.object({
        toolName: z.string().optional().describe('The exact name of a tool to load (from search results)'),
        toolNames: z
          .array(z.string())
          .optional()
          .describe('Array of exact tool names to load in one call (from search results)'),
      }),
      outputSchema: z.object({
        success: z.boolean(),
        message: z.string(),
        loadedCount: z.number().optional(),
        toolName: z.string().optional(),
        loaded: z.array(z.string()).optional(),
        notFound: z.array(z.string()).optional(),
        alreadyLoaded: z.array(z.string()).optional(),
      }),
      execute: async ({ toolName, toolNames }) => {
        // Determine which tools to load
        let toLoad: string[];
        const toolNamesProvided = toolNames !== undefined;
        if (toolNamesProvided && toolNames!.length === 0 && !toolName) {
          return {
            success: false,
            message: 'toolNames array must not be empty.',
          };
        }
        if (toolNamesProvided && toolNames!.length > 0) {
          // Merge toolName into toolNames if both provided, then dedupe
          const base: string[] = [...toolNames!];
          if (toolName) base.push(toolName);
          toLoad = Array.from(new Set(base));
        } else if (toolName) {
          toLoad = [toolName];
        } else {
          return {
            success: false,
            message: 'You must provide either toolName (string) or toolNames (array) to load.',
          };
        }

        const notFound: string[] = [];
        const alreadyLoaded: string[] = [];
        const loaded: string[] = [];

        for (const name of toLoad) {
          // Check if tool exists
          const matchingTool = this.findToolForDynamicName(name, searchableTools);

          if (!matchingTool) {
            notFound.push(name);
            continue;
          }

          const isAllowed = await this.isToolAllowed(matchingTool, args.requestContext, 'load');
          if (!isAllowed) {
            notFound.push(name);
            continue;
          }

          // Check if already loaded (snapshot of prior steps, plus this call).
          if (loadedToolNames.has(name) || loaded.includes(name)) {
            alreadyLoaded.push(name);
            continue;
          }

          loaded.push(name);
        }

        // Record newly loaded tools in the store. For the context store this
        // result in the conversation messages is the durable record.
        await this.store.addLoaded(loaded, storeContext);
        for (const name of loaded) loadedToolNames.add(name);

        // Build response based on how many tools were requested
        // Only use single-tool backward-compatible shape when using the legacy toolName param
        if (toLoad.length === 1 && !toolNamesProvided) {
          // Single-tool response (backward compatible shape)
          if (notFound.length > 0) {
            const name = toLoad[0]!;
            const suggestions = await this.getSuggestedToolNames(name, searchableTools, args.requestContext);
            let message = `Tool "${name}" not found.`;
            if (suggestions.length > 0) {
              message += ` Did you mean: ${suggestions.slice(0, 3).join(', ')}?`;
            } else {
              message += ' Use search_tools to find available tools.';
            }
            return { success: false, message, toolName: name };
          }
          if (alreadyLoaded.length > 0) {
            return {
              success: true,
              message: `Tool "${alreadyLoaded[0]}" is already loaded and available.`,
              toolName: alreadyLoaded[0],
            };
          }
          return {
            success: true,
            message: `Tool "${loaded[0]}" loaded successfully. It will be available on your next turn.`,
            toolName: loaded[0],
          };
        }

        // Multi-tool response
        const parts: string[] = [];
        if (loaded.length > 0) parts.push(`Loaded: ${loaded.join(', ')} — available on your next turn`);
        if (alreadyLoaded.length > 0) parts.push(`Already loaded: ${alreadyLoaded.join(', ')}`);
        if (notFound.length > 0) parts.push(`Not found: ${notFound.join(', ')}`);

        return {
          success: notFound.length === 0,
          message: parts.join(' | '),
          loadedCount: loaded.length,
          loaded: loaded.length > 0 ? loaded : undefined,
          notFound: notFound.length > 0 ? notFound : undefined,
          alreadyLoaded: alreadyLoaded.length > 0 ? alreadyLoaded : undefined,
        };
      },
    });

    // Get loaded tools as of this step's snapshot.
    const loadedTools = await this.getLoadedTools(loadedToolNames, searchableTools, args.requestContext);

    // Return merged tools, ordered to keep the cacheable prefix stable:
    // meta-tool(s) first (always present, fixed position), then existing tools,
    // then loaded tools appended last. Appending newly activated tools rather than
    // interleaving them preserves the tool-definition prefix so prompt caching is
    // not invalidated when a tool is loaded mid-conversation.
    return {
      tools: {
        search_tools: searchTool,
        // load_tool is omitted in auto-load mode — search_tools activates matches directly.
        ...(autoLoad ? {} : { load_tool: loadTool }),
        ...passthroughTools,
        ...loadedTools,
      },
    };
  }
}
