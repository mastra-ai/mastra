import { z } from 'zod/v4';
import { parseMemoryRequestContext } from '../../memory/types';
import { MASTRA_THREAD_ID_KEY } from '../../request-context';
import type { RequestContext } from '../../request-context';
import { createTool } from '../../tools';
import type { Tool } from '../../tools';
import { markProcessorLoadedToolSource, processorLoadedToolSource } from '../../tools/tool-provenance';
import { BM25Index } from '../../workspace/search/bm25';
import type { TokenizeOptions } from '../../workspace/search/bm25';
import type { ProcessInputStepArgs, Processor } from '../index';
import type { LoadedToolStore, LoadedToolStoreContext } from './tool-search-stores';
import {
  LegacyMapLoadedToolStore,
  ContextLoadedToolStore,
  TOOL_SEARCH_AUTO_LOAD_ACTIVATION_TYPE,
  TOOL_SEARCH_AUTO_LOAD_ACTIVATION_VERSION,
} from './tool-search-stores';

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
   * Also make the tools the agent resolved for this request (`args.tools`)
   * searchable instead of sending them to the model upfront.
   *
   * Tools resolved per request — MCP tools that need the caller's auth token,
   * or anything returned by a dynamic `tools` function — cannot be listed in the
   * constructor, so by default they bypass search entirely and occupy prompt
   * space on every turn. With this enabled they are indexed for the duration of
   * the request and withheld from the prompt until the model loads them, which
   * is the same token saving static tools already get.
   *
   * The meta-tools (`search_tools` / `load_tool`) are never withheld.
   *
   * @default false
   */
  includeResolvedTools?: boolean;

  /**
   * Inject the available-tool catalog (name + short description) into the system
   * prompt so the model can skip the `search_tools` turn and go straight to
   * `load_tool` -> use. This collapses the default `search -> load -> use`
   * (3 turns) into `load -> use` (2 turns).
   *
   * This is a trade-off: listing the catalog costs tokens on every turn in
   * exchange for removing a discovery round-trip. It is a net win only when the
   * tool set is small or medium; for very large catalogs keyword `search_tools`
   * remains preferable, so this stays opt-in. `search_tools` is still exposed
   * when this is enabled, as a fallback for keyword rediscovery.
   *
   * Injected entries respect the `filter` hook (phase `'search'`), so tools the
   * current request may not use are not advertised.
   *
   * @default false
   */
  injectCatalog?: boolean;

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
   * - `'context'`: derived from canonical assistant tool results in the
   *   conversation. `load_tool` results must contain `loaded`; `search_tools`
   *   results activate tools only when auto-load emitted an explicit activation
   *   receipt. Restart-safe, requires no memory, and de-loads automatically when
   *   the result block is no longer present in the messages.
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

const TOOL_SEARCH_META_TOOL_NAMES = new Set(['search_tools', 'load_tool']);

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
/** Meta-tools this processor injects; never searchable, never withheld. */
const META_TOOL_NAMES = new Set(['search_tools', 'load_tool']);

/** A searchable set of tools: the tools themselves plus their BM25 index. */
type ToolCatalog = {
  tools: Record<string, Tool<any, any>>;
  /** Effective callable name (`tool.id || record key`) -> tool. */
  toolsByName: Map<string, Tool<any, any>>;
  index: BM25Index;
  /** Effective callable name -> full description, for formatting search results. */
  descriptions: Map<string, string>;
};

function buildToolCatalog(tools: Record<string, Tool<any, any>>): ToolCatalog {
  const index = new BM25Index({}, TOOL_SEARCH_TOKENIZE_OPTIONS);
  const descriptions = new Map<string, string>();
  const toolsByName = new Map<string, Tool<any, any>>();
  const ownerKeys = new Map<string, string>();

  for (const [key, tool] of Object.entries(tools)) {
    const name = tool.id || key;
    if (TOOL_SEARCH_META_TOOL_NAMES.has(key) || TOOL_SEARCH_META_TOOL_NAMES.has(name)) {
      throw new Error(
        `ToolSearchProcessor tool key and callable name must not use reserved meta-tool names: key="${key}", name="${name}".`,
      );
    }
    const existing = toolsByName.get(name);
    if (existing && existing !== tool) {
      throw new Error(
        `ToolSearchProcessor requires unique tool ids/callable names; duplicate name "${name}" was provided.`,
      );
    }
    toolsByName.set(name, tool);
    ownerKeys.set(name, key);
  }
  for (const [key, tool] of Object.entries(tools)) {
    const nameOwner = toolsByName.get(key);
    if (nameOwner && nameOwner !== tool) {
      throw new Error(
        `ToolSearchProcessor tool key "${key}" conflicts with the callable name of tool key "${ownerKeys.get(key)}". Tool keys and callable names must resolve unambiguously.`,
      );
    }
  }

  for (const [name, tool] of toolsByName) {
    const description = tool.description || '';
    index.add(name, `${name} ${description}`);
    descriptions.set(name, description);
  }

  return { tools, toolsByName, index, descriptions };
}

/**
 * Request-resolved tools that should become searchable. Typed loosely because
 * `ProcessInputStepArgs.tools` is an untyped record at the step boundary.
 */
function searchableResolvedTools(tools: Record<string, unknown> | undefined): Record<string, Tool<any, any>> {
  return Object.fromEntries(Object.entries(tools ?? {}).filter(([name]) => !META_TOOL_NAMES.has(name))) as Record<
    string,
    Tool<any, any>
  >;
}

/** Request-resolved tools that stay in the prompt even when search is enabled. */
function unsearchableResolvedTools(tools: Record<string, unknown> | undefined): Record<string, unknown> {
  return Object.fromEntries(Object.entries(tools ?? {}).filter(([name]) => META_TOOL_NAMES.has(name)));
}

export class ToolSearchProcessor implements Processor<'tool-search'> {
  readonly id = 'tool-search';
  readonly name = 'Tool Search Processor';
  readonly description = 'Enables dynamic tool discovery and loading via search';

  private includeResolvedTools: boolean;
  private injectCatalog: boolean;
  private searchConfig: Required<NonNullable<ToolSearchProcessorOptions['search']>>;
  private filter?: ToolSearchProcessorOptions['filter'];

  /** Context-backed receipts are durable evidence, not authorization credentials. */
  private reauthorizeLoadedNames: boolean;

  /** Pluggable backend for loaded-tool state. */
  private store: LoadedToolStore;

  /** Searchable set built from the constructor's `tools`. */
  private staticCatalog: ToolCatalog;

  constructor(options: ToolSearchProcessorOptions) {
    this.includeResolvedTools = options.includeResolvedTools ?? false;
    this.injectCatalog = options.injectCatalog ?? false;
    this.filter = options.filter;
    this.searchConfig = {
      topK: options.search?.topK ?? 5,
      minScore: options.search?.minScore ?? 0,
      autoLoad: options.search?.autoLoad ?? false,
    };

    const storage = options.storage ?? 'in-memory';
    this.reauthorizeLoadedNames = storage === 'context';

    this.store =
      storage === 'context' ? new ContextLoadedToolStore() : new LegacyMapLoadedToolStore({ ttl: options.ttl });

    this.staticCatalog = buildToolCatalog(options.tools);
  }

  /**
   * Get the thread ID from the request context, or undefined when no thread is active.
   * Both stores tolerate an undefined thread ID.
   *
   * The reserved `mastra__threadId` key is only populated by server middleware
   * overrides, so also fall back to the memory context the agent sets after
   * resolving the thread (covers HTTP calls that pass the thread via
   * `memory.thread`).
   */
  private resolveThreadId(requestContext: RequestContext | undefined): string | undefined {
    return (
      (requestContext?.get(MASTRA_THREAD_ID_KEY) as string | undefined) ||
      parseMemoryRequestContext(requestContext)?.thread?.id ||
      undefined
    );
  }

  private getThreadId(args: ProcessInputStepArgs): string | undefined {
    return this.resolveThreadId(args.requestContext);
  }

  private makeStoreContext(args: ProcessInputStepArgs): LoadedToolStoreContext {
    return { threadId: this.getThreadId(args), args };
  }

  private findToolById(catalog: ToolCatalog, toolId: string): Tool<any, any> | undefined {
    return catalog.toolsByName.get(toolId);
  }

  private findToolForDynamicName(catalog: ToolCatalog, toolName: string): Tool<any, any> | undefined {
    return catalog.toolsByName.get(toolName);
  }

  /**
   * The searchable set for one step. Request-resolved tools are indexed fresh
   * each step rather than cached: two requests can expose the same tool names
   * backed by different closures (per-user MCP credentials), so reusing an index
   * across requests would hand one caller another caller's tool instance.
   */
  private catalogForStep(stepTools: Record<string, unknown> | undefined): ToolCatalog {
    if (!this.includeResolvedTools) return this.staticCatalog;
    const resolved = searchableResolvedTools(stepTools);
    if (Object.keys(resolved).length === 0) return this.staticCatalog;
    for (const [name, tool] of Object.entries(resolved)) {
      const existing = this.staticCatalog.tools[name];
      if (existing && existing !== tool) {
        throw new Error(`ToolSearchProcessor resolved tool "${name}" conflicts with the static searchable catalog.`);
      }
    }
    return buildToolCatalog({ ...this.staticCatalog.tools, ...resolved });
  }

  /**
   * Format the catalog as a newline-separated list of `- \`name\`: description`
   * for injection into the system prompt. Entries are filtered through the
   * `filter` hook (phase `'search'`) so disallowed tools are not advertised.
   * Returns an empty string when no tools are available/allowed.
   */
  private async formatCatalog(catalog: ToolCatalog, requestContext: RequestContext | undefined): Promise<string> {
    const lines: string[] = [];

    for (const name of Object.keys(catalog.tools)) {
      const tool = this.findToolForDynamicName(catalog, name);
      if (!tool) continue;

      const isAllowed = await this.isToolAllowed(name, tool, requestContext, 'search');
      if (!isAllowed) continue;

      const toolName = tool.id || name;
      const raw = catalog.descriptions.get(toolName) ?? '';
      const description = raw.length > 150 ? raw.slice(0, 147) + '...' : raw;
      lines.push(description ? `- \`${toolName}\`: ${description}` : `- \`${toolName}\``);
    }

    return lines.join('\n');
  }

  private async isToolAllowed(
    toolName: string,
    tool: Tool<any, any>,
    requestContext: RequestContext | undefined,
    phase: ToolSearchFilterPhase,
  ): Promise<boolean> {
    if (!this.filter) {
      return true;
    }

    try {
      return await this.filter({ toolName, tool, requestContext, phase });
    } catch {
      return false;
    }
  }

  private async getSuggestedToolNames(
    catalog: ToolCatalog,
    toolName: string,
    requestContext?: RequestContext,
  ): Promise<string[]> {
    const matchesToolName = (name: string) =>
      name.toLowerCase().includes(toolName.toLowerCase()) || toolName.toLowerCase().includes(name.toLowerCase());

    if (!this.filter) {
      return [...catalog.toolsByName.keys()].filter(matchesToolName);
    }

    const allowedNames: string[] = [];

    for (const name of catalog.toolsByName.keys()) {
      if (!matchesToolName(name)) continue;

      const tool = this.findToolForDynamicName(catalog, name);
      if (!tool) continue;

      const isAllowed = await this.isToolAllowed(name, tool, requestContext, 'load');
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
    catalog: ToolCatalog,
    loadedNames: Set<string>,
    requestContext?: RequestContext,
  ): Promise<Record<string, Tool<any, any>>> {
    const loadedTools: Record<string, Tool<any, any>> = {};

    for (const toolName of loadedNames) {
      const tool = this.findToolForDynamicName(catalog, toolName);
      if (tool) {
        if (this.reauthorizeLoadedNames && !(await this.isToolAllowed(toolName, tool, requestContext, 'load'))) {
          continue;
        }
        const isAllowed = await this.isToolAllowed(toolName, tool, requestContext, 'active');
        if (isAllowed) {
          // Stamp provenance before this object is merged into step surfaces or
          // converted for durable/resume paths: downstream copies must stay
          // recognizable as this processor's own loaded executor.
          markProcessorLoadedToolSource(tool, tool);
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
   *
   * `tools` carries the resumed request's resolved tools. Without them a loaded
   * request-scoped tool has no entry in the static catalog, so the approved call
   * would resume with no executor.
   */
  public async getLoadedToolsForRequestContext(args?: {
    requestContext?: RequestContext;
    stepArgs?: ProcessInputStepArgs;
    /** Persisted messages supplied by a resume boundary before a live step exists. */
    messages?: ProcessInputStepArgs['messages'];
    tools?: Record<string, unknown>;
  }): Promise<Record<string, Tool<any, any>>> {
    if (args?.stepArgs) {
      const loadedNames = await this.store.getLoadedNames(this.makeStoreContext(args.stepArgs));
      // Fall back to the step's own request context so active-phase filtering still
      // runs when the caller only supplies stepArgs.
      return this.getLoadedTools(
        this.catalogForStep(args.stepArgs.tools),
        loadedNames,
        args.requestContext ?? args.stepArgs.requestContext,
      );
    }

    const threadId = this.resolveThreadId(args?.requestContext);
    const loadedNames = await this.store.getLoadedNames({ threadId, args: undefined, messages: args?.messages });
    return this.getLoadedTools(this.catalogForStep(args?.tools), loadedNames, args?.requestContext);
  }

  /**
   * Clear loaded tools for a specific thread (useful for testing).
   *
   * This is a no-op for the `'context'` store. Its durable state is owned by
   * conversation messages and its same-run bridge is owned by request state.
   *
   * @param threadId - The thread ID to clear, or 'default' if not provided
   */
  public clearState(threadId: string = 'default'): void {
    this.store.clearState(threadId);
  }

  /**
   * Clear all thread state for this processor instance (useful for testing).
   *
   * This is a no-op for the `'context'` store.
   */
  public clearAllState(): void {
    this.store.clearAllState();
  }

  /** Release cleanup timers and process-local loaded-tool state. */
  public dispose(): void {
    this.store.dispose();
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

  /**
   * Search for tools matching the query using BM25 ranking
   * with name-match boosting.
   *
   * @param query - Search keywords
   * @returns Array of matching tools with scores, sorted by relevance
   */
  private async searchTools(
    catalog: ToolCatalog,
    query: string,
    requestContext?: RequestContext,
  ): Promise<SearchResult[]> {
    if (catalog.index.size === 0) return [];

    // Get BM25 results (request more than topK to allow for re-ranking after boosting).
    // When filtering is enabled, inspect every BM25 match so denied high-ranking tools
    // do not prevent lower-ranking allowed tools from filling the result set.
    const searchLimit = this.filter ? catalog.index.size : this.searchConfig.topK * 2;
    const bm25Results = catalog.index.search(query, searchLimit, 0);

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

      const tool = this.findToolById(catalog, result.id);
      if (!tool) continue;

      const isAllowed = await this.isToolAllowed(result.id, tool, requestContext, 'search');
      if (isAllowed) {
        filteredResults.push(result);
        if (filteredResults.length >= this.searchConfig.topK) break;
      }
    }

    // Apply topK and format results.
    return filteredResults.slice(0, this.searchConfig.topK).map(r => {
      const description = catalog.descriptions.get(r.id) || '';
      return {
        name: r.id,
        description: description.length > 150 ? description.slice(0, 147) + '...' : description,
        score: Math.round(r.score * 100) / 100,
      };
    });
  }

  async processInputStep(args: ProcessInputStepArgs) {
    const { tools, messageList } = args;
    for (const metaToolName of TOOL_SEARCH_META_TOOL_NAMES) {
      if (Object.prototype.hasOwnProperty.call(tools ?? {}, metaToolName)) {
        throw new Error(
          `ToolSearchProcessor cannot inject its "${metaToolName}" meta-tool because the input tool set already defines that name.`,
        );
      }
    }
    const catalog = this.catalogForStep(tools);
    const storeContext = this.makeStoreContext(args);
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

    // Optionally inject the catalog so the model can skip the search step and
    // load tools directly. `search_tools` stays available as a keyword fallback.
    if (this.injectCatalog) {
      const catalogList = await this.formatCatalog(catalog, args.requestContext);
      if (catalogList) {
        messageList.addSystem(
          (autoLoad
            ? 'The following tools are available. Call search_tools with a keyword to load one — ' +
              'matching tools are loaded automatically and become available on your next turn.'
            : 'The following tools are available to load. Call load_tool with a toolName or toolNames array ' +
              'to add one or more before using them — no search step is required. ' +
              'search_tools is also available if you need to rediscover tools by keyword.') +
            '\n\nAvailable tools:\n' +
            catalogList,
        );
      }
    }

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
        activation: z
          .object({
            type: z.literal(TOOL_SEARCH_AUTO_LOAD_ACTIVATION_TYPE),
            version: z.literal(TOOL_SEARCH_AUTO_LOAD_ACTIVATION_VERSION),
            loaded: z.array(z.string()),
          })
          .optional(),
      }),
      execute: async ({ query }) => {
        // Use BM25 search for relevance-ranked results
        let results = await this.searchTools(catalog, query, args.requestContext);

        if (results.length === 0) {
          return {
            results: [],
            message: `No tools found matching "${query}". Try different keywords.`,
          };
        }

        if (autoLoad) {
          // Auto-load collapses discovery and loading into one operation, but it
          // must not collapse their policy checks. A tool may be discoverable
          // while loading it is forbidden for this request. Only expose and
          // persist matches that pass the same load-phase gate as `load_tool`.
          const loadAllowedResults: SearchResult[] = [];
          for (const result of results) {
            const tool = this.findToolById(catalog, result.name);
            if (!tool) continue;
            if (await this.isToolAllowed(result.name, tool, args.requestContext, 'load')) {
              loadAllowedResults.push(result);
            }
          }
          results = loadAllowedResults;

          if (results.length === 0) {
            return {
              results: [],
              message: `No tools available to load matching "${query}". Try different keywords.`,
            };
          }

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

          const activation: {
            type: typeof TOOL_SEARCH_AUTO_LOAD_ACTIVATION_TYPE;
            version: typeof TOOL_SEARCH_AUTO_LOAD_ACTIVATION_VERSION;
            loaded: string[];
          } = {
            type: TOOL_SEARCH_AUTO_LOAD_ACTIVATION_TYPE,
            version: TOOL_SEARCH_AUTO_LOAD_ACTIVATION_VERSION,
            // Mark every result, including a repeat match that was already
            // active. A cold replay can then recover from this result alone.
            loaded: results.map(result => result.name),
          };

          return {
            results,
            activation,
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
          const matchingTool = this.findToolForDynamicName(catalog, name);

          if (!matchingTool) {
            notFound.push(name);
            continue;
          }

          const isAllowed = await this.isToolAllowed(name, matchingTool, args.requestContext, 'load');
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

        // Record newly loaded tools in the store. For the context store the
        // canonical assistant result is the durable record; request state only
        // bridges execution to later steps in this run.
        await this.store.addLoaded(loaded, storeContext);
        for (const name of loaded) loadedToolNames.add(name);

        // Build response based on how many tools were requested
        // Only use single-tool backward-compatible shape when using the legacy toolName param
        if (toLoad.length === 1 && !toolNamesProvided) {
          // Single-tool response (backward compatible shape)
          if (notFound.length > 0) {
            const name = toLoad[0]!;
            const suggestions = await this.getSuggestedToolNames(catalog, name, args.requestContext);
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
              loaded: [alreadyLoaded[0]!],
            };
          }
          return {
            success: true,
            message: `Tool "${loaded[0]}" loaded successfully. It will be available on your next turn.`,
            toolName: loaded[0],
            loaded: [loaded[0]!],
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
    const loadedTools = await this.getLoadedTools(catalog, loadedToolNames, args.requestContext);
    const alwaysAvailableTools = this.includeResolvedTools ? unsearchableResolvedTools(tools) : (tools ?? {});

    for (const loadedToolName of Object.keys(loadedTools)) {
      if (!Object.prototype.hasOwnProperty.call(alwaysAvailableTools, loadedToolName)) {
        continue;
      }
      const candidate = alwaysAvailableTools[loadedToolName];
      const loadedTool = loadedTools[loadedToolName]!;
      // Suspend/resume, tool-surface-fence restore, and durable registry replay
      // can re-expose the loaded executor through the input surface — as a
      // `makeCoreTool` copy, not the catalog instance. The shared provenance
      // token identifies that copy. It is not a reference to the executable,
      // so a fenced view cannot swap the retained executor through the marker.
      // Only a genuinely different tool under the loaded name fails closed.
      const candidateToken = processorLoadedToolSource(candidate);
      const loadedToken = processorLoadedToolSource(loadedTool);
      if (candidate === loadedTool || (candidateToken !== undefined && candidateToken === loadedToken)) {
        continue;
      }
      throw new Error(
        `ToolSearchProcessor loaded tool "${loadedToolName}" conflicts with an always-available input tool.`,
      );
    }

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
        // When request-resolved tools are searchable they are withheld here:
        // leaving them in would defeat the point, since they would still occupy
        // prompt space. They come back through `loadedTools` once loaded.
        ...alwaysAvailableTools,
        ...loadedTools,
      },
    };
  }
}
