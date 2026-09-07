import { describe, expect, it } from 'vitest';
import { MemoryMSSQL } from '.';

type QueryResult = { recordset?: Record<string, any>[]; rowsAffected?: number[] };

const THREADS_TABLE = '[mastra_threads]';
const MESSAGES_TABLE = '[mastra_messages]';

const SOURCE_THREAD_ROW = {
  id: 't1',
  resourceId: 'r1',
  title: 'Source thread',
  metadata: JSON.stringify({ tag: 'original' }),
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const CONTENT_M1 = JSON.stringify({ format: 2, parts: [{ type: 'text', text: 'hello' }] });
const CONTENT_M2 = JSON.stringify({ format: 2, parts: [{ type: 'text', text: 'hi there' }] });

const SOURCE_MESSAGE_ROWS = [
  {
    id: 'm1',
    content: CONTENT_M1,
    role: 'user',
    type: 'v2',
    createdAt: '2024-01-01T00:01:00.000Z',
    thread_id: 't1',
    resourceId: 'r1',
  },
  {
    id: 'm2',
    content: CONTENT_M2,
    role: 'assistant',
    type: 'v2',
    createdAt: '2024-01-01T00:02:00.000Z',
    thread_id: 't1',
    resourceId: 'r1',
  },
];

function createCloneStorage(threadRows: Record<string, any>[], messageRows: Record<string, any>[]) {
  const queries: string[] = [];
  const paramsAtQuery: Record<string, unknown>[] = [];

  const makeRequest = () => {
    const params: Record<string, unknown> = {};
    return {
      input: (name: string, value: unknown) => {
        params[name] = value;
      },
      query: async (query: string) => {
        queries.push(query);
        paramsAtQuery.push({ ...params });
        if (query.includes(`FROM ${THREADS_TABLE}`)) {
          return { recordset: threadRows.filter(row => row.id === params.threadId) } satisfies QueryResult;
        }
        if (query.includes(`FROM ${MESSAGES_TABLE}`)) {
          return { recordset: messageRows } satisfies QueryResult;
        }
        return { rowsAffected: [1] } satisfies QueryResult;
      },
    };
  };

  const pool = {
    request: makeRequest,
    transaction: () => ({
      begin: async () => {},
      commit: async () => {},
      rollback: async () => {},
      request: makeRequest,
    }),
  };

  return { storage: new MemoryMSSQL({ pool: pool as any }), queries, paramsAtQuery };
}

describe('MemoryMSSQL.cloneThread', () => {
  it('clones the source thread and its messages inside a transaction', async () => {
    const { storage, queries, paramsAtQuery } = createCloneStorage([SOURCE_THREAD_ROW], SOURCE_MESSAGE_ROWS);

    const result = await storage.cloneThread({
      sourceThreadId: 't1',
      newThreadId: 'clone-1',
      resourceId: 'r2',
      title: 'Copied',
      metadata: { reason: 'test' },
    });

    expect(result.thread.id).toBe('clone-1');
    expect(result.thread.resourceId).toBe('r2');
    expect(result.thread.title).toBe('Copied');
    expect(result.thread.metadata).toMatchObject({
      reason: 'test',
      clone: { sourceThreadId: 't1', clonedAt: expect.any(Date), lastMessageId: 'm2' },
    });

    const threadInsertIndex = queries.findIndex(query => query.includes(`INSERT INTO ${THREADS_TABLE}`));
    expect(threadInsertIndex).toBeGreaterThan(-1);
    expect(paramsAtQuery[threadInsertIndex]).toMatchObject({ id: 'clone-1', resourceId: 'r2', title: 'Copied' });
    expect(paramsAtQuery[threadInsertIndex]!.metadata).toContain('"clone"');

    const messageInsertIndexes = queries
      .map((query, index) => (query.includes(`INSERT INTO ${MESSAGES_TABLE}`) ? index : -1))
      .filter(index => index >= 0);
    expect(messageInsertIndexes).toHaveLength(2);
    expect(Object.keys(result.messageIdMap).sort()).toEqual(['m1', 'm2']);
    for (const index of messageInsertIndexes) {
      expect(paramsAtQuery[index]).toMatchObject({ threadId: 'clone-1', resourceId: 'r2' });
      expect(paramsAtQuery[index]!.id).not.toBe('m1');
      expect(paramsAtQuery[index]!.id).not.toBe('m2');
    }

    expect(result.clonedMessages).toHaveLength(2);
    expect(result.clonedMessages[0]!.content).toEqual(JSON.parse(CONTENT_M1));
    expect(result.clonedMessages[0]!.role).toBe('user');
    expect(result.clonedMessages[0]!.threadId).toBe('clone-1');
    expect(result.clonedMessages[0]!.createdAt).toEqual(new Date('2024-01-01T00:01:00.000Z'));

    const messageSelect = queries.find(query => query.includes(`FROM ${MESSAGES_TABLE}`))!;
    expect(messageSelect).toContain('ORDER BY [createdAt] ASC');
    expect(messageSelect).not.toContain('FETCH NEXT');
  });

  it('generates an id and default title/resourceId when not provided', async () => {
    const { storage } = createCloneStorage([SOURCE_THREAD_ROW], []);

    const result = await storage.cloneThread({ sourceThreadId: 't1' });

    expect(result.thread.id).toBeTruthy();
    expect(result.thread.id).not.toBe('t1');
    expect(result.thread.resourceId).toBe('r1');
    expect(result.thread.title).toBe('Clone of Source thread');
    expect(result.clonedMessages).toHaveLength(0);
    expect(result.messageIdMap).toEqual({});
  });

  it('wraps the message query in a DESC subquery with FETCH NEXT when messageLimit is set', async () => {
    const { storage, queries, paramsAtQuery } = createCloneStorage([SOURCE_THREAD_ROW], SOURCE_MESSAGE_ROWS);

    await storage.cloneThread({ sourceThreadId: 't1', newThreadId: 'clone-1', options: { messageLimit: 1 } });

    const messageSelectIndex = queries.findIndex(query => query.includes(`FROM ${MESSAGES_TABLE}`));
    const messageSelect = queries[messageSelectIndex]!;
    expect(messageSelect).toContain('ORDER BY [createdAt] DESC');
    expect(messageSelect).toContain('ORDER BY [createdAt] ASC OFFSET 0 ROWS FETCH NEXT @messageLimit ROWS ONLY');
    expect(paramsAtQuery[messageSelectIndex]!.messageLimit).toBe(1);
  });

  it('applies date and messageId filters to the message query', async () => {
    const { storage, queries } = createCloneStorage([SOURCE_THREAD_ROW], SOURCE_MESSAGE_ROWS);

    await storage.cloneThread({
      sourceThreadId: 't1',
      newThreadId: 'clone-1',
      options: {
        messageFilter: {
          startDate: new Date('2024-01-01T00:00:30.000Z'),
          messageIds: ['m1', 'm2'],
        },
      },
    });

    const messageSelect = queries.find(query => query.includes(`FROM ${MESSAGES_TABLE}`))!;
    expect(messageSelect).toContain('[createdAt] >= @startDate2');
    expect(messageSelect).toContain('id IN (@messageId1, @messageId2)');
    expect(messageSelect).toContain('ORDER BY [createdAt] ASC');
  });

  it('throws SOURCE_NOT_FOUND when the source thread does not exist', async () => {
    const { storage } = createCloneStorage([], []);

    await expect(storage.cloneThread({ sourceThreadId: 'missing' })).rejects.toMatchObject({
      id: 'MASTRA_STORAGE_MSSQL_CLONE_THREAD_SOURCE_NOT_FOUND',
    });
  });

  it('throws THREAD_EXISTS when the target thread id is already taken', async () => {
    const { storage } = createCloneStorage([SOURCE_THREAD_ROW], []);

    await expect(storage.cloneThread({ sourceThreadId: 't1', newThreadId: 't1' })).rejects.toMatchObject({
      id: 'MASTRA_STORAGE_MSSQL_CLONE_THREAD_THREAD_EXISTS',
    });
  });
});
