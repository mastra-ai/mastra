import { InMemoryStore } from '@mastra/core/storage';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Memory } from './index';

// Mock embedMany across AI SDK versions so embedMessageContent does no network I/O.
vi.mock('@internal/ai-v6', () => ({
  embedMany: vi.fn(async ({ values }: { values: string[] }) => ({
    values,
    embeddings: values.map(() => [0.1, 0.2]),
    usage: { tokens: 1 },
    warnings: [],
  })),
}));
vi.mock('@internal/ai-sdk-v5', () => ({
  embedMany: vi.fn(async ({ values }: { values: string[] }) => ({
    values,
    embeddings: values.map(() => [0.1, 0.2]),
    usage: { tokens: 1 },
    warnings: [],
  })),
}));
vi.mock('@internal/ai-sdk-v4', () => ({
  embedMany: vi.fn(async ({ values }: { values: string[] }) => ({
    values,
    embeddings: values.map(() => [0.1, 0.2]),
    usage: { tokens: 1 },
    warnings: [],
  })),
}));

function createMemory() {
  const upsert = vi.fn().mockResolvedValue('id');
  const memory = new Memory({
    storage: new InMemoryStore(),
    vector: {
      upsert,
      createIndex: vi.fn().mockResolvedValue({ indexName: 'test-index' }),
      query: vi.fn().mockResolvedValue([]),
      describeIndex: vi.fn(),
    } as any,
    embedder: {
      specificationVersion: 'v3',
      provider: 'test',
      modelId: 'test-model',
      doEmbed: vi.fn().mockResolvedValue({ embeddings: [[0.1, 0.2]], usage: { tokens: 1 }, warnings: [] }),
    } as any,
    options: { semanticRecall: true },
  });
  return { memory, upsert };
}

describe('saveMessages vector sync', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes vectors for the rows the adapter persisted, not the caller input', async () => {
    const { memory, upsert } = createMemory();
    const resourceId = 'vector-sync-resource';
    const threadId = 'vector-sync-thread';
    await memory.saveThread({
      thread: {
        id: threadId,
        resourceId,
        title: 'Vector sync',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {},
      },
    });

    const memoryStore = await memory.storage.getStore('memory');
    const saveMessages = memoryStore!.saveMessages.bind(memoryStore);
    vi.spyOn(memoryStore!, 'saveMessages').mockImplementation(async ({ messages }) => {
      const result = await saveMessages({ messages });
      // Adapters normalize what they store: the persisted row is what a later
      // read returns, so its text is what semantic recall must embed.
      return {
        ...result,
        messages: result.messages.map(message => ({
          ...message,
          content: { format: 2 as const, parts: [{ type: 'text' as const, text: 'persisted text' }] },
        })),
      };
    });

    const createdAt = new Date();
    await memory.saveMessages({
      messages: [
        {
          id: 'persist-me',
          role: 'user',
          resourceId,
          threadId,
          createdAt,
          content: { format: 2, parts: [{ type: 'text', text: 'caller text' }] },
        },
      ],
    });

    expect(upsert).toHaveBeenCalled();
    const metadata = upsert.mock.calls.flatMap(call => (call[0] as { metadata: { content?: string }[] }).metadata);
    expect(metadata.map(entry => entry.content)).toContain('persisted text');
    expect(metadata.map(entry => entry.content)).not.toContain('caller text');
  });
});
