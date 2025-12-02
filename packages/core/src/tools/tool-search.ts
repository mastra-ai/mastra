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
 * Configuration for creating a tool search index
 */
export interface ToolSearchIndexConfig {
  /** The embedding model to use for creating tool embeddings */
  embedder: MastraEmbeddingModel<string>;
  /** Optional: Custom function to generate search text from a tool */
  getSearchText?: (tool: ToolAction<any, any, any>, id: string) => string;
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

/**
 * ToolSearchIndex provides semantic search over a collection of tools.
 *
 * It creates embeddings for tool descriptions and allows searching for
 * relevant tools based on natural language queries.
 *
 * @example
 * ```typescript
 * import { ToolSearchIndex } from '@mastra/core/tools';
 * import { openai } from '@ai-sdk/openai';
 *
 * const searchIndex = new ToolSearchIndex({
 *   embedder: openai.embedding('text-embedding-3-small'),
 * });
 *
 * // Index your tools
 * await searchIndex.index({
 *   calculator: calculatorTool,
 *   weather: weatherTool,
 *   sendEmail: sendEmailTool,
 * });
 *
 * // Search for relevant tools
 * const results = await searchIndex.search('I need to do some math');
 * // Returns: [{ id: 'calculator', score: 0.92, tool: calculatorTool, ... }]
 * ```
 */
export class ToolSearchIndex {
  private embedder: MastraEmbeddingModel<string>;
  private getSearchText: (tool: ToolAction<any, any, any>, id: string) => string;
  private indexedTools: Map<string, IndexedTool> = new Map();

  constructor(config: ToolSearchIndexConfig) {
    this.embedder = config.embedder;
    this.getSearchText = config.getSearchText ?? defaultGetSearchText;
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
   * Indexes a collection of tools for semantic search.
   *
   * @param tools - Record of tool ID to tool instance
   * @returns Promise that resolves when indexing is complete
   *
   * @example
   * ```typescript
   * await searchIndex.index({
   *   myTool: createTool({ id: 'myTool', description: 'Does something', execute: async () => {} }),
   * });
   * ```
   */
  async index(tools: Record<string, ToolAction<any, any, any>>): Promise<void> {
    const entries = Object.entries(tools);

    // Create embeddings in parallel for efficiency
    const embeddings = await Promise.all(
      entries.map(async ([id, tool]) => {
        const searchText = this.getSearchText(tool, id);
        const embedding = await this.embed(searchText);
        return { id, embedding };
      }),
    );

    // Store indexed tools
    for (let i = 0; i < entries.length; i++) {
      const [id, tool] = entries[i]!;
      const { embedding } = embeddings[i]!;

      this.indexedTools.set(id, {
        id,
        description: tool.description,
        embedding,
        tool,
      });
    }
  }

  /**
   * Adds a single tool to the index.
   *
   * @param id - The tool identifier
   * @param tool - The tool to index
   */
  async add(id: string, tool: ToolAction<any, any, any>): Promise<void> {
    const searchText = this.getSearchText(tool, id);
    const embedding = await this.embed(searchText);

    this.indexedTools.set(id, {
      id,
      description: tool.description,
      embedding,
      tool,
    });
  }

  /**
   * Removes a tool from the index.
   *
   * @param id - The tool identifier to remove
   */
  remove(id: string): boolean {
    return this.indexedTools.delete(id);
  }

  /**
   * Clears all indexed tools.
   */
  clear(): void {
    this.indexedTools.clear();
  }

  /**
   * Gets the number of indexed tools.
   */
  get size(): number {
    return this.indexedTools.size;
  }

  /**
   * Checks if a tool is indexed.
   */
  has(id: string): boolean {
    return this.indexedTools.has(id);
  }

  /**
   * Gets a tool by ID.
   */
  get(id: string): ToolAction<any, any, any> | undefined {
    return this.indexedTools.get(id)?.tool;
  }

  /**
   * Lists all indexed tool IDs.
   */
  listToolIds(): string[] {
    return Array.from(this.indexedTools.keys());
  }

  /**
   * Searches for tools that match the given query.
   *
   * @param query - Natural language query describing what you need
   * @param options - Search options
   * @returns Array of matching tools sorted by relevance
   *
   * @example
   * ```typescript
   * const results = await searchIndex.search('send an email notification', {
   *   topK: 3,
   *   minScore: 0.5,
   * });
   * ```
   */
  async search(query: string, options: ToolSearchOptions = {}): Promise<ToolSearchResult[]> {
    const { topK = 5, minScore = 0 } = options;

    if (this.indexedTools.size === 0) {
      return [];
    }

    // Embed the query
    const queryEmbedding = await this.embed(query);

    // Compute similarity scores
    const results: ToolSearchResult[] = [];

    for (const indexed of this.indexedTools.values()) {
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

    // Sort by score descending and limit to topK
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }
}

/**
 * Configuration for creating a tool search tool
 */
export interface CreateToolSearchToolConfig {
  /** The tool search index to use */
  searchIndex: ToolSearchIndex;
  /** Whether to automatically execute the best matching tool */
  autoExecute?: boolean;
  /** Maximum number of tools to return in search results */
  topK?: number;
  /** Minimum similarity score to consider a match */
  minScore?: number;
  /** Custom tool ID (defaults to 'tool_search') */
  id?: string;
  /** Custom tool description */
  description?: string;
}

/**
 * Schema for the tool search input when not auto-executing
 */
const toolSearchInputSchema = z.object({
  query: z.string().describe('Natural language description of what you need to accomplish'),
});

/**
 * Schema for the tool search input when auto-executing
 */
const toolSearchExecuteInputSchema = z.object({
  query: z.string().describe('Natural language description of what you need to accomplish'),
  toolInput: z.record(z.any()).optional().describe('Input to pass to the selected tool if auto-executing'),
});

/**
 * Creates a meta-tool that can search through available tools and find the most relevant one.
 *
 * This allows agents to have access to many tools without overwhelming the context window.
 * Instead of passing all tools directly, you register them with a search index and give
 * the agent this single tool to find and optionally execute the right tool.
 *
 * @example Search only - returns matching tools
 * ```typescript
 * import { ToolSearchIndex, createToolSearchTool } from '@mastra/core/tools';
 * import { openai } from '@ai-sdk/openai';
 *
 * const searchIndex = new ToolSearchIndex({
 *   embedder: openai.embedding('text-embedding-3-small'),
 * });
 *
 * await searchIndex.index({
 *   calculator: calculatorTool,
 *   weather: weatherTool,
 *   sendEmail: sendEmailTool,
 *   // ... many more tools
 * });
 *
 * const toolSearchTool = createToolSearchTool({
 *   searchIndex,
 *   topK: 3,
 * });
 *
 * // Give the agent only the search tool
 * const agent = new Agent({
 *   tools: { toolSearch: toolSearchTool },
 *   // ...
 * });
 * ```
 *
 * @example Auto-execute - finds and runs the best matching tool
 * ```typescript
 * const toolSearchTool = createToolSearchTool({
 *   searchIndex,
 *   autoExecute: true,
 *   minScore: 0.7, // Only execute if confident
 * });
 * ```
 */
export function createToolSearchTool(
  config: CreateToolSearchToolConfig,
): Tool<typeof toolSearchInputSchema | typeof toolSearchExecuteInputSchema, any, any, any, any, string> {
  const {
    searchIndex,
    autoExecute = false,
    topK = 5,
    minScore = 0.3,
    id = 'tool_search',
    description = autoExecute
      ? 'Search for and execute the most appropriate tool based on what you need to accomplish. Describe your task and optionally provide input for the tool.'
      : 'Search for available tools based on what you need to accomplish. Returns a list of relevant tools with their descriptions.',
  } = config;

  if (autoExecute) {
    return createTool({
      id,
      description,
      inputSchema: toolSearchExecuteInputSchema,
      execute: async (
        inputData: z.infer<typeof toolSearchExecuteInputSchema>,
        context?: ToolExecutionContext,
      ): Promise<any> => {
        const { query, toolInput } = inputData;

        // Search for matching tools
        const results = await searchIndex.search(query, { topK: 1, minScore });

        if (results.length === 0) {
          return {
            success: false,
            error: 'No matching tool found',
            query,
            suggestion: `Available tools: ${searchIndex.listToolIds().join(', ')}`,
          };
        }

        const bestMatch = results[0]!;

        // Execute the best matching tool
        const tool = bestMatch.tool;

        if (!tool.execute) {
          return {
            success: false,
            error: `Tool "${bestMatch.id}" does not have an execute function`,
            matchedTool: {
              id: bestMatch.id,
              description: bestMatch.description,
              score: bestMatch.score,
            },
          };
        }

        try {
          const result = await tool.execute(toolInput ?? {}, context);
          return {
            success: true,
            executedTool: {
              id: bestMatch.id,
              description: bestMatch.description,
              score: bestMatch.score,
            },
            result,
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error executing tool',
            executedTool: {
              id: bestMatch.id,
              description: bestMatch.description,
              score: bestMatch.score,
            },
          };
        }
      },
    });
  }

  // Search-only mode
  return createTool({
    id,
    description,
    inputSchema: toolSearchInputSchema,
    execute: async (inputData: z.infer<typeof toolSearchInputSchema>): Promise<any> => {
      const { query } = inputData;

      // Search for matching tools
      const results = await searchIndex.search(query, { topK, minScore });

      if (results.length === 0) {
        return {
          matchingTools: [],
          query,
          suggestion: `No tools matched your query. Available tools: ${searchIndex.listToolIds().join(', ')}`,
        };
      }

      return {
        matchingTools: results.map(r => ({
          id: r.id,
          description: r.description,
          score: r.score,
          // Include input schema info if available
          inputSchema: r.tool.inputSchema
            ? {
                type: 'object',
                // Try to extract field names for reference
                fields: (() => {
                  try {
                    const shape = (r.tool.inputSchema as any)._def?.shape?.();
                    return shape ? Object.keys(shape) : undefined;
                  } catch {
                    return undefined;
                  }
                })(),
              }
            : undefined,
        })),
        query,
        hint: 'To use a tool, call it directly with the appropriate parameters',
      };
    },
  });
}

/**
 * Creates a tool search setup with both the index and search tool.
 *
 * This is a convenience function that creates both the search index and the search tool
 * in one step, making it easy to get started with tool search.
 *
 * @example
 * ```typescript
 * import { createToolSearch } from '@mastra/core/tools';
 * import { openai } from '@ai-sdk/openai';
 *
 * const { searchIndex, searchTool, indexTools } = createToolSearch({
 *   embedder: openai.embedding('text-embedding-3-small'),
 * });
 *
 * // Index your tools
 * await indexTools({
 *   calculator: calculatorTool,
 *   weather: weatherTool,
 * });
 *
 * // Use the search tool with an agent
 * const agent = new Agent({
 *   tools: { toolSearch: searchTool },
 *   // ...
 * });
 * ```
 */
export function createToolSearch(config: ToolSearchIndexConfig & Omit<CreateToolSearchToolConfig, 'searchIndex'>): {
  /** The search index for managing indexed tools */
  searchIndex: ToolSearchIndex;
  /** The search tool to give to agents */
  searchTool: ReturnType<typeof createToolSearchTool>;
  /** Convenience function to index tools */
  indexTools: (tools: Record<string, ToolAction<any, any, any>>) => Promise<void>;
} {
  const { embedder, getSearchText, ...toolConfig } = config;

  const searchIndex = new ToolSearchIndex({ embedder, getSearchText });
  const searchTool = createToolSearchTool({ searchIndex, ...toolConfig });

  return {
    searchIndex,
    searchTool,
    indexTools: (tools: Record<string, ToolAction<any, any, any>>) => searchIndex.index(tools),
  };
}
