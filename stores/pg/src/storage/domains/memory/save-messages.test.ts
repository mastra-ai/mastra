import type { MastraDBMessage } from '@mastra/core/memory';
import type { QueryResult } from 'pg';
import { describe, expect, it } from 'vitest';
import type { DbClient, QueryValues, TxClient } from '../../client';
import { MemoryPG } from './index';

type RecordedQuery = {
  query: string;
  values?: QueryValues;
};

class RecordingTxClient implements TxClient {
  queries: RecordedQuery[] = [];

  async none(query: string, values?: QueryValues): Promise<null> {
    this.queries.push({ query, values });
    return null;
  }

  async one<T = any>(): Promise<T> {
    throw new Error('not implemented');
  }

  async oneOrNone<T = any>(): Promise<T | null> {
    throw new Error('not implemented');
  }

  async any<T = any>(): Promise<T[]> {
    throw new Error('not implemented');
  }

  async manyOrNone<T = any>(): Promise<T[]> {
    throw new Error('not implemented');
  }

  async many<T = any>(): Promise<T[]> {
    throw new Error('not implemented');
  }

  async query(): Promise<QueryResult> {
    throw new Error('not implemented');
  }

  async batch<T>(promises: Promise<T>[]): Promise<T[]> {
    return Promise.all(promises);
  }
}

class RecordingDbClient implements DbClient {
  readonly $pool = {} as DbClient['$pool'];
  readonly txClient = new RecordingTxClient();
  readonly threads = new Map<string, Record<string, unknown>>();

  constructor({
    thread,
    threads,
  }: { thread?: Record<string, unknown> | null; threads?: Record<string, unknown>[] } = {}) {
    const defaultThread = {
      id: 'thread-1',
      resourceId: 'resource-1',
      title: 'Test thread',
      metadata: {},
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
      updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    };
    const threadsToAdd = threads ?? (thread === undefined ? [defaultThread] : thread ? [thread] : []);
    for (const threadToAdd of threadsToAdd) {
      this.threads.set(String(threadToAdd.id), threadToAdd);
    }
  }

  connect(): Promise<never> {
    throw new Error('not implemented');
  }

  async none(): Promise<null> {
    throw new Error('not implemented');
  }

  async one<T = any>(): Promise<T> {
    throw new Error('not implemented');
  }

  async oneOrNone<T = any>(_query?: string, values?: QueryValues): Promise<T | null> {
    const id = Array.isArray(values) ? values[0] : undefined;
    return id ? ((this.threads.get(String(id)) as T | undefined) ?? null) : null;
  }

  async any<T = any>(): Promise<T[]> {
    throw new Error('not implemented');
  }

  async manyOrNone<T = any>(): Promise<T[]> {
    throw new Error('not implemented');
  }

  async many<T = any>(): Promise<T[]> {
    throw new Error('not implemented');
  }

  async query(): Promise<QueryResult> {
    throw new Error('not implemented');
  }

  async tx<T>(callback: (t: TxClient) => Promise<T>): Promise<T> {
    return callback(this.txClient);
  }
}

let nextMessageId = 1;

function createMessage(overrides: Partial<MastraDBMessage> = {}): MastraDBMessage {
  return {
    id: overrides.id ?? `message-${nextMessageId++}`,
    threadId: overrides.threadId ?? 'thread-1',
    resourceId: overrides.resourceId ?? 'resource-1',
    role: overrides.role ?? 'user',
    type: overrides.type ?? 'v2',
    createdAt: overrides.createdAt ?? new Date('2025-01-01T00:00:00.000Z'),
    content: overrides.content ?? { format: 2, parts: [{ type: 'text', text: 'hello' }] },
  } as MastraDBMessage;
}

describe('MemoryPG.saveMessages', () => {
  it('inserts multiple messages with one multi-row upsert statement', async () => {
    const client = new RecordingDbClient();
    const memory = new MemoryPG({ client });

    await memory.saveMessages({
      messages: [
        createMessage({ id: 'message-1' }),
        createMessage({ id: 'message-2' }),
        createMessage({ id: 'message-3' }),
      ],
    });

    expect(client.txClient.queries).toHaveLength(2);
    const [insertQuery, threadUpdateQuery] = client.txClient.queries;
    expect(insertQuery!.query).toContain(
      'VALUES ($1, $2, $3, $4, $5, $6, $7, $8), ($9, $10, $11, $12, $13, $14, $15, $16), ($17, $18, $19, $20, $21, $22, $23, $24)',
    );
    expect(insertQuery!.values).toHaveLength(24);
    expect(threadUpdateQuery!.query).toContain('UPDATE "public"."mastra_threads"');
  });

  it('keeps last-write-wins behavior for duplicate message ids in the same batch', async () => {
    const client = new RecordingDbClient();
    const memory = new MemoryPG({ client });
    const firstCreatedAt = new Date('2025-01-01T00:00:00.000Z');
    const secondCreatedAt = new Date('2025-01-01T00:00:01.000Z');

    await memory.saveMessages({
      messages: [
        createMessage({ id: 'message-1', content: { content: 'first' }, createdAt: firstCreatedAt }),
        createMessage({ id: 'message-1', content: { content: 'second' }, createdAt: secondCreatedAt }),
      ],
    });

    const [insertQuery] = client.txClient.queries;
    expect(insertQuery!.query).toContain('VALUES ($1, $2, $3, $4, $5, $6, $7, $8)');
    expect(insertQuery!.query).not.toContain('$9');
    expect(insertQuery!.values).toHaveLength(8);
    expect(insertQuery!.values![2]).toBe(JSON.stringify({ content: 'second' }));
    expect(insertQuery!.values![3]).toBe(firstCreatedAt);
    expect(insertQuery!.values![4]).toBe(firstCreatedAt);
  });

  it('chunks message inserts under the Postgres bind parameter limit and updates the thread once', async () => {
    const client = new RecordingDbClient();
    const memory = new MemoryPG({ client });
    const messages = Array.from({ length: 8192 }, (_, index) => createMessage({ id: `message-${index}` }));

    await memory.saveMessages({ messages });

    expect(client.txClient.queries).toHaveLength(3);
    const [firstInsertQuery, secondInsertQuery, threadUpdateQuery] = client.txClient.queries;
    expect(firstInsertQuery!.query).toContain('INSERT INTO "public"."mastra_messages"');
    expect(firstInsertQuery!.values).toHaveLength(65528);
    expect(secondInsertQuery!.query).toContain('INSERT INTO "public"."mastra_messages"');
    expect(secondInsertQuery!.values).toHaveLength(8);
    expect(threadUpdateQuery!.query).toContain('UPDATE "public"."mastra_threads"');
    expect(threadUpdateQuery!.values).toHaveLength(3);
  }, 20_000);

  it('returns messages with string content parsed through MessageList', async () => {
    const client = new RecordingDbClient();
    const memory = new MemoryPG({ client });

    const result = await memory.saveMessages({
      messages: [
        createMessage({
          id: 'message-1',
          content: JSON.stringify({ format: 2, parts: [{ type: 'text', text: 'hello' }] }),
        }),
      ],
    });

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0]!.content).toEqual({ format: 2, parts: [{ type: 'text', text: 'hello' }] });
  });

  it('does not start a transaction when a later message is missing required storage fields', async () => {
    const client = new RecordingDbClient();
    const memory = new MemoryPG({ client });

    await expect(
      memory.saveMessages({
        messages: [createMessage({ id: 'message-1' }), createMessage({ id: 'message-2', resourceId: '' })],
      }),
    ).rejects.toThrow("Expected to find a resourceId for message, but couldn't find one");

    expect(client.txClient.queries).toHaveLength(0);
  });

  it('does not start a transaction when a later message is missing a thread id', async () => {
    const client = new RecordingDbClient();
    const memory = new MemoryPG({ client });

    await expect(
      memory.saveMessages({
        messages: [createMessage({ id: 'message-1' }), createMessage({ id: 'message-2', threadId: '' })],
      }),
    ).rejects.toThrow("Expected to find a threadId for message, but couldn't find one");

    expect(client.txClient.queries).toHaveLength(0);
  });

  it('saves mixed-thread batches and updates every touched thread', async () => {
    const client = new RecordingDbClient({
      threads: [
        {
          id: 'thread-1',
          resourceId: 'resource-1',
          title: 'Test thread 1',
          metadata: {},
          createdAt: new Date('2025-01-01T00:00:00.000Z'),
          updatedAt: new Date('2025-01-01T00:00:00.000Z'),
        },
        {
          id: 'thread-2',
          resourceId: 'resource-2',
          title: 'Test thread 2',
          metadata: {},
          createdAt: new Date('2025-01-01T00:00:00.000Z'),
          updatedAt: new Date('2025-01-01T00:00:00.000Z'),
        },
      ],
    });
    const memory = new MemoryPG({ client });

    await memory.saveMessages({
      messages: [
        createMessage({ id: 'message-1', threadId: 'thread-1' }),
        createMessage({ id: 'message-2', threadId: 'thread-2', resourceId: 'resource-2' }),
      ],
    });

    expect(client.txClient.queries).toHaveLength(3);
    const [insertQuery, firstThreadUpdate, secondThreadUpdate] = client.txClient.queries;
    expect(insertQuery!.query).toContain('INSERT INTO "public"."mastra_messages"');
    expect(firstThreadUpdate!.values![2]).toBe('thread-1');
    expect(secondThreadUpdate!.values![2]).toBe('thread-2');
  });

  it('rejects messages for any missing thread before opening a transaction', async () => {
    const client = new RecordingDbClient();
    const memory = new MemoryPG({ client });

    await expect(
      memory.saveMessages({
        messages: [createMessage({ id: 'message-1' }), createMessage({ id: 'message-2', threadId: 'thread-2' })],
      }),
    ).rejects.toThrow('Thread thread-2 not found');
    expect(client.txClient.queries).toHaveLength(0);
  });

  it('rejects messages for a missing thread before opening a transaction', async () => {
    const client = new RecordingDbClient({ thread: null });
    const memory = new MemoryPG({ client });

    await expect(memory.saveMessages({ messages: [createMessage({ id: 'message-1' })] })).rejects.toThrow(
      'Thread thread-1 not found',
    );
    expect(client.txClient.queries).toHaveLength(0);
  });
});
