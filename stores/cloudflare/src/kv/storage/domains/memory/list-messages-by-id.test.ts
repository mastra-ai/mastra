import type { KVNamespace } from '@cloudflare/workers-types';
import { TABLE_MESSAGES, TABLE_RESOURCES, TABLE_THREADS } from '@mastra/core/storage';
import { Miniflare } from 'miniflare';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryStorageCloudflare } from '.';

const threadId = 'thread-1';
const resourceId = 'resource-1';

describe('listMessagesById', () => {
  let mf: Miniflare;
  let failLookups: boolean;
  let memory: MemoryStorageCloudflare;

  beforeEach(async () => {
    mf = new Miniflare({
      script: 'export default {};',
      modules: true,
      kvNamespaces: [TABLE_THREADS, TABLE_MESSAGES, TABLE_RESOURCES],
    });
    failLookups = false;
    const messages = (await mf.getKVNamespace(TABLE_MESSAGES)) as unknown as KVNamespace;
    // Miniflare bindings are proxies, so fail lookups through a wrapper rather than a spy.
    const messagesNamespace = new Proxy(messages, {
      get(target, prop) {
        if (prop === 'getWithMetadata' && failLookups) return () => Promise.reject(new Error('KV unavailable'));
        const value = Reflect.get(target, prop);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    memory = new MemoryStorageCloudflare({
      bindings: {
        [TABLE_THREADS]: await mf.getKVNamespace(TABLE_THREADS),
        [TABLE_MESSAGES]: messagesNamespace,
        [TABLE_RESOURCES]: await mf.getKVNamespace(TABLE_RESOURCES),
      } as any,
      keyPrefix: 'test',
    });
    (memory as any).logger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), trackException: vi.fn() };

    await memory.saveThread({
      thread: { id: threadId, resourceId, title: 'Test', createdAt: new Date(), updatedAt: new Date() },
    });
    await memory.saveMessages({
      messages: [
        {
          id: 'msg-1',
          threadId,
          resourceId,
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'hello' }] },
          createdAt: new Date(),
        },
      ],
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await mf.dispose();
  });

  it('returns stored messages and omits ids that do not exist', async () => {
    const { messages } = await memory.listMessagesById({ messageIds: ['msg-1', 'missing'] });
    expect(messages.map(message => message.id)).toEqual(['msg-1']);
  });

  // An empty result means the messages were deleted, so a failed lookup must not look like one.
  it('throws when the lookup fails instead of reporting the messages as missing', async () => {
    failLookups = true;

    await expect(memory.listMessagesById({ messageIds: ['msg-1'] })).rejects.toMatchObject({
      id: 'MASTRA_STORAGE_CLOUDFLARE_LIST_MESSAGES_BY_ID_FAILED',
    });
  });
});
