import type { MastraKnowledge, KnowledgeSearchResult } from '@mastra/core/knowledge';
import { BaseProcessor } from '@mastra/core/processors';
import type { ProcessInputArgs, ProcessInputResult } from '@mastra/core/processors';

import type { Knowledge, SearchMode, SearchOptions } from '../knowledge';

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
 *   storage: new FilesystemStorage({ namespace: './docs' }),
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
 *   storage: new FilesystemStorage({ namespace: './docs' }),
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
 *   storage: new FilesystemStorage({ namespace: './docs' }),
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
   * Process input by searching knowledge and adding relevant results
   */
  async processInput(args: ProcessInputArgs): Promise<ProcessInputResult> {
    const { messageList } = args;

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
}
