import { z } from 'zod';
import { createTool } from '../../tools';
import type { Tool } from '../../tools';
import type { ProcessInputStepArgs, Processor } from '../index';

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
}

/**
 * Internal interface for indexed tool entries
 */
interface ToolEntry {
  tool: Tool<any, any>;
  name: string;
  description: string;
  tokens: string[];
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
 * Tokenize text into searchable terms.
 * Splits on whitespace and special characters, lowercases, and filters short tokens.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s\-_.,;:!?()[\]{}'"]+/)
    .filter(token => token.length > 1);
}

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
  private enabledTools: Record<string, Tool<any, any>> = {};
  private searchConfig: Required<NonNullable<ToolSearchProcessorOptions['search']>>;
  private toolEntries: ToolEntry[] = [];

  // BM25 parameters
  private readonly k1 = 1.5; // Term frequency saturation
  private readonly b = 0.75; // Length normalization factor

  constructor(options: ToolSearchProcessorOptions) {
    this.allTools = options.tools;
    this.searchConfig = {
      topK: options.search?.topK ?? 5,
      minScore: options.search?.minScore ?? 0,
    };

    // Index all tools for BM25 search
    this.indexTools();
  }

  /**
   * Index all tools for BM25 search
   */
  private indexTools(): void {
    this.toolEntries = Object.values(this.allTools).map(tool => ({
      tool,
      name: tool.id,
      description: tool.description || '',
      tokens: tokenize(`${tool.id} ${tool.description || ''}`),
    }));
  }

  /**
   * Calculate average document length across all entries
   */
  private getAverageDocLength(): number {
    if (this.toolEntries.length === 0) return 0;
    const totalLength = this.toolEntries.reduce((sum, entry) => sum + entry.tokens.length, 0);
    return totalLength / this.toolEntries.length;
  }

  /**
   * Calculate IDF (Inverse Document Frequency) for a term.
   * Rarer terms get higher scores.
   */
  private calculateIDF(term: string): number {
    const N = this.toolEntries.length;
    const n = this.toolEntries.filter(entry => entry.tokens.includes(term)).length;

    if (n === 0) return 0;

    // Standard IDF formula with smoothing
    return Math.log((N - n + 0.5) / (n + 0.5) + 1);
  }

  /**
   * Calculate BM25 score for a single term in a document
   */
  private calculateTermScore(term: string, entry: ToolEntry, avgDl: number): number {
    const tf = entry.tokens.filter(t => t === term).length;
    if (tf === 0) return 0;

    const idf = this.calculateIDF(term);
    const dl = entry.tokens.length;

    // BM25 formula
    const numerator = tf * (this.k1 + 1);
    const denominator = tf + this.k1 * (1 - this.b + this.b * (dl / avgDl));

    return idf * (numerator / denominator);
  }

  /**
   * Search for tools matching the query using BM25 ranking.
   *
   * @param query - Search keywords
   * @returns Array of matching tools with scores, sorted by relevance
   */
  private searchTools(query: string): SearchResult[] {
    if (this.toolEntries.length === 0) return [];

    const queryTokens = tokenize(query);
    if (queryTokens.length === 0) return [];

    const avgDl = this.getAverageDocLength();

    // Score each document
    const scored = this.toolEntries.map(entry => {
      let score = 0;

      for (const term of queryTokens) {
        score += this.calculateTermScore(term, entry, avgDl);

        // Boost exact name matches significantly
        if (entry.name.toLowerCase() === term) {
          score += 5;
        } else if (entry.name.toLowerCase().includes(term)) {
          score += 2;
        }
      }

      return { entry, score };
    });

    // Filter by minScore, sort by relevance, apply topK limit
    return scored
      .filter(s => s.score > this.searchConfig.minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, this.searchConfig.topK)
      .map(s => ({
        name: s.entry.name,
        description: s.entry.description.length > 150 ? s.entry.description.slice(0, 147) + '...' : s.entry.description,
        score: Math.round(s.score * 100) / 100,
      }));
  }

  async processInputStep({ tools, messageList }: ProcessInputStepArgs) {
    // Add system instruction about the meta-tools
    messageList.addSystem(
      'To discover available tools, call search_tools with a keyword query. ' +
        'To add a tool to the conversation, call load_tool with the tool name. ' +
        'Tools must be loaded before they can be used.',
    );

    // Create the search tool with BM25 ranking
    const searchTool = createTool({
      id: 'search_tools',
      description: 'Search for available tools by keyword. Returns a ranked list of relevant tools.',
      inputSchema: z.object({
        query: z.string().describe('Search query to find relevant tools'),
      }),
      execute: async ({ query }) => {
        // Use BM25 search for relevance-ranked results
        const results = this.searchTools(query);

        if (results.length === 0) {
          return {
            tools: [],
            message: `No tools found matching query: "${query}". Try different keywords or search more broadly.`,
          };
        }

        return {
          tools: results,
          message: `Found ${results.length} relevant tool${results.length === 1 ? '' : 's'}. Use load_tool to add them to the conversation.`,
        };
      },
    });

    // Create the load tool
    const loadTool = createTool({
      id: 'load_tool',
      description: 'Load a specific tool into the current conversation to make it available for use',
      inputSchema: z.object({
        toolName: z.string().describe('The name/ID of the tool to load'),
      }),
      execute: async ({ toolName }) => {
        // Check if tool exists
        const matchingTool = this.allTools[toolName] ?? Object.values(this.allTools).find(tool => tool.id === toolName);

        if (!matchingTool) {
          // TODO: Add suggestions for similar tool names in task 004
          return {
            success: false,
            message: `Tool "${toolName}" not found. Use search_tools to discover available tools.`,
          };
        }

        // Check if already loaded
        if (this.enabledTools[toolName]) {
          return {
            success: true,
            message: `Tool "${toolName}" is already loaded and available.`,
          };
        }

        // Load the tool
        this.enabledTools[toolName] = matchingTool;

        return {
          success: true,
          message: `Tool "${toolName}" has been loaded and is now available for use.`,
        };
      },
    });

    // Return merged tools: meta-tools + existing tools + loaded tools
    return {
      tools: {
        search_tools: searchTool,
        load_tool: loadTool,
        ...(tools ?? {}),
        ...this.enabledTools,
      },
    };
  }
}
