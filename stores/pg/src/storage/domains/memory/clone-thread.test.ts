import type { QueryResult } from 'pg';
import { describe, expect, it } from 'vitest';
import type { QueryValues, TxClient } from '../../client';
import type { RecordedQuery } from './test-utils';
import { RecordingDbClientBase } from './test-utils';
import { MemoryPG } from './index';

class RecordingTxClient implements TxClient {
  queries: RecordedQuery[] = [];
  sourceMessages: Record<string, any>[] = [];
  /** Rows the INSERT … SELECT statements would have produced, keyed off the source row. */
  copiedRows: Record<string, any>[] = [];

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

  async manyOrNone<T = any>(query: string, values?: QueryValues): Promise<T[]> {
    this.queries.push({ query, values });
    return this.sourceMessages as T[];
  }

  async many<T = any>(): Promise<T[]> {
    throw new Error('not implemented');
  }

  async query(query: string, values?: QueryValues): Promise<QueryResult> {
    this.queries.push({ query, values });
    if (query.includes('INSERT INTO') && query.includes('SELECT')) {
      const [newId, threadId, resourceId, sourceId] = values as string[];
      const source = this.sourceMessages.find(r => r.id === sourceId)!;
      this.copiedRows.push({ ...source, id: newId, threadId, resourceId });
    }
    return { rowCount: 1 } as QueryResult;
  }

  async batch<T>(promises: Promise<T>[]): Promise<T[]> {
    return Promise.all(promises);
  }
}

class RecordingDbClient extends RecordingDbClientBase {
  readonly txClient = new RecordingTxClient();
  readonly threads = new Map<string, Record<string, unknown>>();

  constructor(sourceMessages: Record<string, any>[]) {
    super();
    this.txClient.sourceMessages = sourceMessages;
    this.threads.set('source-thread', {
      id: 'source-thread',
      resourceId: 'resource-1',
      title: 'Source',
      metadata: {},
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
      updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    });
  }

  override async oneOrNone<T = any>(_query: string, values?: QueryValues): Promise<T | null> {
    const id = Array.isArray(values) ? values[0] : undefined;
    return id ? ((this.threads.get(String(id)) as T | undefined) ?? null) : null;
  }

  override async manyOrNone<T = any>(query: string, values?: QueryValues): Promise<T[]> {
    if (query?.includes('information_schema.columns')) return [];
    // listMessages read-back of the destination thread after the in-DB copy.
    if (query?.includes('thread_id IN')) {
      this.queries.push({ query, values });
      const threadId = Array.isArray(values) ? String(values[0]) : undefined;
      return this.txClient.copiedRows.filter(r => r.threadId === threadId).map(r => ({ ...r, __total: 2 })) as T[];
    }
    throw new Error('not implemented');
  }

  override async tx<T>(callback: (t: TxClient) => Promise<T>): Promise<T> {
    return callback(this.txClient);
  }
}

const sourceRows = [
  {
    id: 'msg-1',
    content: JSON.stringify({ format: 2, parts: [{ type: 'text', text: 'first' }] }),
    role: 'user',
    type: 'v2',
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    createdAtZ: new Date('2025-01-01T00:00:00.000Z'),
    threadId: 'source-thread',
    resourceId: 'resource-1',
  },
  {
    id: 'msg-2',
    content: JSON.stringify({ format: 2, parts: [{ type: 'text', text: 'second' }] }),
    role: 'assistant',
    type: 'v2',
    createdAt: new Date('2025-01-01T00:00:01.000Z'),
    createdAtZ: new Date('2025-01-01T00:00:01.000Z'),
    threadId: 'source-thread',
    resourceId: 'resource-1',
  },
];

describe('MemoryPG.copyThread / cloneThread', () => {
  it('copyThread copies rows in-DB without returning payloads', async () => {
    const client = new RecordingDbClient(sourceRows);
    const memory = new MemoryPG({ client });

    const result = await memory.copyThread({
      sourceThreadId: 'source-thread',
      newThreadId: 'dest-thread',
      resourceId: 'resource-1',
    });

    // No payloads returned to the JS heap.
    expect(result).not.toHaveProperty('clonedMessages');

    // messageIdMap maps every source message id to a new id.
    expect(Object.keys(result.messageIdMap ?? {}).sort()).toEqual(['msg-1', 'msg-2']);
    for (const [sourceId, newId] of Object.entries(result.messageIdMap ?? {})) {
      expect(newId).not.toBe(sourceId);
    }

    // The SELECT query only asks for id/createdAt, not content.
    const selectQuery = client.txClient.queries.find(
      q => q.query.includes('FROM') && q.query.includes('WHERE thread_id'),
    );
    expect(selectQuery!.query).not.toContain('content');

    // Message copies use INSERT … SELECT (content copied inside the DB).
    const messageInserts = client.txClient.queries.filter(
      q => q.query.includes('INSERT INTO') && q.query.includes('SELECT'),
    );
    expect(messageInserts).toHaveLength(2);
    for (const insert of messageInserts) {
      expect(insert.query).toContain('SELECT $1, $2, content');
    }
  });

  it('cloneThread copies in-DB and then reads the destination thread back', async () => {
    const client = new RecordingDbClient(sourceRows);
    const memory = new MemoryPG({ client });

    const result = await memory.cloneThread({
      sourceThreadId: 'source-thread',
      newThreadId: 'dest-thread',
      resourceId: 'resource-1',
    });

    // Still copied inside the DB — the source content is never SELECTed into JS.
    const selectQuery = client.txClient.queries.find(
      q => q.query.includes('FROM') && q.query.includes('WHERE thread_id'),
    );
    expect(selectQuery!.query).not.toContain('content');
    expect(
      client.txClient.queries.filter(q => q.query.includes('INSERT INTO') && q.query.includes('SELECT')),
    ).toHaveLength(2);

    // The returned messages come from a read of the destination thread.
    const readBack = client.queries.find(q => q.query.includes('thread_id IN'));
    expect(readBack?.values?.[0]).toBe('dest-thread');

    expect(result.clonedMessages).toHaveLength(2);
    expect(result.clonedMessages.map(m => m.content)).toEqual([
      { format: 2, parts: [{ type: 'text', text: 'first' }] },
      { format: 2, parts: [{ type: 'text', text: 'second' }] },
    ]);
    expect(result.clonedMessages.every(m => m.threadId === 'dest-thread')).toBe(true);
    expect(Object.keys(result.messageIdMap ?? {}).sort()).toEqual(['msg-1', 'msg-2']);
    expect(result.clonedMessages.map(m => m.id).sort()).toEqual(Object.values(result.messageIdMap ?? {}).sort());
  });
});
