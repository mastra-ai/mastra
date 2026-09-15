import { randomUUID } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { MastraDBMessage } from '@mastra/core/agent';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { describe, expect, it } from 'vitest';
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

describe('shared-history branch integration', () => {
  it('returns only reachable model-facing context through real Memory, LibSQL storage, and vector search', async () => {
    const dbPath = join(await mkdtemp(join(tmpdir(), 'memory-branch-integration-')), 'test.db');
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
  });
});
