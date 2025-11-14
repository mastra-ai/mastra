import type { MessageList } from '@mastra/core/agent';
import type { IMastraLogger } from '@mastra/core/logger';
import { parseMemoryRuntimeContext } from '@mastra/core/memory';
import type { MastraDBMessage } from '@mastra/core/memory';
import type { TracingContext } from '@mastra/core/observability';
import type { Processor } from '@mastra/core/processors';
import type { RequestContext } from '@mastra/core/request-context';
import type { MemoryStorage } from '@mastra/core/storage';
import type { MastraEmbeddingModel, MastraVector } from '@mastra/core/vector';
import type { SystemModelMessage } from 'ai-v5';
import { LRUCache } from 'lru-cache';
import xxhash from 'xxhash-wasm';

const DEFAULT_TOP_K = 4;
const DEFAULT_MESSAGE_RANGE = 1; // Will be used for both before and after
const DEFAULT_CACHE_MAX_SIZE = 1000; // Maximum number of cached embeddings

export interface SemanticRecallOptions {
  /**
   * Storage instance for retrieving messages
   */
  storage: MemoryStorage;

  /**
   * Vector store for semantic search
   */
  vector: MastraVector;

  /**
   * Embedder for generating query embeddings
   */
  embedder: MastraEmbeddingModel<string>;

  /**
   * Number of most similar messages to retrieve
   * @default 5
   */
  topK?: number;

  /**
   * Number of context messages to include before/after each match
   * Can be a number (same for before/after) or an object with before/after
   * @default 2
   */
  messageRange?: number | { before: number; after: number };

  /**
   * Scope of semantic search
   * - 'thread': Search within the current thread only
   * - 'resource': Search across all threads for the resource
   * @default 'resource'
   */
  scope?: 'thread' | 'resource';

  /**
   * Minimum similarity score threshold (0-1)
   * Messages below this threshold will be filtered out
   */
  threshold?: number;

  /**
   * Index name for the vector store
   * If not provided, will be auto-generated based on embedder model
   */
  indexName?: string;

  /**
   * Optional logger instance for structured logging
   */
  logger?: IMastraLogger;
}

/**
 * SemanticRecall is both an input and output processor that:
 * - On input: performs semantic search on historical messages and adds relevant context
 * - On output: creates embeddings for messages being saved to enable future semantic search
 *
 * It uses vector embeddings to find messages similar to the user's query,
 * then retrieves those messages along with surrounding context.
 *
 * @example
 * ```typescript
 * const processor = new SemanticRecall({
 *   storage: memoryStorage,
 *   vector: vectorStore,
 *   embedder: openaiEmbedder,
 *   topK: 5,
 *   messageRange: 2,
 *   scope: 'resource'
 * });
 *
 * // Use with agent
 * const agent = new Agent({
 *   inputProcessors: [processor],
 *   outputProcessors: [processor]
 * });
 * ```
 */
export class SemanticRecall implements Processor {
  readonly id = 'semantic-recall';
  readonly name = 'SemanticRecall';

  private storage: MemoryStorage;
  private vector: MastraVector;
  private embedder: MastraEmbeddingModel<string>;
  private topK: number;
  private messageRange: { before: number; after: number };
  private scope: 'thread' | 'resource';
  private threshold?: number;
  private indexName?: string;
  private logger?: IMastraLogger;

  // LRU cache for embeddings: contentHash -> embedding vector
  private embeddingCache: LRUCache<string, number[]>;
  
  // xxhash-wasm hasher instance (initialized as a promise)
  private hasher = xxhash();

  constructor(options: SemanticRecallOptions) {
    this.storage = options.storage;
    this.vector = options.vector;
    this.embedder = options.embedder;
    this.topK = options.topK ?? DEFAULT_TOP_K;
    this.scope = options.scope ?? 'resource'; // Default to 'resource' to match main's behavior
    this.threshold = options.threshold;
    this.indexName = options.indexName;
    this.logger = options.logger;

    // Initialize LRU cache for embeddings
    this.embeddingCache = new LRUCache<string, number[]>({
      max: DEFAULT_CACHE_MAX_SIZE,
    });

    // Normalize messageRange to object format
    if (typeof options.messageRange === 'number') {
      this.messageRange = {
        before: options.messageRange,
        after: options.messageRange,
      };
    } else if (options.messageRange) {
      this.messageRange = options.messageRange;
    } else {
      this.messageRange = {
        before: DEFAULT_MESSAGE_RANGE,
        after: DEFAULT_MESSAGE_RANGE,
      };
    }
  }

  async processInput(args: {
    messages: MastraDBMessage[];
    messageList: MessageList;
    abort: (reason?: string) => never;
    tracingContext?: TracingContext;
    runtimeContext?: RequestContext;
  }): Promise<MessageList | MastraDBMessage[]> {
    const { messages, messageList, runtimeContext } = args;

    // Get memory context from RequestContext
    const memoryContext = parseMemoryRuntimeContext(runtimeContext);
    if (!memoryContext) {
      // No memory context available, return messages unchanged
      return messages;
    }

    const { thread, resourceId } = memoryContext;
    const threadId = thread?.id;

    if (!threadId) {
      // No thread ID available, return messages unchanged
      return messages;
    }

    // Extract user query from the last user message
    const userQuery = this.extractUserQuery(messages);
    if (!userQuery) {
      // No user query to search with, return messages unchanged
      return messages;
    }

    try {
      // Perform semantic search
      const similarMessages = await this.performSemanticSearch({
        query: userQuery,
        threadId,
        resourceId,
      });

      if (similarMessages.length === 0) {
        // No similar messages found, return original messages
        return messages;
      }

      // Filter out messages that are already in the input
      const existingIds = new Set(messages.map(m => m.id).filter(Boolean));
      const newMessages = similarMessages.filter(m => !existingIds.has(m.id));

      if (newMessages.length === 0) {
        // All similar messages are already in input, return original messageList
        return messageList;
      }

      // If scope is 'resource', check for cross-thread messages and format them specially
      if (this.scope === 'resource') {
        const crossThreadMessages = newMessages.filter(m => m.threadId && m.threadId !== threadId);
        if (crossThreadMessages.length > 0) {
          // Format cross-thread messages as a system message for context
          const formattedSystemMessage = this.formatCrossThreadMessages(crossThreadMessages);

          // Add cross-thread messages as a context message
          messageList.add([formattedSystemMessage], 'context');

          // Add same-thread messages with 'memory' source
          const sameThreadMessages = newMessages.filter(m => !m.threadId || m.threadId === threadId);
          if (sameThreadMessages.length > 0) {
            messageList.add(sameThreadMessages, 'memory');
          }

          return messageList;
        }
      }

      // Add all recalled messages with 'memory' source
      messageList.add(newMessages, 'memory');
      return messageList;
    } catch (error) {
      // Log error but don't fail the request
      this.logger?.error('[SemanticRecall] Error during semantic search:', { error });
      return messageList;
    }
  }

  /**
   * Format cross-thread messages as a system message with timestamps and labels
   */
  private formatCrossThreadMessages(messages: MastraDBMessage[]): SystemModelMessage {
    // Group messages by date
    const messagesByDate = new Map<string, MastraDBMessage[]>();

    for (const msg of messages) {
      const date = msg.createdAt ? new Date(msg.createdAt).toLocaleDateString() : 'Unknown Date';
      if (!messagesByDate.has(date)) {
        messagesByDate.set(date, []);
      }
      messagesByDate.get(date)!.push(msg);
    }

    // Format messages with timestamps and labels
    const formattedSections: string[] = [];

    for (const [date, msgs] of messagesByDate) {
      const formattedMessages = msgs
        .map(msg => {
          const time = msg.createdAt ? new Date(msg.createdAt).toLocaleTimeString() : '';
          const role = msg.role === 'user' ? 'User' : 'Assistant';
          const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
          return `[${time}] ${role}: ${content}`;
        })
        .join('\n');

      formattedSections.push(`Date: ${date}
${formattedMessages}`);
    }

    const formattedContent = `<remembered_from_other_conversation>
The following messages are from previous conversations with this user. They may provide helpful context:

${formattedSections.join('\n')}
</remembered_from_other_conversation>`;

    return {
      role: 'system',
      content: formattedContent,
    };
  }

  /**
   * Extract the user query from messages for semantic search
   */
  private extractUserQuery(messages: MastraDBMessage[]): string | null {
    // Find the last user message
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (!msg) continue;

      if (msg.role === 'user') {
        // Extract text content from MastraMessageV2
        // First check if there's a content string
        if (typeof msg.content.content === 'string' && msg.content.content !== '') {
          return msg.content.content;
        }

        // Otherwise extract from parts - combine all text parts
        const textParts: string[] = [];
        msg.content.parts?.forEach((part: any) => {
          if (part.type === 'text' && part.text) {
            textParts.push(part.text);
          }
        });
        const textContent = textParts.join(' ');

        if (textContent) {
          return textContent;
        }
      }
    }
    return null;
  }

  /**
   * Perform semantic search using vector embeddings
   */
  private async performSemanticSearch({
    query,
    threadId,
    resourceId,
  }: {
    query: string;
    threadId: string;
    resourceId?: string;
  }): Promise<MastraDBMessage[]> {
    // Generate embeddings for the query
    const { embeddings, dimension } = await this.embedMessageContent(query);

    // Ensure vector index exists
    const indexName = this.indexName || this.getDefaultIndexName();
    await this.ensureVectorIndex(indexName, dimension);

    // Perform vector search for each embedding
    const vectorResults: Array<{
      id: string;
      score: number;
      metadata?: Record<string, any>;
    }> = [];

    for (const embedding of embeddings) {
      const results = await this.vector.query({
        indexName,
        queryVector: embedding,
        topK: this.topK,
        filter: this.scope === 'resource' && resourceId ? { resource_id: resourceId } : { thread_id: threadId },
      });

      vectorResults.push(...results);
    }
    // Filter by threshold if specified
    const filteredResults =
      this.threshold !== undefined ? vectorResults.filter(r => r.score >= this.threshold!) : vectorResults;

    if (filteredResults.length === 0) {
      return [];
    }

    // Retrieve messages with context
    const result = await this.storage.listMessages({
      threadId,
      resourceId,
      include: filteredResults.map(r => ({
        id: r.metadata?.message_id,
        threadId: r.metadata?.thread_id,
        withNextMessages: this.messageRange.after,
        withPreviousMessages: this.messageRange.before,
      })),
      perPage: false, // Fetch all matching messages
    });

    return result.messages;
  }

  /**
   * Generate embeddings for message content
   */
  /**
   * Hash content using xxhash for fast cache key generation
   */
  private async hashContent(content: string): Promise<string> {
    const h = await this.hasher;
    return h.h64(content).toString(16);
  }

  private async embedMessageContent(content: string): Promise<{
    embeddings: number[][];
    dimension: number;
  }> {
    // Check cache first
    const contentHash = await this.hashContent(content);
    const cachedEmbedding = this.embeddingCache.get(contentHash);

    if (cachedEmbedding) {
      return {
        embeddings: [cachedEmbedding],
        dimension: cachedEmbedding.length,
      };
    }

    // Generate embedding if not cached
    const result = await this.embedder.doEmbed({
      values: [content],
    });

    // Cache the first embedding
    if (result.embeddings[0]) {
      this.embeddingCache.set(contentHash, result.embeddings[0]);
    }

    return {
      embeddings: result.embeddings,
      dimension: result.embeddings[0]?.length || 0,
    };
  }

  /**
   * Get default index name based on embedder model
   */
  private getDefaultIndexName(): string {
    const model = this.embedder.modelId || 'default';
    // Sanitize model ID to create valid SQL identifier:
    // - Replace hyphens, periods, and other special chars with underscores
    // - Ensure it starts with a letter or underscore
    // - Limit to 63 characters total
    const sanitizedModel = model.replace(/[^a-zA-Z0-9_]/g, '_');
    const indexName = `mastra_memory_${sanitizedModel}`;
    return indexName.slice(0, 63);
  }

  /**
   * Ensure vector index exists with correct dimensions
   */
  private async ensureVectorIndex(indexName: string, dimension: number): Promise<void> {
    try {
      // Check if index exists
      const indexes = await this.vector.listIndexes();
      const indexExists = indexes.includes(indexName);

      if (!indexExists) {
        // Create index if it doesn't exist
        await this.vector.createIndex({
          indexName,
          dimension,
          metric: 'cosine',
        });
      }
    } catch (error) {
      this.logger?.error('[SemanticRecall] Error ensuring vector index:', { error });
      throw error;
    }
  }

  /**
   * Process output messages to create embeddings for messages being saved
   * This allows semantic recall to index new messages for future retrieval
   */
  async processOutputResult(args: {
    messages: MastraDBMessage[];
    messageList: MessageList;
    abort: (reason?: string) => never;
    tracingContext?: TracingContext;
    runtimeContext?: RequestContext;
  }): Promise<MessageList | MastraDBMessage[]> {
    const { messages, runtimeContext } = args;

    if (!this.vector || !this.embedder || !this.storage) {
      return messages;
    }

    try {
      const memoryContext = parseMemoryRuntimeContext(runtimeContext);

      if (!memoryContext) {
        return messages;
      }

      const { thread, resourceId } = memoryContext;
      const threadId = thread?.id;

      if (!threadId) {
        return messages;
      }

      const indexName = this.indexName || this.getDefaultIndexName();

      // Collect all embeddings first
      const vectors: number[][] = [];
      const ids: string[] = [];
      const metadataList: Record<string, any>[] = [];
      let vectorDimension = 0;

      for (const message of messages) {
        // Skip system messages - they're instructions, not user content
        if (message.role === 'system') {
          continue;
        }

        // Extract text content from the message
        const textContent = this.extractTextContent(message);
        if (!textContent) {
          continue;
        }

        try {
          // Create embedding for the message
          const { embeddings, dimension } = await this.embedMessageContent(textContent);

          if (embeddings.length === 0) {
            continue;
          }

          const embedding = embeddings[0];
          if (!embedding) {
            continue;
          }

          vectors.push(embedding);
          ids.push(message.id);
          metadataList.push({
            message_id: message.id,
            thread_id: threadId,
            resource_id: resourceId || '',
            role: message.role,
            content: textContent,
            created_at: message.createdAt.toISOString(),
          });
          vectorDimension = dimension;
        } catch (error) {
          // Log error but don't fail the entire operation
          this.logger?.error(`[SemanticRecall] Error creating embedding for message ${message.id}:`, { error });
        }
      }

      // If we have embeddings, ensure index exists and upsert them
      if (vectors.length > 0) {
        await this.ensureVectorIndex(indexName, vectorDimension);
        await this.vector.upsert({
          indexName,
          vectors,
          ids,
          metadata: metadataList,
        });
      }
    } catch (error) {
      // Log error but don't fail the entire operation
      this.logger?.error('[SemanticRecall] Error in processOutputResult:', { error });
    }

    return messages;
  }

  /**
   * Extract text content from a MastraDBMessage
   */
  private extractTextContent(message: MastraDBMessage): string {
    if (typeof message.content === 'string') {
      return message.content;
    }

    if (typeof message.content === 'object' && message.content !== null) {
      const { content, parts } = message.content as { content?: string; parts?: any[] };

      if (content) {
        return content;
      }

      if (Array.isArray(parts)) {
        return parts
          .filter(part => part.type === 'text')
          .map(part => part.text || '')
          .join('\n');
      }
    }

    return '';
  }
}
