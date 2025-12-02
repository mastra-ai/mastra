import { embed } from '@internal/ai-sdk-v4';
import { embed as embedV2 } from 'ai-v5';
import { z } from 'zod';

import type { MastraEmbeddingModel } from '../vector';

import type { Tool } from './tool';
import { createTool } from './tool';
import type { ToolAction, ToolExecutionContext } from './types';

/**
 * Represents a tool with its computed data for search
 */
interface IndexedTool {
  id: string;
  description: string;
  searchText: string;
  embedding?: number[];
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
  /** Similarity/relevance score (higher is more relevant) */
  score: number;
  /** The original tool */
  tool: ToolAction<any, any, any>;
}

/**
 * Search method for tool discovery
 */
export type ToolSearchMethod = 'regex' | 'bm25' | 'embedding';

/**
 * Configuration for createToolSearch
 */
export interface ToolSearchConfig {
  /** Tools to make searchable. All tools passed here are deferred (loaded on-demand). */
  tools: Record<string, ToolAction<any, any, any>>;
  /** Search method: 'regex', 'bm25', or 'embedding' (default: 'bm25') */
  method?: ToolSearchMethod;
  /** Embedding model (required when method is 'embedding') */
  embedder?: MastraEmbeddingModel<string>;
  /** Custom ID for the search tool (defaults to 'tool_search') */
  searchToolId?: string;
  /** Custom description for the search tool */
  searchToolDescription?: string;
  /** Maximum number of tools to return in search results (defaults to 5) */
  topK?: number;
  /** Minimum score threshold to load a tool (defaults to 0.3 for embedding, 0 for others) */
  minScore?: number;
}

// ============================================================================
// Search Implementations
// ============================================================================

/**
 * Regex-based search - simple pattern matching
 */
function regexSearch(query: string, tools: Map<string, IndexedTool>, topK: number): ToolSearchResult[] {
  const results: ToolSearchResult[] = [];

  // Escape special regex characters and create pattern
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(escapedQuery, 'i');

  for (const indexed of tools.values()) {
    const matches = pattern.test(indexed.searchText);
    if (matches) {
      // Score based on how early the match appears and match length ratio
      const matchIndex = indexed.searchText.toLowerCase().indexOf(query.toLowerCase());
      const positionScore = matchIndex >= 0 ? 1 - matchIndex / indexed.searchText.length : 0;
      const lengthScore = query.length / indexed.searchText.length;
      const score = (positionScore + lengthScore) / 2;

      results.push({
        id: indexed.id,
        description: indexed.description,
        score: Math.min(1, score),
        tool: indexed.tool,
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, topK);
}

/**
 * BM25-based search - term frequency with inverse document frequency
 */
function bm25Search(
  query: string,
  tools: Map<string, IndexedTool>,
  topK: number,
  k1 = 1.5,
  b = 0.75,
): ToolSearchResult[] {
  const results: ToolSearchResult[] = [];
  const queryTerms = tokenize(query);

  if (queryTerms.length === 0) {
    return [];
  }

  // Calculate average document length
  let totalLength = 0;
  for (const indexed of tools.values()) {
    totalLength += tokenize(indexed.searchText).length;
  }
  const avgDocLength = totalLength / tools.size || 1;

  // Calculate IDF for each query term
  const idf: Record<string, number> = {};
  for (const term of queryTerms) {
    let docCount = 0;
    for (const indexed of tools.values()) {
      if (indexed.searchText.toLowerCase().includes(term)) {
        docCount++;
      }
    }
    // IDF with smoothing
    idf[term] = Math.log((tools.size - docCount + 0.5) / (docCount + 0.5) + 1);
  }

  // Calculate BM25 score for each document
  for (const indexed of tools.values()) {
    const docTerms = tokenize(indexed.searchText);
    const docLength = docTerms.length;

    // Count term frequencies
    const termFreq: Record<string, number> = {};
    for (const term of docTerms) {
      termFreq[term] = (termFreq[term] || 0) + 1;
    }

    let score = 0;
    for (const term of queryTerms) {
      const tf = termFreq[term] || 0;
      if (tf > 0) {
        const numerator = tf * (k1 + 1);
        const denominator = tf + k1 * (1 - b + b * (docLength / avgDocLength));
        score += (idf[term] || 0) * (numerator / denominator);
      }
    }

    if (score > 0) {
      results.push({
        id: indexed.id,
        description: indexed.description,
        score,
        tool: indexed.tool,
      });
    }
  }

  // Normalize scores to 0-1 range
  const maxScore = Math.max(...results.map(r => r.score), 1);
  for (const result of results) {
    result.score = result.score / maxScore;
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, topK);
}

/**
 * Tokenize text into terms for BM25
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(term => term.length > 1);
}

/**
 * Cosine similarity between two vectors
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
 * Generate search text from a tool
 */
function getSearchText(tool: ToolAction<any, any, any>, id: string): string {
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
 * Schema for the tool search input
 */
const toolSearchInputSchema = z.object({
  query: z.string().describe('Natural language description of the capability or tool you need'),
});

/**
 * ToolSearch manages searchable tools with on-demand loading.
 *
 * All tools passed to createToolSearch are searchable - they're not loaded into
 * the agent's context initially. Instead, the agent gets a search tool that discovers
 * and loads relevant tools on-demand. Once loaded, tools remain available for
 * subsequent calls within the same thread/session.
 */
export class ToolSearch {
  private method: ToolSearchMethod;
  private embedder?: MastraEmbeddingModel<string>;

  /** Searchable tools with their search data */
  private tools: Map<string, IndexedTool> = new Map();

  /** Loaded tool IDs per thread */
  private loadedToolsByThread: Map<string, Set<string>> = new Map();

  /** Search tool configuration */
  private searchToolId: string;
  private searchToolDescription: string;
  private topK: number;
  private minScore: number;

  constructor(config: ToolSearchConfig) {
    this.method = config.method ?? 'bm25';
    this.embedder = config.embedder;
    this.searchToolId = config.searchToolId ?? 'tool_search';
    this.searchToolDescription =
      config.searchToolDescription ??
      'Search for available tools based on what you need to accomplish. Found tools will be loaded and available for use.';
    this.topK = config.topK ?? 5;
    this.minScore = config.minScore ?? (this.method === 'embedding' ? 0.3 : 0);

    if (this.method === 'embedding' && !this.embedder) {
      throw new Error('Embedder is required when using embedding search method');
    }
  }

  /**
   * Embeds text using the configured embedding model
   */
  private async embed(text: string): Promise<number[]> {
    if (!this.embedder) {
      throw new Error('Embedder not configured');
    }

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
   * Indexes tools for searching
   */
  async indexTools(tools: Record<string, ToolAction<any, any, any>>): Promise<void> {
    const entries = Object.entries(tools);

    if (this.method === 'embedding') {
      // Create embeddings in parallel
      const embeddings = await Promise.all(
        entries.map(async ([id, tool]) => {
          const searchText = getSearchText(tool, id);
          const embedding = await this.embed(searchText);
          return { id, searchText, embedding };
        }),
      );

      for (let i = 0; i < entries.length; i++) {
        const [id, tool] = entries[i]!;
        const { searchText, embedding } = embeddings[i]!;

        this.tools.set(id, {
          id,
          description: tool.description,
          searchText,
          embedding,
          tool,
        });
      }
    } else {
      // For regex/BM25, just store search text
      for (const [id, tool] of entries) {
        const searchText = getSearchText(tool, id);
        this.tools.set(id, {
          id,
          description: tool.description,
          searchText,
          tool,
        });
      }
    }
  }

  /**
   * Searches for tools matching the query
   */
  async search(query: string): Promise<ToolSearchResult[]> {
    if (this.tools.size === 0) {
      return [];
    }

    let results: ToolSearchResult[];

    switch (this.method) {
      case 'regex':
        results = regexSearch(query, this.tools, this.topK);
        break;
      case 'bm25':
        results = bm25Search(query, this.tools, this.topK);
        break;
      case 'embedding': {
        const queryEmbedding = await this.embed(query);
        results = [];

        for (const indexed of this.tools.values()) {
          if (indexed.embedding) {
            const score = cosineSimilarity(queryEmbedding, indexed.embedding);
            if (score >= this.minScore) {
              results.push({
                id: indexed.id,
                description: indexed.description,
                score,
                tool: indexed.tool,
              });
            }
          }
        }

        results.sort((a, b) => b.score - a.score);
        results = results.slice(0, this.topK);
        break;
      }
    }

    // Apply minScore filter for non-embedding methods
    if (this.method !== 'embedding' && this.minScore > 0) {
      results = results.filter(r => r.score >= this.minScore);
    }

    return results;
  }

  /**
   * Loads a tool for a specific thread
   */
  loadTool(toolId: string, threadId?: string): boolean {
    if (!this.tools.has(toolId)) {
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
   * Loads multiple tools
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
   * Unloads a tool from a thread's context
   */
  unloadTool(toolId: string, threadId?: string): boolean {
    const key = threadId ?? GLOBAL_THREAD_KEY;
    const loaded = this.loadedToolsByThread.get(key);
    return loaded?.delete(toolId) ?? false;
  }

  /**
   * Unloads all tools for a thread
   */
  unloadAllTools(threadId?: string): void {
    const key = threadId ?? GLOBAL_THREAD_KEY;
    this.loadedToolsByThread.delete(key);
  }

  /**
   * Gets loaded tool IDs for a thread
   */
  getLoadedToolIds(threadId?: string): string[] {
    const key = threadId ?? GLOBAL_THREAD_KEY;
    const loaded = this.loadedToolsByThread.get(key);
    return loaded ? Array.from(loaded) : [];
  }

  /**
   * Gets all searchable tool IDs
   */
  getToolIds(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Creates the search tool for this thread
   */
  private createSearchTool(threadId?: string): Tool<typeof toolSearchInputSchema, any, any, any, any, string> {
    const toolSearch = this;

    return createTool({
      id: this.searchToolId,
      description: this.searchToolDescription,
      inputSchema: toolSearchInputSchema,
      execute: async (inputData: z.infer<typeof toolSearchInputSchema>, _context?: ToolExecutionContext) => {
        const { query } = inputData;

        const results = await toolSearch.search(query);

        if (results.length === 0) {
          return {
            success: false,
            loadedTools: [],
            message: 'No matching tools found for your query.',
            availableTools: toolSearch.getToolIds(),
            query,
          };
        }

        // Load matching tools
        for (const result of results) {
          toolSearch.loadTool(result.id, threadId);
        }

        return {
          success: true,
          loadedTools: results.map(r => ({
            id: r.id,
            description: r.description,
            score: r.score,
          })),
          message: `Loaded ${results.length} tool(s). You can now call them directly.`,
          query,
        };
      },
    });
  }

  /**
   * Gets tools for an agent: search tool + any loaded tools for this thread
   */
  getTools(threadId?: string): Record<string, ToolAction<any, any, any>> {
    const tools: Record<string, ToolAction<any, any, any>> = {};

    // Add search tool
    tools[this.searchToolId] = this.createSearchTool(threadId);

    // Add loaded tools for this thread
    const key = threadId ?? GLOBAL_THREAD_KEY;
    const loadedIds = this.loadedToolsByThread.get(key);

    if (loadedIds) {
      for (const toolId of loadedIds) {
        const indexed = this.tools.get(toolId);
        if (indexed) {
          tools[toolId] = indexed.tool;
        }
      }
    }

    return tools;
  }
}

/**
 * Creates a tool search instance for on-demand tool loading.
 *
 * All tools passed here are searchable - they're not loaded into the agent's context
 * initially. The agent gets a search tool to discover and load relevant tools on-demand.
 *
 * @example
 * ```typescript
 * import { createToolSearch, createTool } from '@mastra/core/tools';
 *
 * // Define your tools
 * const createPRTool = createTool({
 *   id: 'github.createPR',
 *   description: 'Create a GitHub pull request',
 *   execute: async () => { ... },
 * });
 *
 * const sendMessageTool = createTool({
 *   id: 'slack.sendMessage',
 *   description: 'Send a Slack message',
 *   execute: async () => { ... },
 * });
 *
 * // Create with BM25 search (default, no embedder needed)
 * const toolSearch = await createToolSearch({
 *   tools: { createPRTool, sendMessageTool },
 *   method: 'bm25',
 * });
 *
 * // Or with regex search
 * const toolSearch = await createToolSearch({
 *   tools: { createPRTool, sendMessageTool },
 *   method: 'regex',
 * });
 *
 * // Or with embedding search
 * const toolSearch = await createToolSearch({
 *   tools: { createPRTool, sendMessageTool },
 *   method: 'embedding',
 *   embedder: openai.embedding('text-embedding-3-small'),
 * });
 *
 * // Use with an agent - combine with always-loaded tools
 * const agent = new Agent({
 *   tools: { helpTool }, // Always loaded
 * });
 *
 * const response = await agent.generate('Create a GitHub PR', {
 *   toolsets: {
 *     searchable: toolSearch.getTools(threadId), // Searchable tools
 *   },
 * });
 * ```
 */
export async function createToolSearch(config: ToolSearchConfig): Promise<ToolSearch> {
  const toolSearch = new ToolSearch(config);
  await toolSearch.indexTools(config.tools);
  return toolSearch;
}
