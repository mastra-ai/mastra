import { describe, expect, it } from 'vitest';
import type { QueryValues } from '../../client';
import { RecordingDbClientBase } from './test-utils';
import { MemoryPG } from './index';

/**
 * Fake client for the list queries. It answers the thread count, the thread
 * page and the message page (with its window total) and records every query.
 */
class ListQueryClient extends RecordingDbClientBase {
  override async one<T = any>(query: string, values?: QueryValues): Promise<T> {
    this.queries.push({ query, values });
    return { count: '1' } as T;
  }

  override async manyOrNone<T = any>(query: string, values?: QueryValues): Promise<T[]> {
    this.queries.push({ query, values });
    if (query.includes('AS "__total"')) {
      return [
        {
          id: 'message-1',
          content: JSON.stringify({ format: 2, parts: [{ type: 'text', text: 'message' }] }),
          role: 'user',
          type: 'v2',
          createdAt: '2025-01-01T00:00:00.000Z',
          createdAtZ: '2025-01-01T00:00:00.000Z',
          threadId: 'thread-1',
          resourceId: 'resource-1',
          __total: '1',
        },
      ] as T[];
    }
    return [
      {
        id: 'thread-1',
        resourceId: 'resource-1',
        title: 'thread',
        metadata: null,
        createdAt: '2025-01-01T00:00:00.000Z',
        createdAtZ: '2025-01-01T00:00:00.000Z',
        updatedAt: '2025-01-01T00:00:00.000Z',
        updatedAtZ: '2025-01-01T00:00:00.000Z',
      },
    ] as T[];
  }
}

const lastQuery = (client: ListQueryClient) => client.queries.at(-1)!.query;

describe('MemoryPG list ordering with equal timestamps', () => {
  it('orders threads by the sort field and then by id in the same direction', async () => {
    const client = new ListQueryClient();
    const memory = new MemoryPG({ client });

    await memory.listThreads({ page: 0, perPage: 10, orderBy: { field: 'createdAt', direction: 'DESC' } });
    expect(lastQuery(client)).toContain('ORDER BY COALESCE("createdAtZ", "createdAt") DESC, "id" DESC LIMIT');

    await memory.listThreads({ page: 0, perPage: 10, orderBy: { field: 'updatedAt', direction: 'ASC' } });
    expect(lastQuery(client)).toContain('ORDER BY COALESCE("updatedAtZ", "updatedAt") ASC, "id" ASC LIMIT');
  });

  it('orders thread messages by creation time and then by id in the same direction', async () => {
    const client = new ListQueryClient();
    const memory = new MemoryPG({ client });

    await memory.listMessages({ threadId: 'thread-1', perPage: 10, page: 0 });
    expect(lastQuery(client)).toContain('ORDER BY "createdAt" ASC, "id" ASC');

    await memory.listMessages({
      threadId: 'thread-1',
      perPage: 10,
      page: 0,
      orderBy: { field: 'createdAt', direction: 'DESC' },
    });
    expect(lastQuery(client)).toContain('ORDER BY "createdAt" DESC, "id" DESC');
  });

  it('orders resource messages by creation time and then by id in the same direction', async () => {
    const client = new ListQueryClient();
    const memory = new MemoryPG({ client });

    await memory.listMessagesByResourceId({ resourceId: 'resource-1', perPage: 10, page: 0 });
    expect(lastQuery(client)).toContain('ORDER BY "createdAt" ASC, "id" ASC');

    await memory.listMessagesByResourceId({
      resourceId: 'resource-1',
      perPage: 10,
      page: 0,
      orderBy: { field: 'createdAt', direction: 'DESC' },
    });
    expect(lastQuery(client)).toContain('ORDER BY "createdAt" DESC, "id" DESC');
  });
});
