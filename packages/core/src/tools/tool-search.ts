import { embed } from '@internal/ai-sdk-v4';
import { embed as embedV2 } from 'ai-v5';
import { z } from 'zod';

import type { MastraEmbeddingModel } from '../vector';

import type { Tool } from './tool';
import { createTool } from './tool';
import type { ToolAction, ToolExecutionContext } from './types';

/**
 * Indexed tool data for search
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
  id: string;
  description: string;
  score: number;
}

/**
 * Search method for tool discovery
 */
export type ToolSearchMethod = 'regex' | 'bm25' | 'embedding';

/**
 * Configuration for createToolSearch
 */
export interface ToolSearchConfig {
  /** Tools to make searchable */
  tools: Record<string, ToolAction<any, any, any>>;
  /** Search method: 'regex', 'bm25', or 'embedding' (default: 'bm25') */
  method?: ToolSearchMethod;
  /** Embedding model (required when method is 'embedding') */
  embedder?: MastraEmbeddingModel<string>;
  /** Custom ID for the search tool (defaults to 'tool_search') */
  id?: string;
  /** Custom description for the search tool */
  description?: string;
  /** Maximum number of tools to return (defaults to 5) */
  topK?: number;
  /** Minimum score threshold (defaults to 0.3 for embedding, 0 for others) */
  minScore?: number;
}

/**
 * A callable tool search that returns tools for use with Agent toolsets.
 * Call it with an optional threadId to get the search tool plus any loaded tools.
 */
export interface ToolSearch {
  /** Get tools for a thread. Returns search tool + any loaded tools. */
  (threadId?: string): Record<string, ToolAction<any, any, any>>;

  /** Search for tools matching a query */
  search(query: string): Promise<ToolSearchResult[]>;

  /** Manually load a tool for a thread */
  loadTool(toolId: string, threadId?: string): boolean;

  /** Unload a tool from a thread */
  unloadTool(toolId: string, threadId?: string): boolean;

  /** Unload all tools for a thread */
  unloadAll(threadId?: string): void;

  /** Get IDs of loaded tools for a thread */
  getLoadedToolIds(threadId?: string): string[];

  /** Get all available tool IDs */
  getToolIds(): string[];
}

// ============================================================================
// Search Implementations
// ============================================================================

function regexSearch(query: string, tools: Map<string, IndexedTool>, topK: number): ToolSearchResult[] {
  const results: ToolSearchResult[] = [];
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(escapedQuery, 'i');

  for (const indexed of tools.values()) {
    if (pattern.test(indexed.searchText)) {
      const matchIndex = indexed.searchText.toLowerCase().indexOf(query.toLowerCase());
      const positionScore = matchIndex >= 0 ? 1 - matchIndex / indexed.searchText.length : 0;
      const lengthScore = query.length / indexed.searchText.length;
      results.push({
        id: indexed.id,
        description: indexed.description,
        score: Math.min(1, (positionScore + lengthScore) / 2),
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, topK);
}

function bm25Search(
  query: string,
  tools: Map<string, IndexedTool>,
  topK: number,
  k1 = 1.5,
  b = 0.75,
): ToolSearchResult[] {
  const results: ToolSearchResult[] = [];
  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) return [];

  let totalLength = 0;
  for (const indexed of tools.values()) {
    totalLength += tokenize(indexed.searchText).length;
  }
  const avgDocLength = totalLength / tools.size || 1;

  const idf: Record<string, number> = {};
  for (const term of queryTerms) {
    let docCount = 0;
    for (const indexed of tools.values()) {
      if (indexed.searchText.toLowerCase().includes(term)) docCount++;
    }
    idf[term] = Math.log((tools.size - docCount + 0.5) / (docCount + 0.5) + 1);
  }

  for (const indexed of tools.values()) {
    const docTerms = tokenize(indexed.searchText);
    const termFreq: Record<string, number> = {};
    for (const term of docTerms) {
      termFreq[term] = (termFreq[term] || 0) + 1;
    }

    let score = 0;
    for (const term of queryTerms) {
      const tf = termFreq[term] || 0;
      if (tf > 0) {
        const numerator = tf * (k1 + 1);
        const denominator = tf + k1 * (1 - b + b * (docTerms.length / avgDocLength));
        score += (idf[term] || 0) * (numerator / denominator);
      }
    }

    if (score > 0) {
      results.push({ id: indexed.id, description: indexed.description, score });
    }
  }

  const maxScore = Math.max(...results.map(r => r.score), 1);
  for (const result of results) {
    result.score = result.score / maxScore;
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, topK);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(term => term.length > 1);
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0,
    normA = 0,
    normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

function getSearchText(tool: ToolAction<any, any, any>, id: string): string {
  const parts = [id, tool.description];
  if (tool.inputSchema) {
    try {
      const shape = (tool.inputSchema as any)._def?.shape?.();
      if (shape) parts.push(`Parameters: ${Object.keys(shape).join(', ')}`);
    } catch {
      /* ignore */
    }
  }
  return parts.filter(Boolean).join('. ');
}

const GLOBAL_THREAD_KEY = '__global__';

const toolSearchInputSchema = z.object({
  query: z.string().describe('Natural language description of the capability or tool you need'),
});

/**
 * Creates a tool search for on-demand tool loading.
 *
 * Returns a callable that provides tools for use with Agent toolsets.
 * The search tool finds matching tools and loads them for subsequent turns.
 *
 * @example
 * ```typescript
 * import { Agent } from '@mastra/core/agent';
 * import { createToolSearch, createTool } from '@mastra/core/tools';
 *
 * const toolSearch = await createToolSearch({
 *   tools: {
 *     'github.createPR': createPRTool,
 *     'slack.send': slackTool,
 *     // ... 100+ more tools
 *   },
 *   method: 'bm25',
 * });
 *
 * const agent = new Agent({
 *   name: 'Assistant',
 *   model: 'openai/gpt-4o',
 * });
 *
 * // Pass toolSearch() to get current tools (search tool + any loaded tools)
 * let response = await agent.generate('Create a GitHub PR', {
 *   toolsets: { available: toolSearch(threadId) },
 * });
 * // Agent calls tool_search, which loads github.createPR
 *
 * // Next turn: loaded tools are now available
 * response = await agent.generate('OK, now create it', {
 *   toolsets: { available: toolSearch(threadId) },
 * });
 * // Agent can now call github.createPR directly
 * ```
 */
export async function createToolSearch(config: ToolSearchConfig): Promise<ToolSearch> {
  const method = config.method ?? 'bm25';
  const embedder = config.embedder;
  const topK = config.topK ?? 5;
  const minScore = config.minScore ?? (method === 'embedding' ? 0.3 : 0);
  const toolId = config.id ?? 'tool_search';
  const toolDescription =
    config.description ??
    'Search for available tools based on what you need to accomplish. Found tools will be loaded and available for use.';

  if (method === 'embedding' && !embedder) {
    throw new Error('Embedder is required when using embedding search method');
  }

  // Index all tools
  const indexedTools = new Map<string, IndexedTool>();
  const loadedToolsByThread = new Map<string, Set<string>>();

  const embedText = async (text: string): Promise<number[]> => {
    if (!embedder) throw new Error('Embedder not configured');
    const isV2 = (embedder as any).specificationVersion === 'v2';
    if (isV2) {
      const result = await embedV2({ model: embedder as any, value: text });
      return result.embedding;
    } else {
      const result = await embed({ model: embedder as any, value: text });
      return result.embedding;
    }
  };

  // Index tools
  const entries = Object.entries(config.tools);
  if (method === 'embedding') {
    const embeddings = await Promise.all(
      entries.map(async ([id, tool]) => {
        const searchText = getSearchText(tool, id);
        const embedding = await embedText(searchText);
        return { id, searchText, embedding };
      }),
    );
    for (let i = 0; i < entries.length; i++) {
      const [id, tool] = entries[i]!;
      const { searchText, embedding } = embeddings[i]!;
      indexedTools.set(id, { id, description: tool.description, searchText, embedding, tool });
    }
  } else {
    for (const [id, tool] of entries) {
      const searchText = getSearchText(tool, id);
      indexedTools.set(id, { id, description: tool.description, searchText, tool });
    }
  }

  // Search function
  const search = async (query: string): Promise<ToolSearchResult[]> => {
    if (indexedTools.size === 0) return [];

    let results: ToolSearchResult[];
    switch (method) {
      case 'regex':
        results = regexSearch(query, indexedTools, topK);
        break;
      case 'bm25':
        results = bm25Search(query, indexedTools, topK);
        break;
      case 'embedding': {
        const queryEmbedding = await embedText(query);
        results = [];
        for (const indexed of indexedTools.values()) {
          if (indexed.embedding) {
            const score = cosineSimilarity(queryEmbedding, indexed.embedding);
            if (score >= minScore) {
              results.push({ id: indexed.id, description: indexed.description, score });
            }
          }
        }
        results.sort((a, b) => b.score - a.score);
        results = results.slice(0, topK);
        break;
      }
    }

    if (method !== 'embedding' && minScore > 0) {
      results = results.filter(r => r.score >= minScore);
    }

    return results;
  };

  // Load tool for a thread
  const loadTool = (id: string, threadId?: string): boolean => {
    if (!indexedTools.has(id)) return false;
    const key = threadId ?? GLOBAL_THREAD_KEY;
    let loaded = loadedToolsByThread.get(key);
    if (!loaded) {
      loaded = new Set();
      loadedToolsByThread.set(key, loaded);
    }
    loaded.add(id);
    return true;
  };

  // Unload tool from a thread
  const unloadTool = (id: string, threadId?: string): boolean => {
    const key = threadId ?? GLOBAL_THREAD_KEY;
    const loaded = loadedToolsByThread.get(key);
    return loaded?.delete(id) ?? false;
  };

  // Unload all tools for a thread
  const unloadAll = (threadId?: string): void => {
    const key = threadId ?? GLOBAL_THREAD_KEY;
    loadedToolsByThread.delete(key);
  };

  // Get loaded tool IDs for a thread
  const getLoadedToolIds = (threadId?: string): string[] => {
    const key = threadId ?? GLOBAL_THREAD_KEY;
    const loaded = loadedToolsByThread.get(key);
    return loaded ? Array.from(loaded) : [];
  };

  // Get all available tool IDs
  const getToolIds = (): string[] => Array.from(indexedTools.keys());

  // Create search tool for a specific thread
  const createSearchTool = (threadId?: string): Tool<typeof toolSearchInputSchema, any, any, any, any, string> => {
    return createTool({
      id: toolId,
      description: toolDescription,
      inputSchema: toolSearchInputSchema,
      execute: async (input: z.infer<typeof toolSearchInputSchema>, _context?: ToolExecutionContext) => {
        const results = await search(input.query);

        if (results.length === 0) {
          return {
            success: false,
            loadedTools: [],
            message: 'No matching tools found for your query.',
            availableTools: getToolIds(),
            query: input.query,
          };
        }

        // Load matching tools for this thread
        for (const result of results) {
          loadTool(result.id, threadId);
        }

        return {
          success: true,
          loadedTools: results.map(r => ({ id: r.id, description: r.description, score: r.score })),
          message: `Loaded ${results.length} tool(s). You can now call them directly.`,
          query: input.query,
        };
      },
    });
  };

  // Get tools for a thread (search tool + loaded tools)
  const getTools = (threadId?: string): Record<string, ToolAction<any, any, any>> => {
    const tools: Record<string, ToolAction<any, any, any>> = {};

    // Add search tool
    tools[toolId] = createSearchTool(threadId);

    // Add loaded tools for this thread
    const key = threadId ?? GLOBAL_THREAD_KEY;
    const loadedIds = loadedToolsByThread.get(key);
    if (loadedIds) {
      for (const id of loadedIds) {
        const indexed = indexedTools.get(id);
        if (indexed) {
          tools[id] = indexed.tool;
        }
      }
    }

    return tools;
  };

  // Create the callable ToolSearch
  const toolSearch = ((threadId?: string) => getTools(threadId)) as ToolSearch;
  toolSearch.search = search;
  toolSearch.loadTool = loadTool;
  toolSearch.unloadTool = unloadTool;
  toolSearch.unloadAll = unloadAll;
  toolSearch.getLoadedToolIds = getLoadedToolIds;
  toolSearch.getToolIds = getToolIds;

  return toolSearch;
}
