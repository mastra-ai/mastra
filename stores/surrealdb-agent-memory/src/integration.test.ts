import { InMemoryStore } from '@mastra/core/storage';
import { AgentMemory as AgentMemoryClient } from '@surrealdb/memory';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { searchDocuments } from './documents';
import { AgentMemory } from './memory';

const endpoint = process.env['AGENT_MEMORY_ENDPOINT'];
const context = process.env['AGENT_MEMORY_CONTEXT'];
const apiKey = process.env['AGENT_MEMORY_API_KEY'];
const hasCreds = Boolean(endpoint && context && apiKey);

describe.skipIf(!hasCreds)('AgentMemory (integration)', () => {
  // Constructed in beforeAll so nothing runs at collection time when skipped.
  let client: AgentMemoryClient;
  beforeAll(() => {
    client = new AgentMemoryClient({
      endpoint: endpoint as string,
      context: context as string,
      apiKey: apiKey as string,
    });
  });

  it('round-trips remember -> recall through the memory provider', async () => {
    const memory = new AgentMemory({
      agentMemory: client,
      storage: new InMemoryStore(),
      blocking: true,
      agentMemoryRecall: { topK: 5 },
    });
    const threadId = `it-${Date.now()}`;
    await memory.saveThread({
      thread: {
        id: threadId,
        resourceId: 'it-user',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    await memory.saveMessages({
      messages: [
        {
          id: `${threadId}-1`,
          role: 'user',
          type: 'text',
          threadId,
          resourceId: 'it-user',
          createdAt: new Date(),
          content: {
            format: 2,
            parts: [
              {
                type: 'text',
                text: 'My favourite colour is teal.',
              },
            ],
          },
        } as never,
      ],
    });

    // The verbatim message always comes back from storage, so only a synthesized
    // `agentMemory:` hit proves the round trip. Extraction can finish after the write.
    await vi.waitFor(
      async () => {
        const res = await memory.recall({
          threadId,
          resourceId: 'it-user',
          vectorSearchString: 'favourite colour',
        } as never);
        expect(res.messages.some(m => m.id.startsWith('agentMemory:'))).toBe(true);
      },
      { timeout: 45_000, interval: 2_000 },
    );
  }, 60_000);

  it('searches the document corpus', async () => {
    const res = await searchDocuments(client, {
      query: 'test',
      k: 3,
    });
    expect(res).toBeDefined();
  });
});
