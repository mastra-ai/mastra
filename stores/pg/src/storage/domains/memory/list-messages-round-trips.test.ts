import { describe, expect, it } from 'vitest';
import type { QueryValues } from '../../client';
import { RecordingDbClientBase } from './test-utils';
import { MemoryPG } from './index';

/**
 * Fake client that answers the three queries the message paging code can send:
 * the page query with the skinny scalar `COUNT(*)` subquery, the fallback `COUNT(*)`,
 * and the two queries of the include (semantic recall) read.
 *
 * `block()` holds every `manyOrNone` result until `release()`. A test uses that
 * to look at the queries that are in flight at the same time.
 */
class MessageQueryClient extends RecordingDbClientBase {
  pageRows: Record<string, unknown>[] = [];
  windowTotal = 0;
  fallbackCount = 0;
  includeRows: Record<string, unknown>[] = [];

  #gate: Promise<void> = Promise.resolve();
  #openGate: () => void = () => {};

  block(): void {
    this.#gate = new Promise<void>(resolve => {
      this.#openGate = resolve;
    });
  }

  release(): void {
    this.#openGate();
  }

  override async one<T = any>(query: string, values?: QueryValues): Promise<T> {
    this.queries.push({ query, values });
    return { count: String(this.fallbackCount) } as T;
  }

  override async manyOrNone<T = any>(query: string, values?: QueryValues): Promise<T[]> {
    this.queries.push({ query, values });
    await this.#gate;
    if (query.includes('AS "__total"')) {
      return this.pageRows.map(row => ({ ...row, __total: String(this.windowTotal) })) as T[];
    }
    if (query.includes('thread_id, "createdAt" FROM')) {
      return this.includeRows.map(row => ({
        id: row.id,
        thread_id: row.threadId,
        createdAt: row.createdAt,
      })) as T[];
    }
    return this.includeRows as T[];
  }
}

function createRow(id: string, createdAt: string) {
  return {
    id,
    content: JSON.stringify({ format: 2, parts: [{ type: 'text', text: `message ${id}` }] }),
    role: 'user',
    type: 'v2',
    createdAt,
    createdAtZ: createdAt,
    threadId: 'thread-1',
    resourceId: 'resource-1',
  };
}

/** Lets every already-started promise chain run up to its next real await. */
async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    await Promise.resolve();
  }
}

const pageRows = [
  createRow('message-1', '2025-01-01T00:00:00.000Z'),
  createRow('message-2', '2025-01-01T00:00:01.000Z'),
];

describe('MemoryPG message paging round-trips', () => {
  it('reads the page and the total in one query in listMessages', async () => {
    const client = new MessageQueryClient();
    client.pageRows = pageRows;
    client.windowTotal = 7;
    const memory = new MemoryPG({ client });

    const result = await memory.listMessages({ threadId: 'thread-1', perPage: 10, page: 0 });

    expect(client.queries).toHaveLength(1);
    const [pageQuery] = client.queries;
    // Index-backed shape: skinny scalar count subquery, indexed ORDER BY, no window, no COALESCE sort.
    expect(pageQuery!.query).not.toContain('COUNT(*) OVER ()');
    expect(pageQuery!.query).toContain('(SELECT COUNT(*) FROM');
    expect(pageQuery!.query).toContain('AS "__total"');
    expect(pageQuery!.query).toContain('ORDER BY "createdAt"');
    expect(pageQuery!.query).not.toContain('ORDER BY COALESCE');
    expect(pageQuery!.query).toContain('LIMIT $2 OFFSET $3');
    expect(pageQuery!.values).toEqual(['thread-1', 10, 0]);
    expect(result.total).toBe(7);
    expect(result.messages).toHaveLength(2);
    // The count must not reach the caller as a message field.
    expect(result.messages[0]).not.toHaveProperty('__total');
  });

  it('reads the page and the total in one query in listMessagesByResourceId', async () => {
    const client = new MessageQueryClient();
    client.pageRows = pageRows;
    client.windowTotal = 7;
    const memory = new MemoryPG({ client });

    const result = await memory.listMessagesByResourceId({ resourceId: 'resource-1', perPage: 10, page: 0 });

    expect(client.queries).toHaveLength(1);
    const [pageQuery] = client.queries;
    expect(pageQuery!.query).not.toContain('COUNT(*) OVER ()');
    expect(pageQuery!.query).toContain('(SELECT COUNT(*) FROM');
    expect(pageQuery!.query).toContain('AS "__total"');
    expect(pageQuery!.query).toContain('ORDER BY "createdAt"');
    expect(pageQuery!.query).not.toContain('ORDER BY COALESCE');
    expect(pageQuery!.query).toContain('LIMIT $2 OFFSET $3');
    expect(pageQuery!.values).toEqual(['resource-1', 10, 0]);
    expect(result.total).toBe(7);
    expect(result.messages).toHaveLength(2);
  });

  it('omits LIMIT and OFFSET when perPage is false', async () => {
    const client = new MessageQueryClient();
    client.pageRows = pageRows;
    client.windowTotal = 2;
    const memory = new MemoryPG({ client });

    const result = await memory.listMessages({ threadId: 'thread-1', perPage: false });

    expect(client.queries).toHaveLength(1);
    const [pageQuery] = client.queries;
    expect(pageQuery!.query).not.toContain('LIMIT');
    expect(pageQuery!.values).toEqual(['thread-1']);
    expect(result.total).toBe(2);
    expect(result.messages).toHaveLength(2);
    expect(result.perPage).toBe(false);
  });

  it('reports total 0 without a second query when the first page is empty', async () => {
    const client = new MessageQueryClient();
    const memory = new MemoryPG({ client });

    const result = await memory.listMessages({ threadId: 'thread-1', perPage: 10, page: 0 });

    expect(client.queries).toHaveLength(1);
    expect(result.total).toBe(0);
    expect(result.messages).toEqual([]);
  });

  it('sends a COUNT query only for a page after the last row', async () => {
    const client = new MessageQueryClient();
    client.fallbackCount = 5;
    const memory = new MemoryPG({ client });

    const result = await memory.listMessages({ threadId: 'thread-1', perPage: 10, page: 2 });

    expect(client.queries).toHaveLength(2);
    expect(client.queries[0]!.query).toContain('AS "__total"');
    expect(client.queries[0]!.query).not.toContain('COUNT(*) OVER ()');
    expect(client.queries[1]!.query).toContain('SELECT COUNT(*) FROM');
    expect(result.total).toBe(5);
    expect(result.messages).toEqual([]);
  });

  it('starts the include read before the page read finishes', async () => {
    const client = new MessageQueryClient();
    client.pageRows = pageRows;
    client.windowTotal = 2;
    client.includeRows = [createRow('message-9', '2025-01-01T00:00:09.000Z')];
    const memory = new MemoryPG({ client });

    client.block();
    const pending = memory.listMessages({
      threadId: 'thread-1',
      perPage: 10,
      page: 0,
      include: [{ id: 'message-9' }],
    });
    await flushMicrotasks();
    const inFlight = client.queries.map(recorded => recorded.query);
    client.release();
    const result = await pending;

    expect(inFlight).toHaveLength(2);
    expect(inFlight.some(query => query.includes('AS "__total"'))).toBe(true);
    expect(inFlight.some(query => query.includes('thread_id, "createdAt" FROM'))).toBe(true);
    expect(result.messages.map(message => message.id)).toEqual(['message-1', 'message-2', 'message-9']);
  });

  // Regression for #23359: the default agent recall page must be index-servable —
  // no window count over `content`, and ORDER BY the indexed column, not COALESCE.
  it('emits an index-servable page query for the default agent recall path', async () => {
    const client = new MessageQueryClient();
    client.pageRows = pageRows;
    client.windowTotal = 2;
    const memory = new MemoryPG({ client });

    await memory.listMessages({ threadId: 'thread-1', perPage: 10, page: 0 });

    expect(client.queries).toHaveLength(1);
    const [pageQuery] = client.queries;
    expect(pageQuery!.query).not.toContain('COUNT(*) OVER ()');
    expect(pageQuery!.query).not.toContain('ORDER BY COALESCE');
    expect(pageQuery!.query).toContain('ORDER BY "createdAt"');
    expect(pageQuery!.query).toContain('(SELECT COUNT(*) FROM');
  });
});

/**
 * Fake client for the `includeTotal: false` path. The page query no longer carries
 * the `AS "__total"` count subquery, so it answers the plain page read (a peek of
 * `perPage + 1` rows) from `pageRows`.
 */
class SkipCountQueryClient extends RecordingDbClientBase {
  pageRows: Record<string, unknown>[] = [];

  override async manyOrNone<T = any>(query: string, values?: QueryValues): Promise<T[]> {
    this.queries.push({ query, values });
    if (query.includes('AS "__total"')) {
      throw new Error('COUNT(*) subquery must not run when includeTotal is false');
    }
    // Honor the LIMIT (peek = perPage + 1) so hasMore detection can be exercised.
    const limit = typeof values?.[values.length - 2] === 'number' ? (values[values.length - 2] as number) : undefined;
    const rows = limit !== undefined ? this.pageRows.slice(0, limit) : this.pageRows;
    return rows as T[];
  }
}

describe('MemoryPG message paging with includeTotal: false', () => {
  it('skips the COUNT(*) subquery and peeks LIMIT perPage + 1', async () => {
    const client = new SkipCountQueryClient();
    client.pageRows = [
      createRow('message-1', '2025-01-01T00:00:00.000Z'),
      createRow('message-2', '2025-01-01T00:00:01.000Z'),
    ];
    const memory = new MemoryPG({ client });

    const result = await memory.listMessages({ threadId: 'thread-1', perPage: 10, page: 0, includeTotal: false });

    expect(client.queries).toHaveLength(1);
    const [pageQuery] = client.queries;
    expect(pageQuery!.query).not.toContain('AS "__total"');
    expect(pageQuery!.query).not.toContain('COUNT(*)');
    expect(pageQuery!.query).toContain('ORDER BY "createdAt"');
    expect(pageQuery!.query).toContain('LIMIT $2 OFFSET $3');
    // Peek asks for perPage + 1 rows.
    expect(pageQuery!.values).toEqual(['thread-1', 11, 0]);
    expect(result.messages).toHaveLength(2);
    expect(result.hasMore).toBe(false);
  });

  it('reports hasMore from the extra peeked row without counting', async () => {
    const client = new SkipCountQueryClient();
    // Return perPage + 1 rows so the extra row signals more pages.
    client.pageRows = [
      createRow('message-1', '2025-01-01T00:00:00.000Z'),
      createRow('message-2', '2025-01-01T00:00:01.000Z'),
      createRow('message-3', '2025-01-01T00:00:02.000Z'),
    ];
    const memory = new MemoryPG({ client });

    const result = await memory.listMessages({ threadId: 'thread-1', perPage: 2, page: 0, includeTotal: false });

    expect(client.queries).toHaveLength(1);
    expect(client.queries[0]!.values).toEqual(['thread-1', 3, 0]);
    // The extra peeked row is dropped from the returned page.
    expect(result.messages).toHaveLength(2);
    expect(result.hasMore).toBe(true);
  });

  it('still emits the COUNT(*) subquery by default (includeTotal omitted)', async () => {
    const client = new MessageQueryClient();
    client.pageRows = pageRows;
    client.windowTotal = 7;
    const memory = new MemoryPG({ client });

    const result = await memory.listMessages({ threadId: 'thread-1', perPage: 10, page: 0 });

    expect(client.queries[0]!.query).toContain('AS "__total"');
    expect(result.total).toBe(7);
  });
});
