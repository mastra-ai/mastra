import type { SystemModelMessage } from '@internal/ai-sdk-v5';
import xxhash from 'xxhash-wasm';
import type { Processor } from '..';
import { MessageList } from '../../agent';
import type { IMastraLogger } from '../../logger';
import { parseMemoryRequestContext } from '../../memory';
import type { MastraDBMessage } from '../../memory';
import type { ObservabilityContext } from '../../observability';
import type { RequestContext } from '../../request-context';
import type { MemoryStorage } from '../../storage';
import type { MastraEmbeddingModel, MastraEmbeddingOptions, MastraVector } from '../../vector';
import { globalEmbeddingCache } from './embedding-cache';

const DEFAULT_TOP_K = 4;
const DEFAULT_MESSAGE_RANGE = 1; // Will be used for both before and after

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
   * @default 4
   */
  topK?: number;

  /**
   * Number of context messages to include before/after each match
   * Can be a number (same for before/after) or an object with before/after
   * @default 1
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

  /**
   * Options to pass to the embedder when generating embeddings.
   * Use this to pass provider-specific options like outputDimensionality for Google models.
   *
   * @example
   * ```typescript
   * embedderOptions: {
   *   providerOptions: {
   *     google: {
   *       outputDimensionality: 768,
   *       taskType: 'RETRIEVAL_DOCUMENT'
   *     }
   *   }
   * }
   * ```
   */
  embedderOptions?: MastraEmbeddingOptions;
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
  private embedderOptions?: MastraEmbeddingOptions;

  // xxhash-wasm hasher instance (initialized as a promise)
  private hasher = xxhash();

  // Cache for index dimension validation (per-process)
  // Prevents redundant API calls when index already validated
  private indexValidationCache = new Map<string, { dimension: number }>();

  constructor(options: SemanticRecallOptions) {
    this.storage = options.storage;
    this.vector = options.vector;
    this.embedder = options.embedder;
    this.topK = options.topK ?? DEFAULT_TOP_K;
    this.scope = options.scope ?? 'resource'; // Default to 'resource' to match main's behavior
    this.threshold = options.threshold;
    this.indexName = options.indexName;
    this.logger = options.logger;
    this.embedderOptions = options.embedderOptions;

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

  async processInput(
    args: {
      messages: MastraDBMessage[];
      messageList: MessageList;
      abort: (reason?: string) => never;
      requestContext?: RequestContext;
    } & Partial<ObservabilityContext>,
  ): Promise<MessageList | MastraDBMessage[]> {
    const { messages, messageList, requestContext } = args;

    // Get memory context from RequestContext
    const memoryContext = parseMemoryRequestContext(requestContext);
    if (!memoryContext) {
      // No memory context available, return messages unchanged
      return messageList;
    }

    const { thread, resourceId } = memoryContext;
    const threadId = thread?.id;

    if (!threadId) {
      // No thread ID available, return messages unchanged
      return messageList;
    }

    // Extract user query from the last user message
    const userQuery = this.extractUserQuery(messages);
    if (!userQuery) {
      // No user query to search with, return messages unchanged
      return messageList;
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
        return messageList;
      }

      // Filter out messages that are already in the MessageList (added by previous processors or current input)
      // Note: MessageList always assigns IDs, so m.id should never be undefined in practice
      const existingMessages = messageList.get.all.db();
      const existingIds = new Set(existingMessages.map(m => m.id).filter(Boolean));
      const newMessages = similarMessages.filter(m => m.id && !existingIds.has(m.id));

      if (newMessages.length === 0) {
        // All similar messages are already in input, return original messageList
        return messageList;
      }

      const sameThreadMessages = newMessages.filter(m => !m.threadId || m.threadId === threadId);

      // If scope is 'resource', check for cross-thread messages and format them specially
      if (this.scope === 'resource') {
        const crossThreadMessages = newMessages.filter(m => m.threadId && m.threadId !== threadId);
        if (crossThreadMessages.length > 0) {
          // Format cross-thread messages as a system message for context
          const formattedSystemMessage = this.formatCrossThreadMessages(crossThreadMessages, threadId);

          // Add cross-thread messages as a memory tagged system message
          messageList.addSystem(formattedSystemMessage, 'memory');
        }
      }

      if (sameThreadMessages.length) {
        // Add all recalled messages with 'memory' source
        messageList.add(sameThreadMessages, 'memory');
      }
      return messageList;
    } catch (error) {
      // Log error but don't fail the request
      this.logger?.error('[SemanticRecall] Error during semantic search:', { error });
      return messageList;
    }
  }

  /**
   * Format cross-thread messages as a system message with timestamps and labels
   * Uses the exact formatting logic from main that was tested with longmemeval benchmark
   */
  private formatCrossThreadMessages(messages: MastraDBMessage[], currentThreadId: string): SystemModelMessage {
    let result = ``;

    // Convert to v1 format like main did
    const v1Messages = new MessageList().add(messages, 'memory').get.all.v1();
    let lastYmd: string | null = null;

    for (const msg of v1Messages) {
      const date = msg.createdAt;
      const year = date.getUTCFullYear();
      const month = date.toLocaleString('default', { month: 'short' });
      const day = date.getUTCDate();
      const ymd = `${year}, ${month}, ${day}`;
      const utcHour = date.getUTCHours();
      const utcMinute = date.getUTCMinutes();
      const hour12 = utcHour % 12 || 12;
      const ampm = utcHour < 12 ? 'AM' : 'PM';
      const timeofday = `${hour12}:${utcMinute < 10 ? '0' : ''}${utcMinute} ${ampm}`;

      if (!lastYmd || lastYmd !== ymd) {
        result += `\nthe following messages are from ${ymd}\n`;
      }

      const roleLabel = msg.role.charAt(0).toUpperCase() + msg.role.slice(1);
      let contentText = '';
      if (typeof msg.content === 'string') {
        contentText = msg.content;
      } else if (Array.isArray(msg.content)) {
        // Handle CoreMessageV4 content (array of parts)
        const textParts = msg.content.filter((p: any) => p.type === 'text');
        contentText = textParts.map((p: any) => p.text).join(' ');
      }

      result += `Message ${msg.threadId && msg.threadId !== currentThreadId ? 'from previous conversation' : ''} at ${timeofday}: ${roleLabel}: ${contentText}`;

      lastYmd = ymd;
    }

    const formattedContent = `The following messages were remembered from a different conversation:\n<remembered_from_other_conversation>\n${result}\n<end_remembered_from_other_conversation>`;

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
        // Ensure msg.content is an object before accessing nested properties
        if (typeof msg.content !== 'object' || msg.content === null) {
          continue;
        }

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
    // Ensure vector index exists
    const indexName = this.indexName || this.getDefaultIndexName();

    // Generate embeddings for the query
    const { embeddings, dimension } = await this.embedMessageContent(query, indexName);
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
      perPage: 0,
    });

    return result.messages;
  }

  /**
   * Generate embeddings for message content
   */
  /**
   * Hash content using xxhash for fast cache key generation
   * Includes index name to ensure cache isolation between different embedding models/dimensions
   */
  private async hashContent(content: string, indexName: string): Promise<string> {
    const h = await this.hasher;
    const combined = `${indexName}:${content}`;
    return h.h64(combined).toString(16);
  }

  private async embedMessageContent(
    content: string,
    indexName: string,
  ): Promise<{
    embeddings: number[][];
    dimension: number;
  }> {
    // Check global cache first
    const contentHash = await this.hashContent(content, indexName);
    const cachedEmbedding = globalEmbeddingCache.get(contentHash);

    if (cachedEmbedding) {
      return {
        embeddings: [cachedEmbedding],
        dimension: cachedEmbedding.length,
      };
    }

    // Generate embedding if not cached
    // Note: embedderOptions may contain providerOptions for controlling embedding behavior
    // (e.g., outputDimensionality for Google models). The user is responsible for providing
    // options compatible with their embedder's SDK version.
    const result = await this.embedder.doEmbed({
      values: [content],
      ...(this.embedderOptions as any),
    });

    // Cache the first embedding in global cache
    if (result.embeddings[0]) {
      globalEmbeddingCache.set(contentHash, result.embeddings[0]);
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
   * Uses in-memory cache to avoid redundant validation calls
   */
  private async ensureVectorIndex(indexName: string, dimension: number): Promise<void> {
    // Check cache first - if already validated in this process, skip
    const cached = this.indexValidationCache.get(indexName);
    if (cached?.dimension === dimension) {
      return;
    }

    // Always call createIndex - it's idempotent and validates dimensions
    // Vector stores handle the "already exists" case and validate dimensions
    await this.vector.createIndex({
      indexName,
      dimension,
      metric: 'cosine',
    });

    // Cache the validated dimension to avoid redundant calls
    this.indexValidationCache.set(indexName, { dimension });
  }

  /**
   * Process output messages to create embeddings for messages being saved
   * This allows semantic recall to index new messages for future retrieval
   */
  async processOutputResult(
    args: {
      messages: MastraDBMessage[];
      messageList?: MessageList;
      abort: (reason?: string) => never;
      requestContext?: RequestContext;
    } & Partial<ObservabilityContext>,
  ): Promise<MessageList | MastraDBMessage[]> {
    const { messages, messageList, requestContext } = args;

    if (!this.vector || !this.embedder || !this.storage) {
      // Return messageList if available to signal no transformation occurred
      return messageList || messages;
    }

    try {
      const memoryContext = parseMemoryRequestContext(requestContext);

      if (!memoryContext) {
        return messageList || messages;
      }

      const { thread, resourceId } = memoryContext;
      const threadId = thread?.id;

      if (!threadId) {
        return messageList || messages;
      }

      const indexName = this.indexName || this.getDefaultIndexName();

      // Collect all embeddings first
      const vectors: number[][] = [];
      const ids: string[] = [];
      const metadataList: Record<string, any>[] = [];
      let vectorDimension = 0;

      // Get all new messages that need embeddings (both user and response messages)
      // The 'messages' argument only contains response messages, so we also need
      // to get user messages from the messageList for embedding
      let messagesToEmbed = [...messages];
      if (messageList) {
        const newUserMessages = messageList.get.input.db().filter(m => messageList.isNewMessage(m));
        // Combine user and response messages, avoiding duplicates
        const existingIds = new Set(messagesToEmbed.map(m => m.id));
        for (const userMsg of newUserMessages) {
          if (!existingIds.has(userMsg.id)) {
            messagesToEmbed.push(userMsg);
          }
        }
      }

      for (const message of messagesToEmbed) {
        // Skip system messages - they're instructions, not user content
        if (message.role === 'system') {
          continue;
        }

        // Skip messages without valid IDs
        if (!message.id || typeof message.id !== 'string') {
          continue;
        }

        // Only embed new user messages and new response messages
        // Skip context messages and memory messages
        if (messageList) {
          const isNewMessage = messageList.isNewMessage(message);
          if (!isNewMessage) {
            continue;
          }
        }

        // Extract text content from the message
        const textContent = this.extractTextContent(message);
        if (!textContent) {
          continue;
        }

        try {
          // Create embedding for the message
          const { embeddings, dimension } = await this.embedMessageContent(textContent, indexName);

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

    // Return messageList to signal no message transformation occurred
    // (we only created embeddings as a side effect)
    return messageList || messages;
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
