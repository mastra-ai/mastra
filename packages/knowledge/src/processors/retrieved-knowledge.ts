import type { Processor, ProcessInputArgs, ProcessInputResult } from '@mastra/core/processors';

import type { Knowledge, KnowledgeSearchResult, SearchOptions } from '../knowledge';

/**
 * Options for the RetrievedKnowledge processor
 */
export interface RetrievedKnowledgeOptions {
  /** Knowledge instance to search */
  knowledge: Knowledge;
  /**
   * Maximum number of results to retrieve (default: 3)
   */
  topK?: number;
  /**
   * Minimum similarity score threshold (0-1)
   * Results below this score are filtered out
   */
  minScore?: number;
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
   * Optional filter to apply to the search
   * Can be a static filter or a function that returns a filter based on runtime context
   */
  filter?: SearchOptions['filter'] | ((args: ProcessInputArgs) => SearchOptions['filter']);
}

/**
 * RetrievedKnowledge is an input processor that searches indexed knowledge
 * based on the user's query and adds relevant results to the context.
 *
 * Use this for large knowledge bases where you can't inject everything into
 * the system prompt - instead, semantically search for relevant content.
 *
 * @example
 * ```typescript
 * const knowledge = new Knowledge({
 *   storage: new FilesystemStorage({ namespace: './docs' }),
 *   index: {
 *     vectorStore: myVectorStore,
 *     embedder: async (text) => embed(text),
 *     indexName: 'docs',
 *   },
 * });
 *
 * // Add documents (they get indexed automatically)
 * await knowledge.add({
 *   type: 'text',
 *   key: 'docs/password-reset.txt',
 *   content: 'To reset your password, go to Settings > Security...',
 * });
 *
 * const processor = new RetrievedKnowledge({
 *   knowledge,
 *   topK: 3,
 *   minScore: 0.7,
 * });
 *
 * const agent = new Agent({
 *   inputProcessors: [processor],
 *   // ...
 * });
 *
 * // User asks: "How do I reset my password?"
 * // -> Processor searches index, finds relevant docs, injects into context
 * ```
 */
export class RetrievedKnowledge implements Processor {
  readonly id = 'retrieved-knowledge';
  readonly name = 'RetrievedKnowledge';

  private knowledge: Knowledge;
  private topK: number;
  private minScore?: number;
  private format: 'xml' | 'markdown' | 'plain';
  private formatter?: (results: KnowledgeSearchResult[]) => string;
  private queryExtractor: (args: ProcessInputArgs) => string | undefined;
  private filter?: SearchOptions['filter'] | ((args: ProcessInputArgs) => SearchOptions['filter']);

  constructor(options: RetrievedKnowledgeOptions) {
    this.knowledge = options.knowledge;
    this.topK = options.topK ?? 3;
    this.minScore = options.minScore;
    this.format = options.format ?? 'xml';
    this.formatter = options.formatter;
    this.queryExtractor = options.queryExtractor ?? this.defaultQueryExtractor;
    this.filter = options.filter;
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

    // Search knowledge
    const results = await this.knowledge.search(query, {
      topK: this.topK,
      minScore: this.minScore,
      filter: resolvedFilter,
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
