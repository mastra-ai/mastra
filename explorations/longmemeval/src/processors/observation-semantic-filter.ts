/**
 * ObservationSemanticFilter - RAG-based filtering for OM observations
 *
 * This processor works alongside ObservationalMemory to filter observations
 * based on semantic similarity to the user's query. It's designed to help
 * models like GPT-4o that struggle with dense context by providing only
 * the most relevant observations.
 *
 * Flow:
 * 1. OM's processInputStep loads observations and stores them in state
 * 2. This processor's processInputStep:
 *    - Embeds the user's query
 *    - Retrieves relevant observation chunks from vector store
 *    - Injects filtered observations into context (replacing OM's full injection)
 *
 * 3. OM's processOutputResult creates new observations
 * 4. This processor's processOutputResult:
 *    - Chunks new observations by line
 *    - Embeds and stores chunks in vector store
 */

import { embed, embedMany } from 'ai';
import type { EmbeddingModel } from 'ai';
import type {
  Processor,
  ProcessInputStepArgs,
  ProcessOutputResultArgs,
} from '@mastra/core/processors';
import type { MastraDBMessage } from '@mastra/core/agent';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import xxhash from 'xxhash-wasm';

// ============================================================================
// Types
// ============================================================================

/**
 * Metadata stored with each observation chunk in the vector store
 */
export interface ObservationChunkMetadata {
  /** The thread this observation came from */
  threadId: string;
  /** Resource ID for cross-thread queries */
  resourceId?: string;
  /** The date group header this observation belongs to (e.g., "Date: May 30, 2023") */
  dateGroup: string;
  /** Time extracted from the observation line (e.g., "17:27") */
  time?: string;
  /** Labels extracted from the observation (e.g., [preference], [fact]) */
  labels?: string[];
  /** Index of this line within the observation block */
  lineIndex: number;
  /** The full observation line content */
  content: string;
}

/**
 * A chunk stored in the vector store
 */
export interface ObservationChunk {
  id: string;
  embedding: number[];
  metadata: ObservationChunkMetadata;
}

/**
 * Configuration for the ObservationSemanticFilter
 */
export interface ObservationSemanticFilterConfig {
  /**
   * Embedding model to use for chunking and retrieval
   * @example fastembed.small from @mastra/fastembed
   */
  embedder: EmbeddingModel<string>;

  /**
   * Number of top chunks to retrieve per query
   * @default 50
   */
  topK?: number;

  /**
   * Minimum similarity score (0-1) for a chunk to be included
   * @default 0.3
   */
  minSimilarity?: number;

  /**
   * Whether to include <current-task> in filtered output
   * @default false (saves tokens for benchmarks)
   */
  includeCurrentTask?: boolean;

  /**
   * Whether to include <suggested-response> in filtered output
   * @default false (saves tokens for benchmarks)
   */
  includeSuggestedResponse?: boolean;

  /**
   * Whether to include <patterns> in filtered output
   * @default true (patterns are already compressed)
   */
  includePatterns?: boolean;

  /**
   * Directory to cache embeddings on disk.
   * Embeddings are stored by content hash (xxhash) so they can be reused across configs.
   * @default undefined (no caching)
   */
  cacheDir?: string;

  /**
   * Enable score-based context expansion.
   * High-scoring matches will include surrounding observation lines.
   * @default true
   */
  expandContext?: boolean;

  /**
   * Similarity threshold for high-confidence matches (±2 lines)
   * @default 0.6
   */
  highScoreThreshold?: number;

  /**
   * Similarity threshold for medium-confidence matches (±1 line)
   * @default 0.4
   */
  mediumScoreThreshold?: number;
}

/**
 * In-memory vector store for observation chunks
 * Simple implementation for experimentation - can be replaced with LibSQL later
 */
export class InMemoryVectorStore {
  private chunks: Map<string, ObservationChunk> = new Map();

  /**
   * Add or update chunks in the store
   */
  upsert(chunks: ObservationChunk[]): void {
    for (const chunk of chunks) {
      this.chunks.set(chunk.id, chunk);
    }
  }

  /**
   * Query chunks by similarity to a query embedding
   */
  query(
    queryEmbedding: number[],
    options: { topK: number; minSimilarity: number; resourceId?: string },
  ): Array<{ chunk: ObservationChunk; similarity: number }> {
    const results: Array<{ chunk: ObservationChunk; similarity: number }> = [];

    for (const chunk of Array.from(this.chunks.values())) {
      // Filter by resourceId if provided
      if (options.resourceId && chunk.metadata.resourceId !== options.resourceId) {
        continue;
      }

      const similarity = this.cosineSimilarity(queryEmbedding, chunk.embedding);
      if (similarity >= options.minSimilarity) {
        results.push({ chunk, similarity });
      }
    }

    // Sort by similarity descending and take topK
    return results.sort((a, b) => b.similarity - a.similarity).slice(0, options.topK);
  }

  /**
   * Get all chunks (for debugging/inspection)
   */
  getAll(): ObservationChunk[] {
    return Array.from(this.chunks.values());
  }

  /**
   * Clear all chunks
   */
  clear(): void {
    this.chunks.clear();
  }

  /**
   * Get chunk count
   */
  get size(): number {
    return this.chunks.size;
  }

  /**
   * Cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  /**
   * Serialize store to JSON (for persistence)
   */
  toJSON(): { chunks: ObservationChunk[] } {
    return { chunks: Array.from(this.chunks.values()) };
  }

  /**
   * Load store from JSON
   */
  static fromJSON(data: { chunks: ObservationChunk[] }): InMemoryVectorStore {
    const store = new InMemoryVectorStore();
    store.upsert(data.chunks);
    return store;
  }
}

// ============================================================================
// Parsing Helpers
// ============================================================================

/**
 * Parsed observation with full context (thread, date group, content)
 */
export interface ParsedObservation {
  line: string;
  lineIndex: number;
  threadId: string;
  dateGroup: string; // The date header (e.g., "Date: May 30, 2023")
  time?: string; // Time extracted from line (e.g., "17:27")
  labels?: string[];
}

/**
 * Parse observation lines from the <observations> block, preserving thread and date context
 * Each line is one observation item (emoji + time + content + labels)
 */
export function parseObservationLines(observations: string): ParsedObservation[] {
  const lines = observations.split('\n');
  const results: ParsedObservation[] = [];

  let currentThreadId = 'default';
  let currentDateGroup = 'Unknown Date';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Check for thread headers
    const threadMatch = line.match(/^<thread\s+id="([^"]+)"/i) || 
                        line.match(/^<other-conversation\s+id="([^"]+)"/i);
    if (threadMatch) {
      currentThreadId = threadMatch[1];
      continue;
    }

    // Check for thread closing tags
    if (line.match(/^<\/thread>/i) || line.match(/^<\/other-conversation>/i)) {
      currentThreadId = 'default';
      continue;
    }

    // Check for date headers
    // Format 1: "## 2023-05-15" or "# 2023-05-15"
    const dateHeaderMatch1 = line.match(/^##?\s*(\d{4}-\d{2}-\d{2})/);
    if (dateHeaderMatch1) {
      currentDateGroup = `Date: ${dateHeaderMatch1[1]}`;
      continue;
    }
    // Format 2: "Date: May 30, 2023" or "Date: Dec 20, 2022"
    const dateHeaderMatch2 = line.match(/^(Date:\s+.+)$/i);
    if (dateHeaderMatch2) {
      currentDateGroup = dateHeaderMatch2[1];
      continue;
    }

    // Skip other XML tags
    if (line.startsWith('<') || line.startsWith('</')) {
      continue;
    }

    // This is an observation line - extract time and labels
    // Time format: (HH:MM) at the start after emoji
    const timeMatch = line.match(/\((\d{2}:\d{2})\)/);
    const time = timeMatch ? timeMatch[1] : undefined;

    // Extract labels (format: [label])
    const labelMatches = line.match(/\[([^\]]+)\]/g);
    const labels = labelMatches?.map(l => l.slice(1, -1));

    results.push({
      line,
      lineIndex: i,
      threadId: currentThreadId,
      dateGroup: currentDateGroup,
      time,
      labels,
    });
  }

  return results;
}

/**
 * Rebuild observations with thread and date structure from retrieved chunks
 */
export function rebuildObservationsWithStructure(
  chunks: Array<{ metadata: ObservationChunkMetadata & { threadId: string; dateGroup: string } }>
): string {
  // Group by thread, then by date
  const threadGroups = new Map<string, Map<string, string[]>>();

  for (const chunk of chunks) {
    const { threadId, dateGroup, content } = chunk.metadata;
    
    if (!threadGroups.has(threadId)) {
      threadGroups.set(threadId, new Map());
    }
    const dateGroups = threadGroups.get(threadId)!;
    
    if (!dateGroups.has(dateGroup)) {
      dateGroups.set(dateGroup, []);
    }
    dateGroups.get(dateGroup)!.push(content);
  }

  // Build output with structure
  const parts: string[] = [];
  
  for (const [threadId, dateGroups] of Array.from(threadGroups.entries())) {
    // Add thread wrapper if not default
    if (threadId !== 'default') {
      parts.push(`<thread id="${threadId}">`);
    }
    
    for (const [dateGroup, observations] of Array.from(dateGroups.entries())) {
      parts.push(dateGroup);
      parts.push(...observations);
    }
    
    if (threadId !== 'default') {
      parts.push('</thread>');
    }
  }

  return parts.join('\n');
}

/**
 * Extract the <observations> content from formatted context
 */
export function extractObservationsBlock(formattedContext: string): string | null {
  const match = formattedContext.match(/<observations>([\s\S]*?)<\/observations>/);
  return match ? match[1].trim() : null;
}

/**
 * Extract the <patterns> content from formatted context
 */
export function extractPatternsBlock(formattedContext: string): string | null {
  const match = formattedContext.match(/<patterns>([\s\S]*?)<\/patterns>/);
  return match ? match[1].trim() : null;
}

/**
 * Extract the <current-task> content from formatted context
 */
export function extractCurrentTaskBlock(formattedContext: string): string | null {
  const match = formattedContext.match(/<current-task>([\s\S]*?)<\/current-task>/);
  return match ? match[1].trim() : null;
}

/**
 * Extract the <suggested-response> content from formatted context
 */
export function extractSuggestedResponseBlock(formattedContext: string): string | null {
  const match = formattedContext.match(/<suggested-response>([\s\S]*?)<\/suggested-response>/);
  return match ? match[1].trim() : null;
}

/**
 * Get the most recent user message from the message list
 */
export function getLatestUserMessage(messages: MastraDBMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === 'user') {
      const content = msg.content;
      
      // Handle string content (legacy format)
      if (typeof content === 'string') {
        return content;
      }
      
      // Handle MastraMessageContentV2 format (format: 2 with parts array)
      if (content && typeof content === 'object' && 'format' in content && content.format === 2) {
        // First check if there's a direct content string
        if (typeof content.content === 'string' && content.content) {
          return content.content;
        }
        // Otherwise extract from parts
        if (Array.isArray(content.parts)) {
          const textParts = content.parts
            .filter((p): p is { type: 'text'; text: string } => p && typeof p === 'object' && p.type === 'text' && typeof p.text === 'string')
            .map(p => p.text);
          if (textParts.length > 0) {
            return textParts.join(' ');
          }
        }
      }
      
      // Handle plain array content (older format)
      if (Array.isArray(content)) {
        const textParts = content
          .filter((p): p is { type: 'text'; text: string } => p && typeof p === 'object' && p.type === 'text' && typeof p.text === 'string')
          .map(p => p.text);
        return textParts.join(' ') || null;
      }
    }
  }
  return null;
}

// ============================================================================
// Processor Implementation
// ============================================================================

/**
 * ObservationSemanticFilter processor
 *
 * Works with ObservationalMemory to filter observations based on semantic
 * similarity to the user's query.
 */
export class ObservationSemanticFilter implements Processor<'observation-semantic-filter'> {
  readonly id = 'observation-semantic-filter' as const;
  readonly name = 'Observation Semantic Filter';

  private embedder: EmbeddingModel<string>;
  private vectorStore: InMemoryVectorStore;
  private topK: number;
  private minSimilarity: number;
  private includeCurrentTask: boolean;
  private includeSuggestedResponse: boolean;
  private includePatterns: boolean;
  private cacheDir?: string;
  private hasher = xxhash();
  private embeddingCache = new Map<string, number[]>(); // hash -> embedding
  
  // Context expansion settings
  private expandContext: boolean;
  private highScoreThreshold: number;
  private mediumScoreThreshold: number;
  
  // Store all parsed observations for neighbor lookup during expansion
  private allParsedObservations: ParsedObservation[] = [];

  constructor(config: ObservationSemanticFilterConfig) {
    this.embedder = config.embedder;
    this.vectorStore = new InMemoryVectorStore();
    this.topK = config.topK ?? 50;
    this.minSimilarity = config.minSimilarity ?? 0.3;
    this.includeCurrentTask = config.includeCurrentTask ?? false;
    this.includeSuggestedResponse = config.includeSuggestedResponse ?? false;
    this.includePatterns = config.includePatterns ?? true;
    this.cacheDir = config.cacheDir;
    this.expandContext = config.expandContext ?? true;
    this.highScoreThreshold = config.highScoreThreshold ?? 0.6;
    this.mediumScoreThreshold = config.mediumScoreThreshold ?? 0.4;

    // Ensure cache directory exists
    if (this.cacheDir && !existsSync(this.cacheDir)) {
      mkdirSync(this.cacheDir, { recursive: true });
    }
  }

  /**
   * Hash content to create a cache key using xxhash
   */
  private async hashContent(content: string): Promise<string> {
    const hasher = await this.hasher;
    return hasher.h32ToString(content);
  }

  /**
   * Get cached embedding for content, or null if not cached
   */
  private getCachedEmbedding(hash: string): number[] | null {
    // Check in-memory cache first
    if (this.embeddingCache.has(hash)) {
      return this.embeddingCache.get(hash)!;
    }

    // Check disk cache
    if (this.cacheDir) {
      const cachePath = join(this.cacheDir, `${hash}.json`);
      if (existsSync(cachePath)) {
        try {
          const embedding = JSON.parse(readFileSync(cachePath, 'utf-8'));
          this.embeddingCache.set(hash, embedding); // Store in memory for future lookups
          return embedding;
        } catch {
          // Ignore corrupted cache files
        }
      }
    }

    return null;
  }

  /**
   * Save embedding to cache (both in-memory and disk)
   */
  private saveEmbeddingToCache(hash: string, embedding: number[]): void {
    this.embeddingCache.set(hash, embedding);

    if (this.cacheDir) {
      const cachePath = join(this.cacheDir, `${hash}.json`);
      try {
        writeFileSync(cachePath, JSON.stringify(embedding));
      } catch {
        // Ignore write errors
      }
    }
  }

  /**
   * Get the vector store (for external access/persistence)
   */
  getVectorStore(): InMemoryVectorStore {
    return this.vectorStore;
  }

  /**
   * Set the vector store (for loading persisted data)
   */
  setVectorStore(store: InMemoryVectorStore): void {
    this.vectorStore = store;
  }

  /**
   * Process input at each step - filter observations based on query similarity
   */
  async processInputStep(args: ProcessInputStepArgs) {
    const { messages, messageList, state } = args;

    console.log('[RAG Filter] processInputStep called, stepNumber:', args.stepNumber);

    // Only process on step 0 (initial input)
    // OM has already injected its full observations by this point
    if (args.stepNumber !== 0) {
      return messageList;
    }

    // Get OM's system messages directly from messageList
    const omSystemMessages = messageList.getSystemMessages('observational-memory');
    console.log('[RAG Filter] Found OM system messages:', omSystemMessages.length);
    if (omSystemMessages.length === 0) {
      // No observations to filter
      return messageList;
    }

    const omSystemMessage = omSystemMessages[0];
    const fullContext = typeof omSystemMessage.content === 'string' ? omSystemMessage.content : '';
    console.log('[RAG Filter] Full context length:', fullContext.length);

    // Extract the observations block
    const observationsContent = extractObservationsBlock(fullContext);
    console.log('[RAG Filter] Observations content length:', observationsContent?.length ?? 0);
    if (!observationsContent) {
      console.log('[RAG Filter] No observations block found, returning early');
      return messageList;
    }

    // Get the user's query for similarity matching
    // Debug: log all messages to understand the structure
    console.log('[RAG Filter] Messages:', messages.map(m => {
      const content = m.content as unknown;
      let preview = 'unknown';
      if (typeof content === 'string') {
        preview = (content as string).slice(0, 50);
      } else if (Array.isArray(content)) {
        preview = `array[${(content as unknown[]).length}]`;
      }
      return { role: m.role, contentType: typeof content, contentPreview: preview };
    }));
    
    const userQuery = getLatestUserMessage(messages);
    console.log('[RAG Filter] User query found:', !!userQuery, 'messages count:', messages.length);
    if (!userQuery) {
      // No query to match against - keep full observations
      console.log('[RAG Filter] No user query, returning early');
      return messageList;
    }

    console.log('[RAG Filter] User query:', userQuery?.slice(0, 100));

    // Index observations (will use cache for already-embedded content)
    if (this.vectorStore.size === 0) {
      console.log('[RAG Filter] Indexing observations...');
      await this.indexObservations(observationsContent, state);
      console.log('[RAG Filter] Indexed', this.vectorStore.size, 'chunks');
    }

    // Embed the user query
    const { embedding: queryEmbedding } = await embed({
      model: this.embedder,
      value: userQuery,
    });
    console.log('[RAG Filter] Query embedded, searching...');

    // Query for relevant chunks
    const results = this.vectorStore.query(queryEmbedding, {
      topK: this.topK,
      minSimilarity: this.minSimilarity,
    });
    console.log('[RAG Filter] Found', results.length, 'relevant chunks out of', this.vectorStore.size, 'total');
    console.log('[RAG Filter] Top 3 similarities:', results.slice(0, 3).map(r => r.similarity.toFixed(3)).join(', '));

    // Expand results based on similarity score (high score = more context)
    const expandedChunks = this.expandResults(results);

    // Build filtered observations with preserved structure (thread + date grouping)
    const filteredObservations = rebuildObservationsWithStructure(expandedChunks);

    // Build the new context with filtered observations
    let newContext = `
The following observations block contains your memory of past conversations with this user. Use these observations to provide personalized, contextually relevant responses.

<observations>
${filteredObservations}
</observations>`;

    // Optionally include patterns (already compressed, usually worth including)
    if (this.includePatterns) {
      const patterns = extractPatternsBlock(fullContext);
      if (patterns) {
        newContext += `\n\n<patterns>\n${patterns}\n</patterns>`;
      }
    }

    // Optionally include current-task
    if (this.includeCurrentTask) {
      const currentTask = extractCurrentTaskBlock(fullContext);
      if (currentTask) {
        newContext += `\n\n<current-task>\n${currentTask}\n</current-task>`;
      }
    }

    // Optionally include suggested-response
    if (this.includeSuggestedResponse) {
      const suggestedResponse = extractSuggestedResponseBlock(fullContext);
      if (suggestedResponse) {
        newContext += `\n\n<suggested-response>\n${suggestedResponse}\n</suggested-response>`;
      }
    }

    // Replace OM's system message with our filtered version
    // Get all system messages, replace OM's, and set them all back
    const allSystemMessages = messageList.getAllSystemMessages();
    const updatedSystemMessages = allSystemMessages.map(msg => {
      // Replace the OM message with our filtered version
      if (msg === omSystemMessage) {
        return {
          role: 'system' as const,
          content: newContext,
        };
      }
      return msg;
    });
    messageList.replaceAllSystemMessages(updatedSystemMessages);
    console.log('[RAG Filter] Replaced system messages. New context length:', newContext.length, 'chars');

    // Store stats in state for debugging
    state.ragStats = {
      originalLines: this.allParsedObservations.length,
      matchedLines: results.length,
      expandedLines: expandedChunks.length,
      topSimilarity: results[0]?.similarity ?? 0,
      query: userQuery.slice(0, 100),
    };

    return messageList;
  }

  /**
   * Index observations into the vector store with content-based caching
   */
  private async indexObservations(
    observations: string,
    state: Record<string, unknown>,
  ): Promise<void> {
    const parsedObs = parseObservationLines(observations);
    if (parsedObs.length === 0) return;
    
    // Store all parsed observations for neighbor lookup during expansion
    this.allParsedObservations = parsedObs;

    // Get resourceId from state if available
    const resourceId = state.resourceId as string | undefined;

    // Separate cached vs uncached observations
    const uncachedObs: ParsedObservation[] = [];
    const cachedChunks: ObservationChunk[] = [];
    const obsHashes: string[] = [];

    for (const obs of parsedObs) {
      const hash = await this.hashContent(obs.line);
      obsHashes.push(hash);
      
      const cachedEmbedding = this.getCachedEmbedding(hash);
      if (cachedEmbedding) {
        // Use cached embedding
        cachedChunks.push({
          id: `obs_${hash}`,
          embedding: cachedEmbedding,
          metadata: {
            threadId: obs.threadId,
            resourceId,
            dateGroup: obs.dateGroup,
            time: obs.time,
            labels: obs.labels,
            lineIndex: obs.lineIndex,
            content: obs.line,
          },
        });
      } else {
        uncachedObs.push(obs);
      }
    }

    console.log(`[RAG Filter] Cache: ${cachedChunks.length} hits, ${uncachedObs.length} misses`);

    // Embed uncached observations in batches
    if (uncachedObs.length > 0) {
      const batchSize = 25;
      for (let b = 0; b < uncachedObs.length; b += batchSize) {
        const batch = uncachedObs.slice(b, b + batchSize);
        
        const { embeddings } = await embedMany({
          model: this.embedder,
          values: batch.map(l => l.line),
        });

        // Create chunks and save to cache
        for (let i = 0; i < batch.length; i++) {
          const obs = batch[i];
          const hash = await this.hashContent(obs.line);
          const embedding = embeddings[i];

          // Save to cache
          this.saveEmbeddingToCache(hash, embedding);

          cachedChunks.push({
            id: `obs_${hash}`,
            embedding,
            metadata: {
              threadId: obs.threadId,
              resourceId,
              dateGroup: obs.dateGroup,
              time: obs.time,
              labels: obs.labels,
              lineIndex: obs.lineIndex,
              content: obs.line,
            },
          });
        }
      }
    }

    this.vectorStore.upsert(cachedChunks);
  }

  /**
   * Expand search results by including neighboring observations based on similarity score.
   * High score (≥0.6): Include ±2 lines of context
   * Medium score (0.4-0.6): Include ±1 line of context
   * Low score (<0.4): Just the matched line
   */
  private expandResults(
    results: Array<{ chunk: ObservationChunk; similarity: number }>
  ): Array<{ metadata: ObservationChunkMetadata & { threadId: string; dateGroup: string } }> {
    if (!this.expandContext || this.allParsedObservations.length === 0) {
      // Return results as-is without expansion
      return results.map(r => r.chunk);
    }

    // Create a lookup for all observations by threadId and lineIndex
    const obsLookup = new Map<string, ParsedObservation[]>();
    for (const obs of this.allParsedObservations) {
      const key = obs.threadId;
      if (!obsLookup.has(key)) {
        obsLookup.set(key, []);
      }
      obsLookup.get(key)!.push(obs);
    }
    
    // Sort each thread's observations by lineIndex
    for (const [, obsList] of Array.from(obsLookup.entries())) {
      obsList.sort((a, b) => a.lineIndex - b.lineIndex);
    }

    // Track which lines we've already included (by threadId + lineIndex)
    const includedLines = new Set<string>();
    const expandedChunks: Array<{ metadata: ObservationChunkMetadata & { threadId: string; dateGroup: string } }> = [];

    for (const result of results) {
      const { chunk, similarity } = result;
      const { threadId, lineIndex, resourceId } = chunk.metadata;
      
      // Determine expansion range based on score
      let range = 0;
      if (similarity >= this.highScoreThreshold) {
        range = 2; // ±2 lines for high confidence
      } else if (similarity >= this.mediumScoreThreshold) {
        range = 1; // ±1 line for medium confidence
      }
      // range = 0 for low confidence (just the match)

      // Get observations for this thread
      const threadObs = obsLookup.get(threadId) || [];
      if (threadObs.length === 0) {
        // Fallback: just include the original chunk
        const lineKey = `${threadId}:${lineIndex}`;
        if (!includedLines.has(lineKey)) {
          includedLines.add(lineKey);
          expandedChunks.push(chunk);
        }
        continue;
      }

      // Find observations within range
      for (const obs of threadObs) {
        if (obs.lineIndex >= lineIndex - range && obs.lineIndex <= lineIndex + range) {
          const lineKey = `${threadId}:${obs.lineIndex}`;
          if (!includedLines.has(lineKey)) {
            includedLines.add(lineKey);
            expandedChunks.push({
              metadata: {
                threadId: obs.threadId,
                resourceId,
                dateGroup: obs.dateGroup,
                time: obs.time,
                labels: obs.labels,
                lineIndex: obs.lineIndex,
                content: obs.line,
              },
            });
          }
        }
      }
    }

    // Sort expanded chunks by threadId, dateGroup, then lineIndex for proper reconstruction
    expandedChunks.sort((a, b) => {
      if (a.metadata.threadId !== b.metadata.threadId) {
        return a.metadata.threadId.localeCompare(b.metadata.threadId);
      }
      if (a.metadata.dateGroup !== b.metadata.dateGroup) {
        return a.metadata.dateGroup.localeCompare(b.metadata.dateGroup);
      }
      return a.metadata.lineIndex - b.metadata.lineIndex;
    });

    console.log(`[RAG Filter] Context expansion: ${results.length} matches → ${expandedChunks.length} lines (range based on score)`);
    
    return expandedChunks;
  }

  /**
   * Process output - index new observations after OM creates them
   *
   * Note: This is called after OM's processOutputResult, so new observations
   * should be available in the OM record. For now, we'll skip this and
   * rely on indexing during processInputStep.
   */
  async processOutputResult(args: ProcessOutputResultArgs) {
    // For the initial implementation, we index observations lazily during
    // processInputStep. This avoids the complexity of coordinating with OM's
    // output processing.
    //
    // Future enhancement: Index new observations here for better performance
    // on subsequent queries within the same session.
    return args.messageList;
  }
}

/**
 * Create an ObservationSemanticFilter processor
 */
export function createObservationSemanticFilter(
  config: ObservationSemanticFilterConfig,
): ObservationSemanticFilter {
  return new ObservationSemanticFilter(config);
}
