import { embedMany as embedManyV1 } from '@internal/ai-sdk-v4';
import { embedMany as embedManyV2 } from '@internal/ai-sdk-v5';
import { embedMany as embedManyV3 } from '@internal/ai-v6';
import { embedMany as embedManyV4 } from '@internal/ai-v7';
import xxhash from 'xxhash-wasm';
import type { MastraDBMessage } from '../agent/message-list/state/types';
import { isTransientSignalMessage } from '../agent/signals';
import { ErrorCategory, ErrorDomain, MastraError } from '../error';
import { globalEmbeddingCache } from '../processors/memory/embedding-cache';
import type { MastraEmbeddingModel, MastraEmbeddingOptions, MastraVector } from '../vector';
import { removeWorkingMemoryTags } from './working-memory-utils';

/**
 * Average characters per English token. Chunking measures characters because no single
 * tokenizer matches every embedder, so token limits are converted with this ratio.
 */
export const MESSAGE_EMBEDDING_CHARS_PER_TOKEN = 4;

/**
 * Default ceiling, in characters, for one chunk of message text sent to the embedder.
 * About 4096 English tokens, which fits `openai/text-embedding-3-small` (8191 tokens).
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

/** One message to embed. */
export interface MessageEmbeddingItem {
  message: MastraDBMessage;
  /**
   * Text to embed instead of the text read from `message`. `Memory.updateMessages` passes the
   * projected text of an edit here, because the stored row it reads metadata from still holds
   * the old text.
   */
  text?: string | null;
}

/** Options for {@link buildMessageEmbeddingRows}. */
export interface BuildMessageEmbeddingRowsOptions {
  items: MessageEmbeddingItem[];
  /**
   * Client-side embedder. When omitted the rows carry `documents` instead of `vectors`, for
   * vector stores that embed text themselves.
   */
  embedder?: MastraEmbeddingModel<string>;
  embedderOptions?: MastraEmbeddingOptions;
  /** Character ceiling per chunk. Resolve it with {@link resolveMaxChunkChars}. */
  maxChunkChars: number;
  /**
   * Metadata of each message's thread, spread under the fixed fields so `semanticRecall.filter`
   * can match thread attributes. Keyed by thread id.
   */
  threadMetadata?: Map<string, Record<string, unknown>>;
  /**
   * Thread and resource used when a message does not carry its own. Agent runs pass the run's
   * thread and resource, because resource-scoped recall filters rows by `resource_id`.
   */
  defaults?: { threadId?: string; resourceId?: string };
  /**
   * The run's record of messages already embedded, from `MessageList.getEmbeddedMessages()`.
   * Messages recorded with the same text are skipped.
   */
  embeddedMessages?: Map<string, string>;
}

/** Rows ready for {@link upsertMessageVectors}. Every array lines up index by index. */
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
  /** Tokens billed by the embedder for chunks that were not cached. */
  usage?: { tokens: number };
  /**
   * `[messageId, textHash]` pairs for the messages these rows embed. {@link upsertMessageVectors}
   * adds them to the run's record only after the write succeeds.
   */
  embeddedEntries: Array<[string, string]>;
}

const hasherPromise = xxhash();

async function hash64(text: string): Promise<string> {
  return (await hasherPromise).h64(text).toString(16);
}

/**
 * Text of a message as semantic recall embeds it, or `null` when the message is not embedded.
 * System messages and transient signals are never stored, working-memory tags are removed,
 * and text parts are joined with a space.
 */
export function extractMessageEmbeddingText(message: MastraDBMessage): string | null {
  if (message.role === 'system' || isTransientSignalMessage(message)) return null;

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

// fastembed downloads its model on first use, and concurrent first calls fail while the
// download runs, so later calls on the same model wait for the first one.
const firstFastEmbedCall = new WeakMap<object, Promise<unknown>>();

function callEmbedMany(
  model: MastraEmbeddingModel<string>,
  values: string[],
  embedderOptions: MastraEmbeddingOptions | undefined,
): Promise<{ embeddings: number[][]; usage?: { tokens?: number } }> {
  const options = { values, maxRetries: 3 };
  // Options share a public union; select the SDK-specific options alongside the model version.
  switch (model.specificationVersion) {
    case 'v4':
      return embedManyV4({
        ...options,
        ...(embedderOptions as Omit<Parameters<typeof embedManyV4>[0], 'model' | 'values'>),
        model,
      });
    case 'v3':
      return embedManyV3({
        ...options,
        ...(embedderOptions as Omit<Parameters<typeof embedManyV3>[0], 'model' | 'values'>),
        model,
      });
    case 'v2':
      return embedManyV2({
        ...options,
        ...(embedderOptions as Omit<Parameters<typeof embedManyV2>[0], 'model' | 'values'>),
        model,
      });
    default:
      return embedManyV1({
        ...options,
        ...(embedderOptions as Omit<Parameters<typeof embedManyV1>[0], 'model' | 'values'>),
        model,
      });
  }
}

/**
 * Embeds each text, reusing {@link globalEmbeddingCache} so a text embedded by any writer in
 * this process is not sent to the embedder again. Cache keys include the embedder and its
 * provider options, because those decide the vector.
 *
 * @returns One embedding per input text, in order, plus the tokens billed for uncached texts.
 */
export async function embedTexts(
  embedder: MastraEmbeddingModel<string>,
  texts: string[],
  embedderOptions?: MastraEmbeddingOptions,
): Promise<{ embeddings: number[][]; usage?: { tokens: number }; dimension?: number }> {
  const embedderKey = `${embedder.provider}:${embedder.modelId}:${await hash64(
    JSON.stringify(embedderOptions?.providerOptions ?? {}),
  )}`;
  const keys = await Promise.all(texts.map(async text => `${embedderKey}:${await hash64(text)}`));
  const embeddings: (number[] | undefined)[] = keys.map(key => globalEmbeddingCache.get(key));

  const missing = [...new Set(keys.filter((_, i) => !embeddings[i]))];
  let usage: { tokens: number } | undefined;
  if (missing.length > 0) {
    const missingTexts = missing.map(key => texts[keys.indexOf(key)]!);
    const pending = firstFastEmbedCall.get(embedder);
    if (embedder.provider === 'fastembed' && pending) await pending.catch(() => undefined);

    const call = callEmbedMany(embedder, missingTexts, embedderOptions);
    if (embedder.provider === 'fastembed' && !pending) firstFastEmbedCall.set(embedder, call);
    const result = await call;

    missing.forEach((key, i) => {
      const embedding = result.embeddings[i];
      if (embedding) globalEmbeddingCache.set(key, embedding);
    });
    if (typeof result.usage?.tokens === 'number') usage = { tokens: result.usage.tokens };
    keys.forEach((key, i) => {
      embeddings[i] ??= globalEmbeddingCache.get(key);
    });
  }

  if (embeddings.some(embedding => !embedding)) {
    throw new MastraError({
      id: 'MASTRA_MEMORY_EMBEDDER_MISSING_EMBEDDINGS',
      domain: ErrorDomain.MASTRA_MEMORY,
      category: ErrorCategory.THIRD_PARTY,
      text: `The embedder returned fewer embeddings than texts it was given (${texts.length}).`,
    });
  }

  const complete = embeddings as number[][];
  return { embeddings: complete, usage, dimension: complete[0]?.length };
}

/**
 * Builds the vector rows for messages, the one place that decides what a message vector row
 * contains. Both the `SemanticRecall` processor and `Memory` write through it, so a message gets
 * the same rows whichever writer reaches it.
 *
 * Messages with no embeddable text, and messages already in `embeddedMessages` with the same
 * text, produce no rows.
 *
 * @throws When a message has no id. Ids are assigned when messages enter a `MessageList`, so a
 * missing id means a caller skipped that step; a row without `message_id` could never be
 * recalled or deleted.
 */
export async function buildMessageEmbeddingRows({
  items,
  embedder,
  embedderOptions,
  maxChunkChars,
  threadMetadata,
  defaults,
  embeddedMessages,
}: BuildMessageEmbeddingRowsOptions): Promise<MessageEmbeddingRows> {
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

  const pending: Array<{ message: MastraDBMessage; text: string; textHash: string; chunks: string[] }> = [];
  for (const { message, text: overrideText } of latestById.values()) {
    const text = overrideText === undefined ? extractMessageEmbeddingText(message) : overrideText?.trim() || null;
    if (!text) continue;

    const textHash = await hash64(text);
    if (embeddedMessages?.get(message.id) === textHash) continue;

    const chunks = chunkMessageText(text, maxChunkChars);
    if (chunks.length === 0) continue;
    pending.push({ message, text, textHash, chunks });
  }

  const rows: MessageEmbeddingRows = { ids: [], metadata: [], embeddedEntries: [] };
  if (pending.length === 0) return rows;

  if (embedder) {
    // One embedder call per message, as both writers made before, so a request never carries
    // more than one message's chunks.
    const embedded = await Promise.all(pending.map(entry => embedTexts(embedder, entry.chunks, embedderOptions)));
    rows.vectors = embedded.flatMap(result => result.embeddings);
    rows.dimension = rows.vectors[0]?.length;
    const tokens = embedded.reduce((sum, result) => sum + (result.usage?.tokens ?? 0), 0);
    if (tokens > 0) rows.usage = { tokens };
  } else {
    rows.documents = pending.flatMap(entry => entry.chunks);
  }

  for (const { message, text, textHash, chunks } of pending) {
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
    rows.embeddedEntries.push([message.id, textHash]);
  }

  return rows;
}

/**
 * Writes message rows built by {@link buildMessageEmbeddingRows}, always with their ids, then
 * records the embedded messages in `embeddedMessages`. Recording happens only after the write
 * succeeds, so a writer that fails leaves the message for the next writer to embed.
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

  for (const [messageId, textHash] of rows.embeddedEntries) {
    embeddedMessages?.set(messageId, textHash);
  }
}
