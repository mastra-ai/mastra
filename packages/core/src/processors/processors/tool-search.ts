import { z } from 'zod/v4';
import { MASTRA_THREAD_ID_KEY } from '../../request-context';
import { createTool } from '../../tools';
import type { Tool } from '../../tools';
import { BM25Index } from '../../workspace/search/bm25';
import type { TokenizeOptions } from '../../workspace/search/bm25';
import type { ProcessInputStepArgs, Processor } from '../index';

/**
 * Thread state with timestamp for TTL management
 */
interface ThreadState {
  tools: Set<string>;
  lastAccessed: number;
}

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
  };

  /**
   * Time-to-live for thread state in milliseconds.
   * After this duration of inactivity, thread state will be eligible for cleanup.
   * Set to 0 to disable TTL cleanup.
   * @default 3600000 (1 hour)
   */
  ttl?: number;
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
  private searchConfig: Required<NonNullable<ToolSearchProcessorOptions['search']>>;
  private ttl: number;

  /** BM25 index for tool search */
  private bm25Index: BM25Index;
  /** Map from tool ID to full description (for result formatting) */
  private toolDescriptions = new Map<string, string>();

  /**
   * Thread-scoped state management for loaded tools with TTL support.
   * Instance-scoped to prevent cross-processor interference.
   * Maps threadId -> ThreadState (tools + timestamp)
   */
  private threadLoadedTools = new Map<string, ThreadState>();

  constructor(options: ToolSearchProcessorOptions) {
    this.allTools = options.tools;
    this.searchConfig = {
      topK: options.search?.topK ?? 5,
      minScore: options.search?.minScore ?? 0,
    };
    this.ttl = options.ttl ?? 3600000; // Default: 1 hour

    // Create BM25 index with tool-search-specific tokenization
    this.bm25Index = new BM25Index({}, TOOL_SEARCH_TOKENIZE_OPTIONS);

    // Index all tools
    this.indexTools();

    // Start periodic cleanup if TTL is enabled
    if (this.ttl > 0) {
      this.scheduleCleanup();
    }
  }

  /**
   * Get the thread ID from the request context, or use 'default' as fallback.
   */
  private getThreadId(args: ProcessInputStepArgs): string {
    return args.requestContext?.get(MASTRA_THREAD_ID_KEY) || 'default';
  }

  /**
   * Get the set of loaded tool names for the current thread.
   * Updates the lastAccessed timestamp for TTL management.
   */
  private getLoadedToolNames(threadId: string): Set<string> {
    if (!this.threadLoadedTools.has(threadId)) {
      this.threadLoadedTools.set(threadId, {
        tools: new Set(),
        lastAccessed: Date.now(),
      });
    }
    const state = this.threadLoadedTools.get(threadId)!;
    state.lastAccessed = Date.now(); // Update timestamp on access
    return state.tools;
  }

  /**
   * Get loaded tools as Tool objects for the current thread.
   */
  private getLoadedTools(threadId: string): Record<string, Tool<any, any>> {
    const loadedNames = this.getLoadedToolNames(threadId);
    const loadedTools: Record<string, Tool<any, any>> = {};

    for (const toolName of loadedNames) {
      const tool = this.allTools[toolName] || Object.values(this.allTools).find(t => t.id === toolName);
      if (tool) {
        loadedTools[toolName] = tool;
      }
    }

    return loadedTools;
  }

  /**
   * Clear loaded tools for a specific thread (useful for testing).
   *
   * @param threadId - The thread ID to clear, or 'default' if not provided
   */
  public clearState(threadId: string = 'default'): void {
    this.threadLoadedTools.delete(threadId);
  }

  /**
   * Clear all thread state for this processor instance (useful for testing).
   */
  public clearAllState(): void {
    this.threadLoadedTools.clear();
  }

  /**
   * Clean up stale thread state based on TTL.
   * Removes threads that haven't been accessed within the TTL period.
   *
   * @returns Number of threads cleaned up
   */
  private cleanupStaleState(): number {
    if (this.ttl <= 0) return 0; // TTL disabled

    const now = Date.now();
    let cleanedCount = 0;

    for (const [threadId, state] of this.threadLoadedTools.entries()) {
      if (now - state.lastAccessed > this.ttl) {
        this.threadLoadedTools.delete(threadId);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  /**
   * Schedule periodic cleanup of stale thread state.
   * Runs cleanup every TTL/2 milliseconds to prevent unbounded memory growth.
   */
  private scheduleCleanup(): void {
    // Clean up at half the TTL interval
    const cleanupInterval = Math.max(this.ttl / 2, 60000); // Minimum 1 minute

    // Use setInterval but don't block process exit
    const intervalId = setInterval(() => {
      this.cleanupStaleState();
    }, cleanupInterval);

    // Allow process to exit even if interval is active
    if (intervalId.unref) {
      intervalId.unref();
    }
  }

  /**
   * Get statistics about current thread state (useful for monitoring).
   *
   * @returns Object with thread count and oldest access time
   */
  public getStateStats(): { threadCount: number; oldestAccessTime: number | null } {
    if (this.threadLoadedTools.size === 0) {
      return { threadCount: 0, oldestAccessTime: null };
    }

    let oldest = Date.now();
    for (const state of this.threadLoadedTools.values()) {
      if (state.lastAccessed < oldest) {
        oldest = state.lastAccessed;
      }
    }

    return {
      threadCount: this.threadLoadedTools.size,
      oldestAccessTime: oldest,
    };
  }

  /**
   * Manually trigger cleanup of stale state (useful for testing and monitoring).
   *
   * @returns Number of threads cleaned up
   */
  public cleanupNow(): number {
    return this.cleanupStaleState();
  }

  /**
   * Index all tools into the BM25 index
   */
  private indexTools(): void {
    for (const tool of Object.values(this.allTools)) {
      const name = tool.id;
      const description = tool.description || '';
      this.bm25Index.add(name, `${name} ${description}`);
      this.toolDescriptions.set(name, description);
    }
  }

  /**
   * Search for tools matching the query using BM25 ranking
   * with name-match boosting.
   *
   * @param query - Search keywords
   * @returns Array of matching tools with scores, sorted by relevance
   */
  private searchTools(query: string): SearchResult[] {
    if (this.bm25Index.size === 0) return [];

    // Get BM25 results (request more than topK to allow for re-ranking after boosting)
    const bm25Results = this.bm25Index.search(query, this.searchConfig.topK * 2, 0);

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

    // Re-sort after boosting, filter by minScore, apply topK
    return boostedResults
      .sort((a, b) => b.score - a.score)
      .filter(r => r.score > this.searchConfig.minScore)
      .slice(0, this.searchConfig.topK)
      .map(r => {
        const description = this.toolDescriptions.get(r.id) || '';
        return {
          name: r.id,
          description: description.length > 150 ? description.slice(0, 147) + '...' : description,
          score: Math.round(r.score * 100) / 100,
        };
      });
  }

  async processInputStep(args: ProcessInputStepArgs) {
    const { tools, messageList } = args;
    const threadId = this.getThreadId(args);
    const loadedToolNames = this.getLoadedToolNames(threadId);

    // Add system instruction about the meta-tools
    messageList.addSystem(
      'To discover available tools, call search_tools with a keyword query. ' +
        'To add a tool to the conversation, call load_tool with the tool name. ' +
        'Tools must be loaded before they can be used.',
    );

    // Create the search tool with BM25 ranking
    const searchTool = createTool({
      id: 'search_tools',
      description:
        'Search for available tools by keyword. ' +
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
        const results = this.searchTools(query);

        if (results.length === 0) {
          return {
            results: [],
            message: `No tools found matching "${query}". Try different keywords.`,
          };
        }

        return {
          results,
          message: `Found ${results.length} tool(s). Use load_tool with the exact tool name to make it available.`,
        };
      },
    });

    // Create the load tool that uses thread-scoped state
    const loadTool = createTool({
      id: 'load_tool',
      description:
        'Load a specific tool into your context. ' +
        'Call this after finding a tool with search_tools. ' +
        'Once loaded, the tool will be available for use. ' +
        'Args: toolName - The exact name of the tool to load (from search results).',
      inputSchema: z.object({
        toolName: z.string().describe('The exact name of the tool to load (from search results)'),
      }),
      outputSchema: z.object({
        success: z.boolean(),
        message: z.string(),
        toolName: z.string().optional(),
      }),
      execute: async ({ toolName }) => {
        // Check if tool exists
        const matchingTool = this.allTools[toolName] ?? Object.values(this.allTools).find(tool => tool.id === toolName);

        if (!matchingTool) {
          // Generate suggestions for similar tool names
          const availableToolNames = Object.keys(this.allTools).concat(
            Object.values(this.allTools)
              .map(t => t.id)
              .filter(id => !this.allTools[id]),
          );
          const suggestions = availableToolNames.filter(
            name =>
              name.toLowerCase().includes(toolName.toLowerCase()) ||
              toolName.toLowerCase().includes(name.toLowerCase()),
          );

          let message = `Tool "${toolName}" not found.`;
          if (suggestions.length > 0) {
            message += ` Did you mean: ${suggestions.slice(0, 3).join(', ')}?`;
          } else {
            message += ' Use search_tools to find available tools.';
          }

          return {
            success: false,
            message,
          };
        }

        // Check if already loaded (thread-scoped)
        if (loadedToolNames.has(toolName)) {
          return {
            success: true,
            message: `Tool "${toolName}" is already loaded and available.`,
            toolName,
          };
        }

        // Load the tool (thread-scoped)
        loadedToolNames.add(toolName);

        return {
          success: true,
          message: `Tool "${toolName}" loaded successfully. It will be available on your next turn.`,
          toolName,
        };
      },
    });

    // Get loaded tools for this thread
    const loadedTools = this.getLoadedTools(threadId);

    // Return merged tools: meta-tools + existing tools + loaded tools
    return {
      tools: {
        search_tools: searchTool,
        load_tool: loadTool,
        ...(tools ?? {}),
        ...loadedTools,
      },
    };
  }
}
