import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { MastraDBMessage } from '@mastra/core/agent';
import { InMemoryStore } from '@mastra/core/storage';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { describe, expect, it } from 'vitest';
import { getBranchingTests } from './shared/branching';
import { mockEmbedder } from './worker/mock-embedder';

const resourceId = 'branch-integration-resource';
const baseTime = new Date('2026-03-01T00:00:00.000Z');

function message(id: string, threadId: string, offset: number): MastraDBMessage {
  return {
    id,
    threadId,
    resourceId,
    role: 'user',
    content: { format: 2, parts: [{ type: 'text', text: id }] },
    createdAt: new Date(baseTime.getTime() + offset),
  };
}

getBranchingTests('InMemory', async () => ({
  memory: new Memory({
    storage: new InMemoryStore(),
    options: { lastMessages: false, generateTitle: false },
  }),
}));

getBranchingTests('LibSQL', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'memory-branch-contract-'));
  const memory = new Memory({
    storage: new LibSQLStore({ id: randomUUID(), url: `file:${join(directory, 'test.db')}` }),
    options: { lastMessages: false, generateTitle: false },
  });

  return {
    memory,
    cleanup: () => rm(directory, { recursive: true, force: true }),
  };
});

describe('shared-history branch Observational Memory integration', () => {
  it('preserves equal-timestamp cursor IDs through LibSQL reflection persistence and restart', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'memory-branch-om-integration-'));
    const dbPath = join(directory, 'test.db');
    const storage = new LibSQLStore({ id: randomUUID(), url: `file:${dbPath}` });
    const memory = new Memory({
      storage,
      options: { observationalMemory: { enabled: true, scope: 'thread' }, generateTitle: false },
    });

    try {
      await memory.createThread({ threadId: 'root', resourceId });
      await memory.saveMessages({ messages: [message('observed', 'root', 1), message('unobserved', 'root', 1)] });
      const store = (await storage.getStore('memory'))!;
      const record = await store.initializeObservationalMemory({
        threadId: 'root',
        resourceId,
        scope: 'thread',
        config: {},
      });
      const cursorTime = new Date(baseTime.getTime() + 1);
      await store.createReflectionGeneration({
        currentRecord: {
          ...record,
          lastObservedAt: cursorTime,
          metadata: {
            __mastra_observation_cursor: {
              lastObservedAt: cursorTime.toISOString(),
              messageIds: ['observed'],
            },
          },
        },
        reflection: 'reflected observations',
        tokenCount: 1,
      });

      const restarted = new Memory({
        storage,
        options: { observationalMemory: { enabled: true, scope: 'thread' }, generateTitle: false },
      });
      const engine = (await restarted.omEngine)!;
      const loaded = await engine.loadUnobservedMessages({ threadId: 'root', resourceId });
      expect(loaded.map(item => item.id)).toEqual(['unobserved']);
    } finally {
      await memory.settled();
      await rm(directory, { recursive: true, force: true });
    }
  });
});

describe('shared-history branch semantic recall integration', () => {
  it('returns only reachable model-facing context through real Memory, LibSQL storage, and vector search', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'memory-branch-integration-'));
    const dbPath = join(directory, 'test.db');
    const storage = new LibSQLStore({ id: randomUUID(), url: `file:${dbPath}` });
    const vector = new LibSQLVector({ id: randomUUID(), url: `file:${dbPath}` });
    const memory = new Memory({
      storage,
      vector,
      embedder: mockEmbedder,
      options: {
        lastMessages: false,
        semanticRecall: { scope: 'resource', topK: 10, messageRange: 0 },
        generateTitle: false,
      },
    });

    try {
      await memory.createThread({ threadId: 'root', resourceId });
      await memory.saveMessages({
        messages: [
          message('root-a', 'root', 1),
          message('root-b', 'root', 2),
          message('parent-post-fork-sentinel', 'root', 3),
        ],
      });
      const child = await memory.branchThread({ threadId: 'root', branchPointMessageId: 'root-b' });
      const sibling = await memory.branchThread({ threadId: 'root', branchPointMessageId: 'root-a' });
      await memory.saveMessages({
        messages: [message('child-tail', child.thread.id, 4), message('sibling-tail-sentinel', sibling.thread.id, 5)],
      });

      const recalled = await memory.recall({
        threadId: child.thread.id,
        resourceId,
        vectorSearchString: 'conversation',
      });

      expect(recalled.messages.map(item => item.id)).toEqual(['root-a', 'root-b', 'child-tail']);
      expect(recalled.messages.map(item => item.id)).not.toContain('parent-post-fork-sentinel');
      expect(recalled.messages.map(item => item.id)).not.toContain('sibling-tail-sentinel');
    } finally {
      await memory.settled();
      await rm(directory, { recursive: true, force: true });
    }
  });
});
