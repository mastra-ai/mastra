import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MastraDBMessage } from '../agent/message-list/state/types';
import { globalEmbeddingCache } from '../processors/memory/embedding-cache';
import type { MastraVector } from '../vector';
import {
  DEFAULT_MESSAGE_EMBEDDING_MAX_CHUNK_CHARS,
  buildMessageEmbeddingRows,
  chunkMessageText,
  extractMessageEmbeddingText,
  messageVectorId,
  resolveMaxChunkChars,
  upsertMessageVectors,
} from './message-embeddings';

const UUID_V8 = /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function message(overrides: Partial<MastraDBMessage> & { text?: string } = {}): MastraDBMessage {
  const { text = 'hello there', ...rest } = overrides;
  return {
    id: 'msg-1',
    role: 'user',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    threadId: 'thread-1',
    resourceId: 'resource-1',
    content: { format: 2, parts: [{ type: 'text', text }] },
    ...rest,
  };
}

function createEmbedder() {
  const doEmbed = vi.fn(async ({ values }: { values: string[] }) => ({
    embeddings: values.map(value => [value.length, 1, 0]),
  }));
  return {
    embedder: {
      specificationVersion: 'v2' as const,
      provider: 'test',
      modelId: `model-${Math.random()}`,
      maxEmbeddingsPerCall: 100,
      supportsParallelCalls: true,
      doEmbed,
    },
    doEmbed,
  };
}

beforeEach(() => {
  globalEmbeddingCache.clear();
});

describe('messageVectorId', () => {
  it('keeps the message id for the first chunk, so rows written before chunk ids existed are replaced', async () => {
    expect(await messageVectorId('msg-1', 0)).toBe('msg-1');
  });

  it('derives a stable UUID for later chunks, distinct per message and chunk', async () => {
    const first = await messageVectorId('msg-1', 1);
    expect(first).toMatch(UUID_V8);
    expect(await messageVectorId('msg-1', 1)).toBe(first);
    expect(await messageVectorId('msg-1', 2)).not.toBe(first);
    expect(await messageVectorId('msg-2', 1)).not.toBe(first);
  });
});

describe('extractMessageEmbeddingText', () => {
  it('never embeds system messages or transient signals', () => {
    expect(extractMessageEmbeddingText(message({ role: 'system' }))).toBeNull();
    expect(
      extractMessageEmbeddingText({
        ...message({ role: 'signal' }),
        content: { format: 2, parts: [{ type: 'text', text: 'ping' }], metadata: { signal: { transient: true } } },
      }),
    ).toBeNull();
  });

  it('joins text parts with a space and removes working-memory tags', () => {
    const msg = message();
    msg.content.parts = [
      { type: 'text', text: 'first <working_memory>secret</working_memory>' },
      { type: 'text', text: '<working_memory>only memory</working_memory>' },
      { type: 'text', text: 'second' },
    ];
    expect(extractMessageEmbeddingText(msg)).toBe('first second');
  });

  it('prefers content.content when it has text', () => {
    const msg = message({ text: 'from parts' });
    msg.content.content = 'from content';
    expect(extractMessageEmbeddingText(msg)).toBe('from content');
  });
});

describe('chunkMessageText', () => {
  it('returns one chunk for short text', () => {
    expect(chunkMessageText('short text', 100)).toEqual(['short text']);
  });

  it('keeps every chunk under the ceiling, including unbroken words', () => {
    const text = `${'word '.repeat(50)}${'x'.repeat(250)}`;
    const chunks = chunkMessageText(text, 64);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(64);
    expect(chunks.join('').replace(/\s/g, '')).toBe(text.replace(/\s/g, ''));
  });
});

describe('resolveMaxChunkChars', () => {
  it('uses the explicit option first', () => {
    expect(resolveMaxChunkChars({ maxChunkChars: 2000, embedder: { maxInputTokens: 512 } })).toBe(2000);
  });

  it('converts the embedder token window with headroom when no option is set', () => {
    expect(resolveMaxChunkChars({ embedder: { maxInputTokens: 512 } })).toBe(1536);
  });

  it('falls back to about 4096 English tokens', () => {
    expect(resolveMaxChunkChars({})).toBe(DEFAULT_MESSAGE_EMBEDDING_MAX_CHUNK_CHARS);
    expect(DEFAULT_MESSAGE_EMBEDDING_MAX_CHUNK_CHARS).toBe(16_384);
  });

  it('rejects a non-positive option', () => {
    expect(() => resolveMaxChunkChars({ maxChunkChars: 0 })).toThrow(/maxChunkChars/);
  });
});

describe('buildMessageEmbeddingRows', () => {
  it('writes one row per chunk with stable ids, so saving a long message again replaces its rows', async () => {
    const { embedder } = createEmbedder();
    const long = message({ text: 'lorem ipsum '.repeat(40) });
    const first = await buildMessageEmbeddingRows({ items: [{ message: long }], embedder, maxChunkChars: 100 });
    const second = await buildMessageEmbeddingRows({ items: [{ message: long }], embedder, maxChunkChars: 100 });

    expect(first.ids.length).toBeGreaterThan(1);
    expect(first.ids[0]).toBe('msg-1');
    expect(first.ids.slice(1).every(id => UUID_V8.test(id))).toBe(true);
    expect(second.ids).toEqual(first.ids);
    expect(first.vectors).toHaveLength(first.ids.length);
    expect(first.metadata.every(row => row.message_id === 'msg-1')).toBe(true);
  });

  it('skips a message the run already embedded, and embeds it again once its text changes', async () => {
    const { embedder, doEmbed } = createEmbedder();
    const embeddedMessages = new Map<string, string>();
    const vector = { upsert: vi.fn() } as unknown as MastraVector;

    const rows = await buildMessageEmbeddingRows({ items: [{ message: message() }], embedder, maxChunkChars: 100 });
    await upsertMessageVectors(vector, 'index', rows, embeddedMessages);
    expect(embeddedMessages.has('msg-1')).toBe(true);

    const repeat = await buildMessageEmbeddingRows({
      items: [{ message: message() }],
      embedder,
      maxChunkChars: 100,
      embeddedMessages,
    });
    expect(repeat.ids).toEqual([]);

    const edited = await buildMessageEmbeddingRows({
      items: [{ message: message({ text: 'rewritten by a later processor' }) }],
      embedder,
      maxChunkChars: 100,
      embeddedMessages,
    });
    expect(edited.ids).toEqual(['msg-1']);
    expect(edited.metadata[0]!.content).toBe('rewritten by a later processor');
    expect(doEmbed).toHaveBeenCalledTimes(2);
  });

  it('reuses embeddings across writers instead of calling the embedder again', async () => {
    const { embedder, doEmbed } = createEmbedder();
    await buildMessageEmbeddingRows({ items: [{ message: message() }], embedder, maxChunkChars: 100 });
    await buildMessageEmbeddingRows({ items: [{ message: message() }], embedder, maxChunkChars: 100 });
    expect(doEmbed).toHaveBeenCalledTimes(1);
  });

  it('fills thread and resource from the run when the message has none, and keeps fixed fields over thread metadata', async () => {
    const rows = await buildMessageEmbeddingRows({
      items: [{ message: message({ threadId: undefined, resourceId: undefined }) }],
      maxChunkChars: 100,
      defaults: { threadId: 'thread-run', resourceId: 'resource-run' },
      threadMetadata: new Map([['thread-run', { projectId: 'p1', message_id: 'spoofed' }]]),
    });

    expect(rows.documents).toEqual(['hello there']);
    expect(rows.metadata[0]).toMatchObject({
      projectId: 'p1',
      message_id: 'msg-1',
      thread_id: 'thread-run',
      resource_id: 'resource-run',
      role: 'user',
      content: 'hello there',
      created_at: '2026-01-01T00:00:00.000Z',
    });
  });

  it('embeds a repeated message once, using its last entry', async () => {
    const rows = await buildMessageEmbeddingRows({
      items: [{ message: message({ text: 'old' }) }, { message: message({ text: 'new' }) }],
      maxChunkChars: 100,
    });
    expect(rows.ids).toEqual(['msg-1']);
    expect(rows.documents).toEqual(['new']);
  });

  it('throws for a message without an id', async () => {
    await expect(
      buildMessageEmbeddingRows({ items: [{ message: message({ id: '' }) }], maxChunkChars: 100 }),
    ).rejects.toThrow(/without an id/);
  });
});

describe('upsertMessageVectors', () => {
  it('leaves the message unrecorded when the write fails, so the next writer embeds it', async () => {
    const embeddedMessages = new Map<string, string>();
    const vector = { upsert: vi.fn().mockRejectedValue(new Error('store down')) } as unknown as MastraVector;
    const rows = await buildMessageEmbeddingRows({ items: [{ message: message() }], maxChunkChars: 100 });

    await expect(upsertMessageVectors(vector, 'index', rows, embeddedMessages)).rejects.toThrow('store down');
    expect(embeddedMessages.size).toBe(0);
  });

  it('always sends row ids', async () => {
    const upsert = vi.fn();
    const rows = await buildMessageEmbeddingRows({ items: [{ message: message() }], maxChunkChars: 100 });
    await upsertMessageVectors({ upsert } as unknown as MastraVector, 'index', rows);
    expect(upsert.mock.calls[0]![0]).toMatchObject({ indexName: 'index', ids: ['msg-1'], documents: ['hello there'] });
  });
});
