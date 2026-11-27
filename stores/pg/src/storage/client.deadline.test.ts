import type { Pool, PoolClient, QueryResult } from 'pg';
import { describe, expect, it } from 'vitest';

import { PinnedClientAdapter, PoolAdapter, TransactionDeadlineError } from './client';

/**
 * What a deadline-bound transaction sends, with the clock in the client's hands: a fake PoolClient
 * that records each statement and can be slowed per statement. Postgres's own enforcement of the
 * timeouts is covered against a real server in domains/knowledge/deadline.test.ts.
 */
function recordingClient(delays: Array<[RegExp, number]> = []) {
  const sent: string[] = [];
  const client = {
    async query(sql: string): Promise<QueryResult> {
      sent.push(sql);
      const slow = delays.find(([pattern]) => pattern.test(sql));
      if (slow) await new Promise(resolve => setTimeout(resolve, slow[1]));
      return { rows: [], rowCount: 0, command: sql.split(' ')[0]!.toUpperCase(), oid: 0, fields: [] } as QueryResult;
    },
    release() {},
  } as unknown as PoolClient;
  return { client, sent };
}

const poolOf = (client: PoolClient) => ({ connect: async () => client }) as unknown as Pool;

describe('transaction deadline: what is sent', () => {
  it('sends no statement once the deadline passes during timeout setup', async () => {
    const { client, sent } = recordingClient([[/^SET LOCAL statement_timeout/, 150]]);
    const adapter = new PoolAdapter(poolOf(client));
    const outcome = await adapter
      .tx(t => t.query('SELECT payload'), { deadlineAt: Date.now() + 100 })
      .catch((error: unknown) => error);
    expect(outcome).toBeInstanceOf(TransactionDeadlineError);
    expect(sent).not.toContain('SELECT payload');
    expect(sent.at(-1)).toBe('ROLLBACK');
  });

  it('sends no BEGIN for a pooled transaction whose deadline passed before it got a connection', async () => {
    const { client, sent } = recordingClient();
    const slowPool = {
      connect: () => new Promise<PoolClient>(resolve => setTimeout(() => resolve(client), 150)),
    } as unknown as Pool;
    const outcome = await new PoolAdapter(slowPool)
      .tx(t => t.query('SELECT payload'), { deadlineAt: Date.now() + 100 })
      .catch((error: unknown) => error);
    expect(outcome).toBeInstanceOf(TransactionDeadlineError);
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(sent).toEqual([]);
  });

  it('sends no BEGIN for a pinned transaction whose deadline passed while it waited in the queue', async () => {
    const { client, sent } = recordingClient([[/^SELECT slow/, 200]]);
    const adapter = new PinnedClientAdapter({} as Pool, client);
    const first = adapter.tx(t => t.query('SELECT slow'));
    const second = adapter
      .tx(t => t.query('SELECT payload'), { deadlineAt: Date.now() + 50 })
      .catch((error: unknown) => error);
    await first;
    expect(await second).toBeInstanceOf(TransactionDeadlineError);
    expect(sent).toEqual(['BEGIN', 'SELECT slow', 'COMMIT']);
  });

  it('still runs a pinned transaction that reaches the front in time', async () => {
    const { client, sent } = recordingClient();
    const adapter = new PinnedClientAdapter({} as Pool, client);
    await adapter.tx(t => t.query('SELECT payload'), { deadlineAt: Date.now() + 5_000 });
    expect(sent[0]).toBe('BEGIN');
    expect(sent).toContain('SELECT payload');
    expect(sent.at(-1)).toBe('COMMIT');
  });
});
