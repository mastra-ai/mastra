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
 * Tool search instance - pass directly to toolsets
 */
export interface ToolSearchTools extends Record<string, ToolAction<any, any, any>> {
  /** Search for tools matching a query */
  search(query: string): Promise<ToolSearchResult[]>;
  /** Manually load a tool */
  load(toolId: string): boolean;
  /** Reset - mark all tools as deferred again */
  reset(): void;
  /** Get IDs of currently loaded tools */
  loaded(): string[];
  /** Get all available tool IDs */
  available(): string[];
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

const toolSearchInputSchema = z.object({
  query: z.string().describe('Natural language description of the capability or tool you need'),
});

/**
 * Creates a tool search that can be passed directly to toolsets.
 *
 * Returns a dynamic tools object containing the search tool plus any loaded tools.
 * When the search tool finds matches, those tools become available immediately.
 *
 * @example
 * ```typescript
 * import { Agent } from '@mastra/core/agent';
 * import { createToolSearch, createTool } from '@mastra/core/tools';
 *
 * const toolSearch = createToolSearch({
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
 * // Pass toolSearch directly
 * await agent.generate('Create a GitHub PR', {
 *   toolsets: { available: toolSearch },
 * });
 * // Agent calls tool_search → loads github.createPR → calls it
 *
 * // Reset after request
 * toolSearch.reset();
 * ```
 */
export function createToolSearch(config: ToolSearchConfig): ToolSearchTools {
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

  // State
  const indexedTools = new Map<string, IndexedTool>();
  const loadedTools = new Set<string>();
  let embeddingsReady = false;

  // Index tools (sync for regex/bm25, async embeddings done lazily)
  const entries = Object.entries(config.tools);
  for (const [id, tool] of entries) {
    const searchText = getSearchText(tool, id);
    indexedTools.set(id, { id, description: tool.description, searchText, tool });
  }

  // Lazy embedding initialization
  const ensureEmbeddings = async (): Promise<void> => {
    if (method !== 'embedding' || embeddingsReady) return;

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

    const embeddings = await Promise.all(
      Array.from(indexedTools.values()).map(async indexed => ({
        id: indexed.id,
        embedding: await embedText(indexed.searchText),
      })),
    );

    for (const { id, embedding } of embeddings) {
      const indexed = indexedTools.get(id);
      if (indexed) indexed.embedding = embedding;
    }

    embeddingsReady = true;
  };

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
        await ensureEmbeddings();
        const embedText = async (text: string): Promise<number[]> => {
          const isV2 = (embedder as any).specificationVersion === 'v2';
          if (isV2) {
            const result = await embedV2({ model: embedder as any, value: text });
            return result.embedding;
          } else {
            const result = await embed({ model: embedder as any, value: text });
            return result.embedding;
          }
        };
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

  // Create the search tool
  const searchTool: Tool<typeof toolSearchInputSchema, any, any, any, any, string> = createTool({
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
          availableTools: Array.from(indexedTools.keys()),
          query: input.query,
        };
      }

      // Load matching tools
      for (const result of results) {
        loadedTools.add(result.id);
      }

      return {
        success: true,
        loadedTools: results.map(r => ({ id: r.id, description: r.description, score: r.score })),
        message: `Loaded ${results.length} tool(s). You can now call them directly.`,
        query: input.query,
      };
    },
  });

  // Helper methods
  const load = (id: string): boolean => {
    if (!indexedTools.has(id)) return false;
    loadedTools.add(id);
    return true;
  };

  const reset = (): void => {
    loadedTools.clear();
  };

  const loaded = (): string[] => Array.from(loadedTools);

  const available = (): string[] => Array.from(indexedTools.keys());

  // Create a Proxy that returns tools dynamically
  const toolsProxy = new Proxy({} as ToolSearchTools, {
    get(_target, prop: string) {
      // Helper methods
      if (prop === 'search') return search;
      if (prop === 'load') return load;
      if (prop === 'reset') return reset;
      if (prop === 'loaded') return loaded;
      if (prop === 'available') return available;

      // Search tool
      if (prop === toolId) return searchTool;

      // Loaded tools
      if (loadedTools.has(prop)) {
        return indexedTools.get(prop)?.tool;
      }

      return undefined;
    },

    has(_target, prop: string) {
      if (['search', 'load', 'reset', 'loaded', 'available'].includes(prop)) return true;
      if (prop === toolId) return true;
      return loadedTools.has(prop);
    },

    ownKeys() {
      return [toolId, ...loadedTools];
    },

    getOwnPropertyDescriptor(_target, prop: string) {
      if (prop === toolId || loadedTools.has(prop)) {
        return { enumerable: true, configurable: true };
      }
      return undefined;
    },
  });

  return toolsProxy;
}
