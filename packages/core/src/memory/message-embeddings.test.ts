import { describe, expect, it, vi } from 'vitest';
import type { MastraDBMessage } from '../agent/message-list/state/types';
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
// Message ids are UUIDs by default; tests that need another shape say so.
const MESSAGE_ID = '0b9c3f5e-6a2d-4c1e-9f3a-2d7b8e1c4a55';

/** A stored user message with one text part, overridable per test. */
function message(overrides: Partial<MastraDBMessage> & { text?: string } = {}): MastraDBMessage {
  const { text = 'hello there', ...rest } = overrides;
  return {
    id: MESSAGE_ID,
    role: 'user',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    threadId: 'thread-1',
    resourceId: 'resource-1',
    content: { format: 2, parts: [{ type: 'text', text }] },
    ...rest,
  };
}

const embed = vi.fn(async (chunks: string[]) => ({ embeddings: chunks.map(chunk => [chunk.length, 1, 0]) }));

describe('messageVectorId', () => {
  it('keeps a UUID or integer message id for the first chunk, so rows written before chunk ids existed are replaced', async () => {
    expect(await messageVectorId(MESSAGE_ID, 0)).toBe(MESSAGE_ID);
    expect(await messageVectorId('42', 0)).toBe('42');
  });

  it('derives a UUID for the first chunk of any other message id, which Qdrant would reject', async () => {
    const id = await messageVectorId('msg-abc123', 0);
    expect(id).toMatch(UUID_V8);
    expect(await messageVectorId('msg-abc123', 0)).toBe(id);
    expect(await messageVectorId('msg-abc123', 1)).not.toBe(id);
  });

  it('derives a stable UUID for later chunks, distinct per message and chunk', async () => {
    const first = await messageVectorId(MESSAGE_ID, 1);
    expect(first).toMatch(UUID_V8);
    expect(await messageVectorId(MESSAGE_ID, 1)).toBe(first);
    expect(await messageVectorId(MESSAGE_ID, 2)).not.toBe(first);
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
    const long = message({ text: 'lorem ipsum '.repeat(40) });
    const first = await buildMessageEmbeddingRows({ items: [{ message: long }], embed, maxChunkChars: 100 });
    const second = await buildMessageEmbeddingRows({ items: [{ message: long }], embed, maxChunkChars: 100 });

    expect(first.ids.length).toBeGreaterThan(1);
    expect(first.ids[0]).toBe(MESSAGE_ID);
    expect(first.ids.slice(1).every(id => UUID_V8.test(id))).toBe(true);
    expect(second.ids).toEqual(first.ids);
    expect(first.vectors).toHaveLength(first.ids.length);
    expect(first.metadata.every(row => row.message_id === MESSAGE_ID)).toBe(true);
  });

  it('skips a message the run already embedded into the same index, and embeds it again once its text changes', async () => {
    const embeddedMessages = new Map<string, string>();
    const vector = { upsert: vi.fn() } as unknown as MastraVector;
    const options = { embed, maxChunkChars: 100, embeddedMessages, indexName: 'memory_messages' };

    const rows = await buildMessageEmbeddingRows({ ...options, items: [{ message: message() }] });
    await upsertMessageVectors(vector, 'memory_messages', rows, embeddedMessages);

    const repeat = await buildMessageEmbeddingRows({ ...options, items: [{ message: message() }] });
    expect(repeat.ids).toEqual([]);

    const edited = await buildMessageEmbeddingRows({
      ...options,
      items: [{ message: message({ text: 'rewritten by a later processor' }) }],
    });
    expect(edited.ids).toEqual([MESSAGE_ID]);
    expect(edited.metadata[0]!.content).toBe('rewritten by a later processor');
  });

  it('still embeds a recorded message for a writer that targets another index', async () => {
    const embeddedMessages = new Map<string, string>();
    const vector = { upsert: vi.fn() } as unknown as MastraVector;
    const items = [{ message: message() }];

    const custom = await buildMessageEmbeddingRows({
      items,
      embed,
      maxChunkChars: 100,
      embeddedMessages,
      indexName: 'custom',
    });
    await upsertMessageVectors(vector, 'custom', custom, embeddedMessages);

    const memoryIndex = await buildMessageEmbeddingRows({
      items,
      embed,
      maxChunkChars: 100,
      embeddedMessages,
      indexName: 'memory_messages',
    });
    expect(memoryIndex.ids).toEqual([MESSAGE_ID]);
  });

  it('reads thread metadata only when something will be written', async () => {
    const loadThreadMetadata = vi.fn(async () => new Map([['thread-1', { projectId: 'p1' }]]));
    const embeddedMessages = new Map<string, string>();
    const vector = { upsert: vi.fn() } as unknown as MastraVector;
    const options = { embed, maxChunkChars: 100, embeddedMessages, indexName: 'i', loadThreadMetadata };

    const rows = await buildMessageEmbeddingRows({ ...options, items: [{ message: message() }] });
    await upsertMessageVectors(vector, 'i', rows, embeddedMessages);
    await buildMessageEmbeddingRows({ ...options, items: [{ message: message() }] });

    expect(loadThreadMetadata).toHaveBeenCalledTimes(1);
    expect(rows.metadata[0]).toMatchObject({ projectId: 'p1' });
  });

  it('fills thread and resource from the run when the message has none, and keeps fixed fields over thread metadata', async () => {
    const rows = await buildMessageEmbeddingRows({
      items: [{ message: message({ threadId: undefined, resourceId: undefined }) }],
      maxChunkChars: 100,
      defaults: { threadId: 'thread-run', resourceId: 'resource-run' },
      loadThreadMetadata: async () => new Map([['thread-run', { projectId: 'p1', message_id: 'spoofed' }]]),
    });

    expect(rows.documents).toEqual(['hello there']);
    expect(rows.metadata[0]).toMatchObject({
      projectId: 'p1',
      message_id: MESSAGE_ID,
      thread_id: 'thread-run',
      resource_id: 'resource-run',
      role: 'user',
      content: 'hello there',
      created_at: '2026-01-01T00:00:00.000Z',
    });
  });

  it('writes the other messages when one fails to embed and an error handler is given', async () => {
    const onEmbedError = vi.fn();
    const items = [{ message: message({ id: 'ok', text: 'fine' }) }, { message: message({ id: 'bad', text: 'boom' }) }];
    const flakyEmbed = async (chunks: string[]) => {
      if (chunks[0] === 'boom') throw new Error('rate limited');
      return { embeddings: chunks.map(() => [1, 0, 0]) };
    };

    const rows = await buildMessageEmbeddingRows({
      items,
      embed: flakyEmbed,
      onEmbedError,
      maxChunkChars: 100,
      embeddedMessages: new Map(),
      indexName: 'i',
    });

    expect(rows.metadata.map(row => row.message_id)).toEqual(['ok']);
    expect(rows.embeddedEntries.map(([key]) => key)).toEqual(['i\u0000ok']);
    expect(onEmbedError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'rate limited' }),
      expect.objectContaining({ id: 'bad' }),
    );
    await expect(buildMessageEmbeddingRows({ items, embed: flakyEmbed, maxChunkChars: 100 })).rejects.toThrow(
      'rate limited',
    );
  });

  it('keeps a large batch to a few embedder requests at a time', async () => {
    let inFlight = 0;
    let peak = 0;
    const items = Array.from({ length: 20 }, (_, i) => ({ message: message({ id: `m${i}`, text: `text ${i}` }) }));
    await buildMessageEmbeddingRows({
      items,
      embed: async chunks => {
        peak = Math.max(peak, ++inFlight);
        await new Promise(resolve => setTimeout(resolve, 1));
        inFlight--;
        return { embeddings: chunks.map(() => [1, 0, 0]) };
      },
      maxChunkChars: 100,
    });
    expect(peak).toBeLessThanOrEqual(4);
  });

  it('leaves nested clone bookkeeping out of row metadata', async () => {
    const rows = await buildMessageEmbeddingRows({
      items: [{ message: message() }],
      maxChunkChars: 100,
      loadThreadMetadata: async () =>
        new Map([['thread-1', { projectId: 'p1', clone: { sourceThreadId: 't0', clonedAt: new Date() } }]]),
    });
    expect(rows.metadata[0]).toMatchObject({ projectId: 'p1' });
    expect(rows.metadata[0]).not.toHaveProperty('clone');
  });

  it('applies the text rules to text passed in by an edit', async () => {
    const edited = await buildMessageEmbeddingRows({
      items: [{ message: message(), text: 'kept <working_memory>hidden</working_memory>' }],
      maxChunkChars: 100,
    });
    const system = await buildMessageEmbeddingRows({
      items: [{ message: message({ role: 'system' }), text: 'instructions' }],
      maxChunkChars: 100,
    });

    expect(edited.documents).toEqual(['kept']);
    expect(system.ids).toEqual([]);
  });

  it('embeds a repeated message once, using its last entry', async () => {
    const rows = await buildMessageEmbeddingRows({
      items: [{ message: message({ text: 'old' }) }, { message: message({ text: 'new' }) }],
      maxChunkChars: 100,
    });
    expect(rows.ids).toEqual([MESSAGE_ID]);
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
    const rows = await buildMessageEmbeddingRows({
      items: [{ message: message() }],
      maxChunkChars: 100,
      embeddedMessages,
      indexName: 'index',
    });

    await expect(upsertMessageVectors(vector, 'index', rows, embeddedMessages)).rejects.toThrow('store down');
    expect(embeddedMessages.size).toBe(0);
  });

  it('always sends row ids', async () => {
    const upsert = vi.fn();
    const rows = await buildMessageEmbeddingRows({ items: [{ message: message() }], maxChunkChars: 100 });
    await upsertMessageVectors({ upsert } as unknown as MastraVector, 'index', rows);
    expect(upsert.mock.calls[0]![0]).toMatchObject({
      indexName: 'index',
      ids: [MESSAGE_ID],
      documents: ['hello there'],
    });
  });
});
