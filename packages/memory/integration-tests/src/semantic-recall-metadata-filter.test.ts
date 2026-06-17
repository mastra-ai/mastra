import { randomUUID } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { MastraDBMessage } from '@mastra/core/agent';
import { LibSQLStore, LibSQLVector } from '@mastra/libsql';
import { Memory } from '@mastra/memory';
import { describe, expect, it, beforeEach } from 'vitest';
import { mockEmbedder } from './worker/mock-embedder';

const resourceId = 'test-resource-metadata-filter';

function createThread(id: string, metadata: Record<string, unknown>) {
  const now = new Date();
  return {
    id,
    resourceId,
    title: id,
    metadata,
    createdAt: now,
    updatedAt: now,
  };
}

function createMessage(threadId: string, text: string, role: 'user' | 'assistant' = 'user'): MastraDBMessage {
  return {
    id: randomUUID(),
    threadId,
    resourceId,
    role,
    content: {
      format: 2,
      parts: [{ type: 'text', text }],
    },
    createdAt: new Date(),
  };
}

function getText(message: MastraDBMessage) {
  return message.content.parts
    .filter(part => part.type === 'text')
    .map(part => part.text)
    .join(' ');
}

describe('Semantic recall with metadata filtering', () => {
  let memory: Memory;

  beforeEach(async () => {
    const dbPath = join(await mkdtemp(join(tmpdir(), 'memory-metadata-filter-test-')), 'test.db');

    const storage = new LibSQLStore({
      id: randomUUID(),
      url: `file:${dbPath}`,
    });
    const vector = new LibSQLVector({
      id: randomUUID(),
      url: `file:${dbPath}`,
    });

    memory = new Memory({
      options: {
        lastMessages: 0,
        semanticRecall: {
          topK: 10,
          messageRange: 0,
          scope: 'resource',
        },
      },
      storage,
      vector,
      embedder: mockEmbedder,
    });
  });

  it('filters semantic recall by thread metadata', async () => {
    await memory.saveThread({ thread: createThread('thread-project-a', { projectId: 'project-a' }) });
    await memory.saveThread({ thread: createThread('thread-project-b', { projectId: 'project-b' }) });

    await memory.saveMessages({
      messages: [
        createMessage('thread-project-a', 'Cats sleep for many hours each day'),
        createMessage('thread-project-a', 'Cats use body language to communicate', 'assistant'),
        createMessage('thread-project-b', 'Dogs need daily walks and training'),
        createMessage('thread-project-b', 'Dogs are social pack animals', 'assistant'),
      ],
    });

    const result = await memory.recall({
      threadId: 'new-thread',
      resourceId,
      vectorSearchString: 'animal behavior',
      threadConfig: {
        semanticRecall: {
          topK: 10,
          messageRange: 0,
          scope: 'resource',
          filter: { projectId: { $eq: 'project-a' } },
        },
      },
    });

    const recalledText = result.messages.map(getText).join('\n');
    expect(recalledText).toContain('Cats');
    expect(recalledText).not.toContain('Dogs');
  });

  it('combines metadata filters with resource scope', async () => {
    await memory.saveThread({ thread: createThread('work-thread', { projectId: 'project-a', category: 'work' }) });
    await memory.saveThread({
      thread: createThread('personal-thread', { projectId: 'project-a', category: 'personal' }),
    });
    await memory.saveThread({
      thread: createThread('other-resource-thread', { projectId: 'project-a', category: 'work' }),
    });

    await memory.saveMessages({
      messages: [
        createMessage('work-thread', 'The quarterly report is ready'),
        createMessage('personal-thread', 'The grocery list includes apples'),
        {
          ...createMessage('other-resource-thread', 'The other resource report should not be recalled'),
          resourceId: 'other-resource',
        },
      ],
    });

    const result = await memory.recall({
      threadId: 'new-thread',
      resourceId,
      vectorSearchString: 'report',
      threadConfig: {
        semanticRecall: {
          topK: 10,
          messageRange: 0,
          scope: 'resource',
          filter: {
            $and: [{ projectId: { $eq: 'project-a' } }, { category: { $eq: 'work' } }],
          },
        },
      },
    });

    const recalledText = result.messages.map(getText).join('\n');
    expect(recalledText).toContain('quarterly report');
    expect(recalledText).not.toContain('grocery list');
    expect(recalledText).not.toContain('other resource');
  });
});
