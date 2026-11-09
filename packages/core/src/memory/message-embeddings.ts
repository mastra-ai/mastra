import xxhash from 'xxhash-wasm';
import type { MastraDBMessage } from '../agent/message-list/state/types';
import { isTransientSignalMessage } from '../agent/signals';
import { ErrorCategory, ErrorDomain, MastraError } from '../error';
import type { MastraVector } from '../vector';
import { removeWorkingMemoryTags } from './working-memory-utils';

/**
 * Average characters per English token. Chunking measures characters because no single
 * tokenizer matches every embedder, so token limits are converted with this ratio.
 *
 * @internal
 */
export const MESSAGE_EMBEDDING_CHARS_PER_TOKEN = 4;

/**
 * Default ceiling, in characters, for one chunk of message text sent to the embedder.
 * About 4096 English tokens, which fits `openai/text-embedding-3-small` (8191 tokens).
 *
 * @internal
 */
export const DEFAULT_MESSAGE_EMBEDDING_MAX_CHUNK_CHARS = 4096 * MESSAGE_EMBEDDING_CHARS_PER_TOKEN;

// An embedder's declared token window is converted with the English ratio, which overestimates
// how many characters fit for most other text. Keeping a quarter of headroom keeps chunks
// inside small windows such as fastembed's 512 tokens.
const EMBEDDER_LIMIT_HEADROOM = 0.75;

/**
 * Optional, Mastra-specific property an embedding model can carry to declare the most tokens it
 * embeds from one input. The AI SDK model interfaces have no such field, so integrations that know
 * their window (for example `@mastra/fastembed`) set it on the model object.
 */
export interface MessageEmbeddingModelLimits {
  /** Largest number of tokens the model embeds from a single input before truncating or failing. */
  maxInputTokens?: number;
}

/**
 * Metadata stored on every message vector row. Recall resolves rows back to messages through
 * `message_id`, and edits and deletes find rows through it, so it is always set.
 *
 * @internal
 */
export type MessageVectorMetadata = Record<string, unknown> & {
  message_id: string;
  thread_id: string | undefined;
  resource_id: string | undefined;
  role: string;
  /** Full embedded text of the message, repeated on each of its chunk rows. */
  content: string;
  created_at: string;
};

/**
 * One message to embed.
 *
 * @internal
 */
export interface MessageEmbeddingItem {
  message: MastraDBMessage;
  /**
   * Text to embed instead of the text read from `message`. `Memory.updateMessages` passes the
   * projected text of an edit here, because the stored row it reads metadata from still holds
   * the old text.
   */
  text?: string | null;
}

/**
 * Embeds chunk texts, one embedding per chunk in the same order. Each writer passes its own, so
 * embedding keeps its existing call path, retries and cache.
 *
 * @internal
 */
export type MessageChunkEmbedder = (chunks: string[]) => Promise<{
  embeddings: number[][];
  usage?: { tokens?: number };
}>;

/**
 * Options for {@link buildMessageEmbeddingRows}.
 *
 * @internal
 */
export interface BuildMessageEmbeddingRowsOptions {
  items: MessageEmbeddingItem[];
  /**
   * Produces the vectors. When omitted the rows carry `documents` instead, for vector stores that
   * embed text themselves.
   */
  embed?: MessageChunkEmbedder;
  /** Character ceiling per chunk. Resolve it with {@link resolveMaxChunkChars}. */
  maxChunkChars: number;
  /**
   * Loads the metadata of the given threads, spread under the fixed fields so
   * `semanticRecall.filter` can match thread attributes. Called only when at least one message
   * still needs rows, so a write that skips everything costs no storage read.
   */
  loadThreadMetadata?: (threadIds: string[]) => Promise<Map<string, Record<string, unknown>>>;
  /**
   * Thread and resource used when a message does not carry its own. Agent runs pass the run's
   * thread and resource, because resource-scoped recall filters rows by `resource_id`.
   */
  defaults?: { threadId?: string; resourceId?: string };
  /**
   * The run's record of messages already embedded, from `MessageList.getEmbeddedMessages()`.
   * Messages recorded for the same index with the same text are skipped.
   */
  embeddedMessages?: Map<string, string>;
  /**
   * Index the rows are written to. Required with `embeddedMessages`: the record is kept per
   * index, because the `SemanticRecall` processor and `Memory` can write to different indexes
   * (a custom `semanticRecall.indexName`) and each must still receive every message.
   */
  indexName?: string;
}

/**
 * Rows ready for {@link upsertMessageVectors}. Every array lines up index by index.
 *
 * @internal
 */
export interface MessageEmbeddingRows {
  /** Row ids from {@link messageVectorId}. Always set, so a repeated write replaces the same rows. */
  ids: string[];
  /** Embeddings, set when an embedder was given. */
  vectors?: number[][];
  /** Chunk texts, set for vector stores that embed text themselves. */
  documents?: string[];
  metadata: MessageVectorMetadata[];
  /** Embedding length, set when an embedder was given and at least one row was produced. */
  dimension?: number;
  /** Tokens the embedder reported for these rows. */
  usage?: { tokens: number };
  /**
   * `[recordKey, textHash]` pairs for the messages these rows embed. {@link upsertMessageVectors}
   * adds them to the run's record only after the write succeeds.
   */
  embeddedEntries: Array<[string, string]>;
}

// Created on first use rather than at import: compiling the WASM module costs startup CPU
// (Cloudflare Workers enforce a startup limit) in every app that imports @mastra/core/memory,
// including apps that never embed anything.
let hasherPromise: ReturnType<typeof xxhash> | undefined;

async function hash64(text: string): Promise<string> {
  hasherPromise ??= xxhash().catch(error => {
    // Let the next call try again instead of caching the failure.
    hasherPromise = undefined;
    throw error;
  });
  return (await hasherPromise).h64(text).toString(16);
}

function isEmbeddable(message: MastraDBMessage): boolean {
  return message.role !== 'system' && !isTransientSignalMessage(message);
}

/**
 * Text of a message as semantic recall embeds it, or `null` when the message is not embedded.
 * System messages and transient signals are never stored, working-memory tags are removed,
 * and text parts are joined with a space.
 *
 * @internal
 */
export function extractMessageEmbeddingText(message: MastraDBMessage): string | null {
  if (!isEmbeddable(message)) return null;

  const content = message.content as MastraDBMessage['content'] | string | undefined;
  if (typeof content === 'string') {
    return removeWorkingMemoryTags(content).trim() || null;
  }
  if (!content || typeof content !== 'object') return null;

  if (typeof content.content === 'string') {
    const text = removeWorkingMemoryTags(content.content).trim();
    if (text) return text;
  }

  if (Array.isArray(content.parts)) {
    const text = content.parts
      .filter(part => part?.type === 'text')
      .map(part => removeWorkingMemoryTags(typeof part.text === 'string' ? part.text : '').trim())
      .filter(Boolean)
      .join(' ');
    if (text) return text;
  }

  return null;
}

/**
 * Splits text into chunks of at most `maxChars` characters, breaking on whitespace where it can.
 * A single word longer than the ceiling (base64, minified code, unbroken CJK text) is split by
 * character count, so every chunk fits.
 *
 * @internal
 */
export function chunkMessageText(text: string, maxChars: number): string[] {
  const chunks: string[] = [];
  let currentChunk = '';

  for (const word of text.split(/\s+/)) {
    if (word.length > maxChars) {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = '';
      }
      for (let i = 0; i < word.length; i += maxChars) {
        chunks.push(word.slice(i, i + maxChars));
      }
      continue;
    }

    const wordWithSpace = currentChunk ? ' ' + word : word;
    if (currentChunk.length + wordWithSpace.length > maxChars) {
      // The first word can fill the budget on its own, which leaves nothing to flush yet.
      if (currentChunk) chunks.push(currentChunk);
      currentChunk = word;
    } else {
      currentChunk += wordWithSpace;
    }
  }

  if (currentChunk) chunks.push(currentChunk);
  return chunks;
}

/**
 * Character ceiling per chunk: the explicit `maxChunkChars` option, else the embedder's declared
 * `maxInputTokens` converted to characters, else {@link DEFAULT_MESSAGE_EMBEDDING_MAX_CHUNK_CHARS}.
 *
 * @internal
 */
export function resolveMaxChunkChars({
  maxChunkChars,
  embedder,
}: {
  maxChunkChars?: number;
  embedder?: unknown;
}): number {
  if (maxChunkChars !== undefined) {
    if (!Number.isSafeInteger(maxChunkChars) || maxChunkChars <= 0) {
      throw new MastraError({
        id: 'MASTRA_MEMORY_INVALID_MAX_CHUNK_CHARS',
        domain: ErrorDomain.MASTRA_MEMORY,
        category: ErrorCategory.USER,
        text: `semanticRecall.maxChunkChars must be a positive integer, received ${String(maxChunkChars)}.`,
      });
    }
    return maxChunkChars;
  }

  const maxInputTokens = (embedder as MessageEmbeddingModelLimits | undefined)?.maxInputTokens;
  if (typeof maxInputTokens === 'number' && Number.isSafeInteger(maxInputTokens) && maxInputTokens > 0) {
    return Math.max(1, Math.floor(maxInputTokens * MESSAGE_EMBEDDING_CHARS_PER_TOKEN * EMBEDDER_LIMIT_HEADROOM));
  }

  return DEFAULT_MESSAGE_EMBEDDING_MAX_CHUNK_CHARS;
}

/**
 * Vector row id for one chunk of a message. Chunk 0 keeps the message id, which is the id the
 * `SemanticRecall` processor has always written, so existing rows are replaced instead of
 * duplicated. Later chunks get a UUIDv8 derived from the message id and chunk index: stable
 * across writers and retries, and a UUID because some stores (Qdrant) reject other string ids.
 *
 * @internal
 */
export async function messageVectorId(messageId: string, chunkIndex: number): Promise<string> {
  if (chunkIndex === 0) return messageId;

  const digest = await globalThis.crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(JSON.stringify(['message-vector', messageId, chunkIndex])),
  );
  const bytes = new Uint8Array(digest);
  bytes[6] = (bytes[6]! & 0x0f) | 0x80;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes.subarray(0, 16), byte => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Builds the vector rows for messages. The `SemanticRecall` processor and `Memory` both write
 * through it, so a message gets the same rows whichever writer reaches it.
 *
 * Messages with no embeddable text, and messages already in `embeddedMessages` for this index with
 * the same text, produce no rows. When a message is written again with fewer chunks, rows for the
 * extra chunks stay until the message is updated or deleted, both of which remove rows by
 * `message_id`.
 *
 * @throws When a message has no id. Ids are assigned when messages enter a `MessageList`, so a
 * missing id means a caller skipped that step; a row without `message_id` could never be
 * recalled or deleted.
 * @internal
 */
export async function buildMessageEmbeddingRows({
  items,
  embed,
  maxChunkChars,
  loadThreadMetadata,
  defaults,
  embeddedMessages,
  indexName,
}: BuildMessageEmbeddingRowsOptions): Promise<MessageEmbeddingRows> {
  if (embeddedMessages && indexName === undefined) {
    throw new MastraError({
      id: 'MASTRA_MEMORY_EMBEDDED_MESSAGES_WITHOUT_INDEX',
      domain: ErrorDomain.MASTRA_MEMORY,
      category: ErrorCategory.SYSTEM,
      text: 'buildMessageEmbeddingRows needs indexName when embeddedMessages is given.',
    });
  }

  // A batch can name the same message twice (a save that repeats an id); only the last entry is
  // embedded, since both would write the same row ids.
  const latestById = new Map<string, MessageEmbeddingItem>();
  for (const item of items) {
    const { message } = item;
    if (!message.id) {
      throw new MastraError({
        id: 'MASTRA_MEMORY_EMBEDDING_MISSING_MESSAGE_ID',
        domain: ErrorDomain.MASTRA_MEMORY,
        category: ErrorCategory.SYSTEM,
        text: 'Cannot embed a message without an id.',
        details: { role: message.role, threadId: message.threadId ?? defaults?.threadId ?? '' },
      });
    }
    latestById.delete(message.id);
    latestById.set(message.id, item);
  }

  const pending: Array<{ message: MastraDBMessage; text: string; recordEntry: [string, string]; chunks: string[] }> =
    [];
  for (const { message, text: givenText } of latestById.values()) {
    const text =
      givenText === undefined
        ? extractMessageEmbeddingText(message)
        : isEmbeddable(message)
          ? removeWorkingMemoryTags(givenText ?? '').trim() || null
          : null;
    if (!text) continue;

    const recordKey = `${indexName ?? ''}\u0000${message.id}`;
    const textHash = await hash64(text);
    if (embeddedMessages?.get(recordKey) === textHash) continue;

    const chunks = chunkMessageText(text, maxChunkChars);
    if (chunks.length === 0) continue;
    pending.push({ message, text, recordEntry: [recordKey, textHash], chunks });
  }

  const rows: MessageEmbeddingRows = { ids: [], metadata: [], embeddedEntries: [] };
  if (pending.length === 0) return rows;

  if (embed) {
    // One embedder call per message, as both writers made before, so a request never carries
    // more than one message's chunks.
    const embedded = await Promise.all(pending.map(entry => embed(entry.chunks)));
    embedded.forEach((result, i) => {
      if (result.embeddings.length !== pending[i]!.chunks.length) {
        throw new MastraError({
          id: 'MASTRA_MEMORY_EMBEDDER_MISSING_EMBEDDINGS',
          domain: ErrorDomain.MASTRA_MEMORY,
          category: ErrorCategory.THIRD_PARTY,
          text: `The embedder returned ${result.embeddings.length} embeddings for ${pending[i]!.chunks.length} chunks.`,
        });
      }
    });
    rows.vectors = embedded.flatMap(result => result.embeddings);
    rows.dimension = rows.vectors[0]?.length;
    const tokens = embedded.reduce((sum, result) => sum + (result.usage?.tokens ?? 0), 0);
    if (tokens > 0) rows.usage = { tokens };
  } else {
    rows.documents = pending.flatMap(entry => entry.chunks);
  }

  const threadIds = [
    ...new Set(pending.map(({ message }) => message.threadId ?? defaults?.threadId).filter(id => id !== undefined)),
  ];
  const threadMetadata = loadThreadMetadata && threadIds.length > 0 ? await loadThreadMetadata(threadIds) : undefined;

  for (const { message, text, recordEntry, chunks } of pending) {
    const threadId = message.threadId ?? defaults?.threadId;
    const createdAt = message.createdAt instanceof Date ? message.createdAt.toISOString() : String(message.createdAt);
    for (const [chunkIndex] of chunks.entries()) {
      rows.ids.push(await messageVectorId(message.id, chunkIndex));
      rows.metadata.push({
        ...(threadId ? threadMetadata?.get(threadId) : undefined),
        message_id: message.id,
        thread_id: threadId,
        resource_id: message.resourceId ?? defaults?.resourceId,
        role: message.role,
        content: text,
        created_at: createdAt,
      });
    }
    rows.embeddedEntries.push(recordEntry);
  }

  return rows;
}

/**
 * Writes message rows built by {@link buildMessageEmbeddingRows}, always with their ids, then
 * records the embedded messages in `embeddedMessages`. Recording happens only after the write
 * succeeds, so a writer that fails leaves the message for the next writer to embed.
 *
 * @internal
 */
export async function upsertMessageVectors(
  vector: MastraVector,
  indexName: string,
  rows: MessageEmbeddingRows,
  embeddedMessages?: Map<string, string>,
): Promise<void> {
  if (rows.ids.length === 0) return;
  const values = rows.vectors ?? rows.documents;
  if (rows.metadata.length !== rows.ids.length || values?.length !== rows.ids.length) {
    throw new MastraError({
      id: 'MASTRA_MEMORY_MESSAGE_VECTOR_ROWS_MISALIGNED',
      domain: ErrorDomain.MASTRA_MEMORY,
      category: ErrorCategory.SYSTEM,
      text: 'Message vector rows must have one id, one metadata entry and one vector or document per row.',
      details: { ids: rows.ids.length, metadata: rows.metadata.length, values: values?.length ?? 0 },
    });
  }

  if (rows.vectors) {
    await vector.upsert({ indexName, ids: rows.ids, vectors: rows.vectors, metadata: rows.metadata });
  } else {
    // `documents` is accepted only by self-embedding stores, so it is not on the shared
    // UpsertVectorParams.
    await vector.upsert({ indexName, ids: rows.ids, documents: rows.documents, metadata: rows.metadata } as never);
  }

  for (const [recordKey, textHash] of rows.embeddedEntries) {
    embeddedMessages?.set(recordKey, textHash);
  }
}
