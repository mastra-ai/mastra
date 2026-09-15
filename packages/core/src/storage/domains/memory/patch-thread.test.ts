import { describe, expect, it } from 'vitest';

import type { StorageThreadType } from '../../../memory/types';
import { InMemoryDB } from '../inmemory-db';
import { InMemoryMemory } from './inmemory';

function createThread(overrides: Partial<StorageThreadType> = {}): StorageThreadType {
  return {
    id: 'thread-1',
    resourceId: 'resource-1',
    title: 'Generated title',
    metadata: { a: 1 },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Models a storage adapter compiled before `updateThread` supported partial
 * updates: it does not declare `supportsPartialThreadUpdate` and its
 * `updateThread` writes both columns unconditionally — an omitted title would
 * be persisted as NULL (a NOT NULL violation on SQL adapters).
 */
class LegacyMemoryStorage extends InMemoryMemory {
  updateThreadCalls: Array<{ id: string; title?: string; metadata?: Record<string, unknown> }> = [];

  // Models an adapter that never declared support for partial updates.
  override readonly supportsPartialThreadUpdate: boolean = false;

  override async updateThread(args: {
    id: string;
    title?: string;
    metadata?: Record<string, unknown>;
  }): Promise<StorageThreadType> {
    this.updateThreadCalls.push(args);
    if (args.title === undefined) {
      throw new Error('null value in column "title" of relation "mastra_threads" violates not-null constraint');
    }
    return super.updateThread(args);
  }
}

class ModernMemoryStorage extends InMemoryMemory {
  updateThreadCalls: Array<{ id: string; title?: string; metadata?: Record<string, unknown> }> = [];

  override async updateThread(args: {
    id: string;
    title?: string;
    metadata?: Record<string, unknown>;
  }): Promise<StorageThreadType> {
    this.updateThreadCalls.push(args);
    return super.updateThread(args);
  }
}

describe('MemoryStorage.patchThread legacy-adapter compatibility', () => {
  it('backfills the current title for adapters without supportsPartialThreadUpdate', async () => {
    const storage = new LegacyMemoryStorage({ db: new InMemoryDB() });
    await storage.saveThread({ thread: createThread() });

    const updated = await storage.patchThread({ id: 'thread-1', metadata: { b: 2 } });

    expect(storage.updateThreadCalls).toHaveLength(1);
    expect(storage.updateThreadCalls[0]!.title).toBe('Generated title');
    expect(updated.title).toBe('Generated title');
    expect(updated.metadata).toMatchObject({ b: 2 });
  });

  it('backfills an empty title when the legacy adapter thread has no title', async () => {
    const storage = new LegacyMemoryStorage({ db: new InMemoryDB() });
    await storage.saveThread({ thread: createThread({ title: undefined as unknown as string }) });

    await storage.patchThread({ id: 'thread-1', metadata: { b: 2 } });

    expect(storage.updateThreadCalls[0]!.title).toBe('');
  });

  it('omits the title for adapters that declare supportsPartialThreadUpdate', async () => {
    const storage = new ModernMemoryStorage({ db: new InMemoryDB() });
    await storage.saveThread({ thread: createThread() });

    const updated = await storage.patchThread({ id: 'thread-1', metadata: { b: 2 } });

    expect(storage.updateThreadCalls).toHaveLength(1);
    expect('title' in storage.updateThreadCalls[0]!).toBe(false);
    expect(updated.title).toBe('Generated title');
  });

  it('passes an explicit title through unchanged without extra reads', async () => {
    const storage = new LegacyMemoryStorage({ db: new InMemoryDB() });
    await storage.saveThread({ thread: createThread() });

    const updated = await storage.patchThread({ id: 'thread-1', title: 'New title', metadata: { b: 2 } });

    expect(storage.updateThreadCalls[0]!.title).toBe('New title');
    expect(updated.title).toBe('New title');
  });
});
