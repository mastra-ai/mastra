import type { MastraKnowledge, KnowledgeSearchResult } from '@mastra/core/knowledge';
import { BaseProcessor } from '@mastra/core/processors';
import type { ProcessInputArgs, ProcessInputResult, ProcessInputStepArgs } from '@mastra/core/processors';
import { createTool } from '@mastra/core/tools';
import z from 'zod';

import { extractLines } from '../bm25';
import type { Knowledge, SearchOptions } from '../knowledge';
import type { SearchMode } from '../search-engine';

/**
 * Options for the RetrievedKnowledge processor
 */
export interface RetrievedKnowledgeOptions {
  /**
   * Knowledge source - either:
   * - A Knowledge instance to search directly
   * - Omit to inherit from Mastra at runtime (requires agent to be registered with Mastra)
   */
  knowledge?: Knowledge | MastraKnowledge;

  /**
   * Namespace to search within the knowledge instance.
   * @default 'default'
   */
  namespace?: string;
  /**
   * Maximum number of results to retrieve (default: 3)
   */
  topK?: number;
  /**
   * Minimum similarity score threshold (0-1 for vector, varies for BM25)
   * Results below this score are filtered out
   */
  minScore?: number;
  /**
   * Search mode to use:
   * - 'vector': Semantic similarity search using embeddings
   * - 'bm25': Keyword-based search using BM25 algorithm
   * - 'hybrid': Combine both vector and BM25 scores
   *
   * If not specified, the Knowledge instance will auto-detect based on its configuration.
   */
  mode?: SearchMode;
  /**
   * Hybrid search configuration (only applies when mode is 'hybrid')
   */
  hybrid?: {
    /**
     * Weight for vector similarity score (0-1).
     * BM25 weight is automatically (1 - vectorWeight).
     * @default 0.5
     */
    vectorWeight?: number;
  };
  /**
   * How to format the retrieved knowledge in the system message
   * @default 'xml'
   */
  format?: 'xml' | 'markdown' | 'plain';
  /**
   * Custom formatter function for the retrieved content
   * If provided, overrides the format option
   */
  formatter?: (results: KnowledgeSearchResult[]) => string;
  /**
   * Function to extract the search query from the user's message
   * By default, uses the last user message text
   */
  queryExtractor?: (args: ProcessInputArgs) => string | undefined;
  /**
   * Optional filter to apply to the search (only applies to vector search)
   * Can be a static filter or a function that returns a filter based on runtime context
   */
  filter?: SearchOptions['filter'] | ((args: ProcessInputArgs) => SearchOptions['filter']);
  /**
   * Whether to provide tools for the LLM to search and read knowledge.
   * When true, the processor provides:
   * - knowledge-search: Search for relevant documents
   * - knowledge-read: Read the full content of a document by key
   * - knowledge-list: List available documents in the namespace
   *
   * When false (default), the processor uses automatic retrieval based on the user query.
   * @default false
   */
  provideTools?: boolean;
  /**
   * Whether to also perform automatic retrieval when provideTools is true.
   * This allows combining tool-based retrieval with automatic context injection.
   * @default true when provideTools is false, false when provideTools is true
   */
  autoRetrieve?: boolean;
}

/**
 * RetrievedKnowledge is an input processor that searches indexed knowledge
 * based on the user's query and adds relevant results to the context.
 *
 * Use this for large knowledge bases where you can't inject everything into
 * the system prompt - instead, search for relevant content using vector similarity,
 * BM25 keyword matching, or a hybrid combination of both.
 *
 * @example
 * ```typescript
 * // Vector search (semantic similarity)
 * const knowledge = new Knowledge({
 *   storage: new FilesystemStorage({ paths: './docs' }),
 *   index: {
 *     vectorStore: myVectorStore,
 *     embedder: async (text) => embed(text),
 *     indexName: 'docs',
 *   },
 * });
 *
 * const processor = new RetrievedKnowledge({
 *   knowledge,
 *   topK: 3,
 *   minScore: 0.7,
 *   mode: 'vector', // explicit vector search
 * });
 *
 * // BM25 keyword search
 * const knowledge = new Knowledge({
 *   storage: new FilesystemStorage({ paths: './docs' }),
 *   bm25: true, // enable BM25
 * });
 *
 * const processor = new RetrievedKnowledge({
 *   knowledge,
 *   topK: 5,
 *   mode: 'bm25',
 * });
 *
 * // Hybrid search (combines vector + BM25)
 * const knowledge = new Knowledge({
 *   storage: new FilesystemStorage({ paths: './docs' }),
 *   index: { vectorStore, embedder, indexName: 'docs' },
 *   bm25: true,
 * });
 *
 * const processor = new RetrievedKnowledge({
 *   knowledge,
 *   topK: 3,
 *   mode: 'hybrid',
 *   hybrid: { vectorWeight: 0.7 }, // 70% vector, 30% BM25
 * });
 *
 * const agent = new Agent({
 *   inputProcessors: [processor],
 *   // ...
 * });
 *
 * // User asks: "How do I reset my password?"
 * // -> Processor searches, finds relevant docs, injects into context
 *
 * // Tool-based retrieval (LLM controls when to search)
 * const toolProcessor = new RetrievedKnowledge({
 *   knowledge,
 *   provideTools: true, // Provides knowledge-search, knowledge-read, knowledge-list tools
 *   autoRetrieve: false, // Don't auto-inject, let LLM decide when to search
 * });
 *
 * const agent = new Agent({
 *   inputProcessors: [toolProcessor],
 *   // ...
 * });
 *
 * // User asks: "What's the refund policy?"
 * // -> LLM uses knowledge-search tool to find relevant docs
 * // -> LLM uses knowledge-read tool to get full content
 * ```
 */
export class RetrievedKnowledge extends BaseProcessor<'retrieved-knowledge'> {
  readonly id = 'retrieved-knowledge' as const;
  readonly name = 'RetrievedKnowledge';

  private knowledge?: Knowledge | MastraKnowledge;
  private namespace: string;
  private topK: number;
  private minScore?: number;
  private mode?: SearchMode;
  private hybrid?: { vectorWeight?: number };
  private format: 'xml' | 'markdown' | 'plain';
  private formatter?: (results: KnowledgeSearchResult[]) => string;
  private queryExtractor: (args: ProcessInputArgs) => string | undefined;
  private filter?: SearchOptions['filter'] | ((args: ProcessInputArgs) => SearchOptions['filter']);
  private provideTools: boolean;
  private autoRetrieve: boolean;

  constructor(options: RetrievedKnowledgeOptions = {}) {
    super();
    this.knowledge = options.knowledge;
    this.namespace = options.namespace ?? 'default';

    this.topK = options.topK ?? 3;
    this.minScore = options.minScore;
    this.mode = options.mode;
    this.hybrid = options.hybrid;
    this.format = options.format ?? 'xml';
    this.formatter = options.formatter;
    this.queryExtractor = options.queryExtractor ?? this.defaultQueryExtractor;
    this.filter = options.filter;
    this.provideTools = options.provideTools ?? false;
    // Default autoRetrieve to true when not providing tools, false when providing tools
    this.autoRetrieve = options.autoRetrieve ?? !this.provideTools;
  }

  /**
   * Get the knowledge instance.
   * If knowledge was not provided, attempts to inherit from the registered Mastra instance.
   * @throws Error if knowledge cannot be resolved
   */
  private getKnowledgeInstance(): Knowledge | MastraKnowledge {
    // If knowledge was provided directly, use it
    if (this.knowledge) {
      return this.knowledge;
    }

    // Try to inherit from the registered Mastra instance
    if (this.mastra?.getKnowledge) {
      const inherited = this.mastra.getKnowledge();
      if (inherited) {
        return inherited;
      }
    }

    throw new Error(
      'No knowledge instance available. Either pass a knowledge instance to the processor, ' +
        'or register a knowledge instance with Mastra.',
    );
  }

  /**
   * Default query extractor - gets the last user message text
   */
  private defaultQueryExtractor(args: ProcessInputArgs): string | undefined {
    const { messages } = args;

    // Find the last user message
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg?.role === 'user') {
        // Extract text content from different formats
        const content = msg.content;

        // Handle string content
        if (typeof content === 'string') {
          return content;
        }

        // Handle array content (AI SDK format)
        if (Array.isArray(content)) {
          const textParts = content
            .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
            .map(part => part.text);
          if (textParts.length > 0) {
            return textParts.join(' ');
          }
        }

        // Handle MastraDBMessage format (content.parts)
        if (content && typeof content === 'object' && 'parts' in content && Array.isArray(content.parts)) {
          const textParts = content.parts
            .filter(
              (part: { type: string; text?: string }): part is { type: 'text'; text: string } => part.type === 'text',
            )
            .map((part: { type: 'text'; text: string }) => part.text);
          if (textParts.length > 0) {
            return textParts.join(' ');
          }
        }
      }
    }

    return undefined;
  }

  /**
   * Process input by searching knowledge and adding relevant results.
   * Only runs if autoRetrieve is enabled.
   * Runs once at the start of generation.
   */
  async processInput(args: ProcessInputArgs): Promise<ProcessInputResult> {
    const { messageList } = args;

    // Skip if autoRetrieve is disabled (e.g., when using tools instead)
    if (!this.autoRetrieve) {
      return messageList;
    }

    // Extract the search query
    const query = this.queryExtractor(args);
    if (!query) {
      // No query to search with, return unchanged
      return messageList;
    }

    // Resolve filter (may be a function)
    const resolvedFilter = typeof this.filter === 'function' ? this.filter(args) : this.filter;

    // Get the knowledge instance (from options or inherited from Mastra)
    const knowledge = this.getKnowledgeInstance();

    // Search knowledge in the specified namespace
    const results = await knowledge.search(this.namespace, query, {
      topK: this.topK,
      minScore: this.minScore,
      filter: resolvedFilter,
      mode: this.mode,
      hybrid: this.hybrid,
    });

    if (results.length === 0) {
      // No results found, return unchanged
      return messageList;
    }

    // Format the retrieved knowledge
    const knowledgeContent = this.formatResults(results);

    // Add as system message
    messageList.addSystem({
      role: 'system',
      content: knowledgeContent,
    });

    return messageList;
  }

  /**
   * Format search results based on the configured format
   */
  private formatResults(results: KnowledgeSearchResult[]): string {
    // Use custom formatter if provided
    if (this.formatter) {
      return this.formatter(results);
    }

    switch (this.format) {
      case 'xml':
        return this.formatAsXml(results);
      case 'markdown':
        return this.formatAsMarkdown(results);
      case 'plain':
      default:
        return this.formatAsPlain(results);
    }
  }

  /**
   * Format results as XML
   */
  private formatAsXml(results: KnowledgeSearchResult[]): string {
    const itemsXml = results
      .map(result => {
        const scoreAttr = ` score="${result.score.toFixed(3)}"`;
        return `  <document key="${result.key}"${scoreAttr}>\n    ${result.content}\n  </document>`;
      })
      .join('\n');

    return `<retrieved_knowledge>\n${itemsXml}\n</retrieved_knowledge>`;
  }

  /**
   * Format results as Markdown
   */
  private formatAsMarkdown(results: KnowledgeSearchResult[]): string {
    const itemsMd = results
      .map(result => {
        return `## ${result.key}\n*Relevance: ${(result.score * 100).toFixed(1)}%*\n\n${result.content}`;
      })
      .join('\n\n---\n\n');

    return `# Retrieved Knowledge\n\n${itemsMd}`;
  }

  /**
   * Format results as plain text
   */
  private formatAsPlain(results: KnowledgeSearchResult[]): string {
    return results
      .map(result => {
        return `[${result.key}] (score: ${result.score.toFixed(3)}):\n${result.content}`;
      })
      .join('\n\n');
  }

  // =========================================================================
  // Tool Creation
  // =========================================================================

  /**
   * Create the knowledge-search tool
   */
  private createKnowledgeSearchTool() {
    const knowledge = this.getKnowledgeInstance();
    const namespace = this.namespace;
    const mode = this.mode;
    const hybrid = this.hybrid;

    return createTool({
      id: 'knowledge-search',
      description:
        'Search the knowledge base for relevant documents. Returns matching documents with relevance scores.',
      inputSchema: z.object({
        query: z.string().describe('The search query'),
        topK: z.number().optional().describe('Maximum number of results to return (default: 5)'),
        minScore: z.number().optional().describe('Minimum relevance score threshold (0-1)'),
      }),
      execute: async ({ query, topK, minScore }) => {
        const results = await knowledge.search(namespace, query, {
          topK: topK ?? 5,
          minScore,
          mode,
          hybrid,
        });

        if (results.length === 0) {
          return {
            success: true,
            message: 'No matching documents found',
            results: [],
          };
        }

        return {
          success: true,
          results: results.map(r => ({
            key: r.key,
            score: r.score,
            preview: r.content.substring(0, 300) + (r.content.length > 300 ? '...' : ''),
            lineRange: r.lineRange,
            metadata: r.metadata,
          })),
        };
      },
    });
  }

  /**
   * Create the knowledge-read tool
   */
  private createKnowledgeReadTool() {
    const knowledge = this.getKnowledgeInstance();
    const namespace = this.namespace;

    return createTool({
      id: 'knowledge-read',
      description:
        'Read content of a document from the knowledge base. Optionally specify line range to read a portion.',
      inputSchema: z.object({
        key: z.string().describe('The document key to read'),
        startLine: z
          .number()
          .optional()
          .describe('Starting line number (1-indexed). If omitted, starts from the beginning.'),
        endLine: z
          .number()
          .optional()
          .describe('Ending line number (1-indexed, inclusive). If omitted, reads to the end.'),
      }),
      execute: async ({ key, startLine, endLine }) => {
        try {
          const fullContent = await knowledge.get(namespace, key);

          // Extract lines if range specified
          const result = extractLines(fullContent, startLine, endLine);

          return {
            success: true,
            key,
            content: result.content,
            lines: result.lines,
            totalLines: result.totalLines,
          };
        } catch {
          return {
            success: false,
            message: `Document "${key}" not found in namespace "${namespace}"`,
          };
        }
      },
    });
  }

  /**
   * Create the knowledge-list tool
   */
  private createKnowledgeListTool() {
    const knowledge = this.getKnowledgeInstance();
    const namespace = this.namespace;

    return createTool({
      id: 'knowledge-list',
      description: 'List available documents in the knowledge base. Optionally filter by prefix.',
      inputSchema: z.object({
        prefix: z.string().optional().describe('Optional prefix to filter documents'),
      }),
      execute: async ({ prefix }) => {
        const keys = await knowledge.list(namespace, prefix);

        return {
          success: true,
          namespace,
          count: keys.length,
          documents: keys,
        };
      },
    });
  }

  // =========================================================================
  // Step-based Processing (for tools only)
  // =========================================================================

  /**
   * Process input step - provide knowledge tools if enabled.
   * Only runs when provideTools is true.
   * Auto-retrieval is handled by processInput (runs once at start).
   */
  async processInputStep({ messageList, tools }: ProcessInputStepArgs) {
    // Only provide tools if provideTools is enabled
    if (!this.provideTools) {
      return { messageList };
    }

    // Typed as Record<string, unknown> to match ProcessInputStepResult
    const resultTools: Record<string, unknown> = {};

    resultTools['knowledge-search'] = this.createKnowledgeSearchTool();
    resultTools['knowledge-read'] = this.createKnowledgeReadTool();
    resultTools['knowledge-list'] = this.createKnowledgeListTool();

    // Add instruction about available knowledge tools
    messageList.addSystem({
      role: 'system',
      content: `<knowledge_tools>
You have access to a knowledge base via tools:
- knowledge-search: Search for relevant documents
- knowledge-read: Read the full content of a document by key
- knowledge-list: List available documents

Use these tools to find and retrieve information when needed.
</knowledge_tools>`,
    });

    return {
      messageList,
      tools: {
        ...tools,
        ...resultTools,
      },
    };
  }
}
