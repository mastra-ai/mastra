import { describe, expect, it, vi } from 'vitest';
import type { MastraDBMessage } from '../../agent';
import { InMemoryDB } from '../../storage/domains/inmemory-db';
import { InMemoryMemory } from '../../storage/domains/memory/inmemory';
import { MessageHistory } from './message-history.js';

describe('thread title persistence', () => {
  it('persistMessages does not rewrite a thread row that already exists', async () => {
    const memory = new InMemoryMemory({ db: new InMemoryDB() });
    await memory.saveThread({
      thread: {
        id: 'thread-1',
        resourceId: 'resource-1',
        title: 'Generated title',
        metadata: { a: 1 },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const updateThread = vi.spyOn(memory, 'updateThread');
    const processor = new MessageHistory({ storage: memory as any, lastMessages: 10 });

    const message: MastraDBMessage = {
      id: 'msg-1',
      role: 'user',
      content: { format: 2, parts: [{ type: 'text', text: 'hello' }] },
      threadId: 'thread-1',
      createdAt: new Date(),
    } as MastraDBMessage;

    await processor.persistMessages({ messages: [message], threadId: 'thread-1', resourceId: 'resource-1' });

    // Re-writing the row we just read would clobber a concurrently generated title.
    expect(updateThread).not.toHaveBeenCalled();
    expect((await memory.getThreadById({ threadId: 'thread-1' }))?.title).toBe('Generated title');
  });
});
