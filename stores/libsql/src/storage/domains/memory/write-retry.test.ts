import type { Client } from '@libsql/client';
import { createClient } from '@libsql/client';
import type { MastraDBMessage } from '@mastra/core/memory';
import { beforeEach, describe, expect, it } from 'vitest';

import { MemoryLibSQL } from './index';

const lockError = () => Object.assign(new Error('SQLITE_BUSY: database is locked'), { code: 'SQLITE_BUSY' });

/** Fails the next `failures` writes (execute, batch, or transaction start) with `error`. */
function flakyClient(client: Client) {
  const control = { failures: 0, error: lockError, writeAttempts: 0 };
  const proxy = new Proxy(client, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (prop !== 'execute' && prop !== 'batch' && prop !== 'transaction') {
        return typeof value === 'function' ? value.bind(target) : value;
      }
      return async (...args: unknown[]) => {
        const sql = prop === 'execute' ? String((args[0] as { sql?: string })?.sql ?? args[0]) : '';
        const isRead = prop === 'execute' && /^\s*SELECT/i.test(sql);
        if (!isRead) {
          control.writeAttempts++;
          if (control.failures > 0) {
            control.failures--;
            throw control.error();
          }
        }
        return (value as (...a: unknown[]) => unknown).apply(target, args);
      };
    },
  });
  return { client: proxy, control };
}

function message(id: string): MastraDBMessage {
  return {
    id,
    threadId: 'thread-1',
    resourceId: 'resource-1',
    role: 'user',
    type: 'v2',
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    content: { format: 2, parts: [{ type: 'text', text: id }] },
  } as MastraDBMessage;
}

describe('MemoryLibSQL write retries on transient lock errors', () => {
  let store: MemoryLibSQL;
  let control: ReturnType<typeof flakyClient>['control'];

  beforeEach(async () => {
    const flaky = flakyClient(createClient({ url: 'file::memory:' }));
    control = flaky.control;
    store = new MemoryLibSQL({ client: flaky.client, maxRetries: 3, initialBackoffMs: 1 });
    await store.init();
    await store.saveThread({
      thread: {
        id: 'thread-1',
        resourceId: 'resource-1',
        title: 'Test thread',
        metadata: {},
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
        updatedAt: new Date('2025-01-01T00:00:00.000Z'),
      },
    });
    control.writeAttempts = 0;
  });

  it('retries saveMessages', async () => {
    control.failures = 1;
    await store.saveMessages({ messages: [message('m1')] });

    const { messages } = await store.listMessages({ threadId: 'thread-1' });
    expect(messages.map(m => m.id)).toEqual(['m1']);
  });

  it('retries observational memory writes', async () => {
    control.failures = 1;
    const record = await store.initializeObservationalMemory({
      threadId: 'thread-1',
      resourceId: 'resource-1',
      scope: 'thread',
      config: {},
    });

    control.failures = 1;
    await store.setPendingMessageTokens(record.id, 42);

    const stored = await store.getObservationalMemory('thread-1', 'resource-1');
    expect(stored?.pendingMessageTokens).toBe(42);
  });

  it('retries interactive transactions', async () => {
    await store.saveMessages({ messages: [message('m1'), message('m2')] });

    control.failures = 1;
    await store.deleteMessages(['m1']);

    const { messages } = await store.listMessages({ threadId: 'thread-1' });
    expect(messages.map(m => m.id)).toEqual(['m2']);
  });

  it('gives up after maxRetries', async () => {
    control.failures = 3;
    await expect(store.updateThread({ id: 'thread-1', title: 'renamed', metadata: {} })).rejects.toMatchObject({
      cause: { message: expect.stringMatching(/database is locked/) },
    });
    expect(control.writeAttempts).toBe(3);
  });

  it('does not retry other errors', async () => {
    control.failures = 1;
    control.error = () => new Error('SQLITE_CONSTRAINT: constraint failed');
    await expect(store.updateThread({ id: 'thread-1', title: 'renamed', metadata: {} })).rejects.toMatchObject({
      cause: { message: expect.stringMatching(/constraint failed/) },
    });
    expect(control.writeAttempts).toBe(1);
  });
});
