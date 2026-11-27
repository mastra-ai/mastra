import type { Pool, PoolClient, QueryResult } from 'pg';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { PinnedClientAdapter, PoolAdapter, TransactionDeadlineError } from './client';
import type { TransactionClient } from './client';

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

describe('transaction deadline: timeout headroom', () => {
  const setCalls = (sent: string[]) => sent.filter(sql => sql.startsWith('SET LOCAL statement_timeout'));
  const installed = (sql: string) => Number(/statement_timeout = (\d+)/.exec(sql)![1]);

  it('refreshes the timeouts once per headroom window instead of before every statement', async () => {
    const { client, sent } = recordingClient();
    const adapter = new PoolAdapter(poolOf(client), undefined, { timeoutHeadroomMs: 1_000 });
    const started = Date.now();
    await adapter.tx(
      async t => {
        for (let i = 0; i < 50; i++) await t.query(`SELECT ${i}`);
      },
      { deadlineAt: started + 45_000 },
    );
    const elapsed = Date.now() - started;
    expect(setCalls(sent).length).toBeLessThanOrEqual(1 + Math.ceil(elapsed / 1_000));
    expect(installed(setCalls(sent)[0]!)).toBeLessThanOrEqual(44_000);
  });

  it('refreshes before every statement without headroom, as before', async () => {
    for (const options of [undefined, { timeoutHeadroomMs: 0 }]) {
      const { client, sent } = recordingClient();
      await new PoolAdapter(poolOf(client), undefined, options).tx(
        async t => {
          for (let i = 0; i < 5; i++) await t.query(`SELECT ${i}`);
        },
        { deadlineAt: Date.now() + 45_000 },
      );
      expect(sent.slice(1, -1).map(sql => (sql.startsWith('SET LOCAL') ? 'SET' : sql))).toEqual([
        'SET',
        'SELECT 0',
        'SET',
        'SELECT 1',
        'SET',
        'SELECT 2',
        'SET',
        'SELECT 3',
        'SET',
        'SELECT 4',
      ]);
      for (const sql of setCalls(sent)) expect(installed(sql)).toBeGreaterThan(44_000);
    }
  });

  it('keeps no reuse record when setting the timeouts took longer than the headroom', async () => {
    const { client, sent } = recordingClient([[/^SET LOCAL statement_timeout/, 30]]);
    await new PoolAdapter(poolOf(client), undefined, { timeoutHeadroomMs: 10 }).tx(
      async t => {
        for (let i = 0; i < 5; i++) await t.query(`SELECT ${i}`);
      },
      { deadlineAt: Date.now() + 45_000 },
    );
    expect(setCalls(sent)).toHaveLength(5);
  });

  it('installs the whole time left, and keeps no record, within twice the headroom of the deadline', async () => {
    const { client, sent } = recordingClient();
    // A fixed clock, so the time left is exactly 1,500 ms whenever the process is scheduled.
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now);
    onTestFinished(() => vi.restoreAllMocks());
    await new PoolAdapter(poolOf(client), undefined, { timeoutHeadroomMs: 1_000 }).tx(
      async t => {
        for (let i = 0; i < 3; i++) await t.query(`SELECT ${i}`);
      },
      { deadlineAt: now + 1_500 },
    );
    expect(setCalls(sent)).toHaveLength(3);
    for (const sql of setCalls(sent)) expect(installed(sql)).toBe(1_500);
  });

  it('refreshes after a timeout refresh that failed', async () => {
    const { client, sent } = recordingClient();
    let failed = false;
    const flaky = {
      ...client,
      release() {},
      async query(sql: string) {
        if (!failed && sql.startsWith('SET LOCAL')) {
          failed = true;
          sent.push(sql);
          throw new Error('connection blip');
        }
        return client.query(sql);
      },
    } as unknown as PoolClient;
    // The failed call is kept for COMMIT, so the transaction itself rejects; what was sent matters here.
    await new PoolAdapter(poolOf(flaky), undefined, { timeoutHeadroomMs: 1_000 })
      .tx(
        async t => {
          await t.query('SELECT a').catch(() => undefined);
          await t.query('SELECT b');
        },
        { deadlineAt: Date.now() + 45_000 },
      )
      .catch(() => undefined);
    const b = sent.indexOf('SELECT b');
    expect(sent[b - 1]).toMatch(/^SET LOCAL statement_timeout/);
    expect(setCalls(sent)).toHaveLength(2);
  });

  it('refreshes after rolling back to a savepoint, which restores the timeouts set before it', async () => {
    const { client, sent } = recordingClient();
    await new PoolAdapter(poolOf(client), undefined, { timeoutHeadroomMs: 1_000 }).tx(
      async t => {
        await t.query('SELECT outer');
        await (t as TransactionClient)
          .savepoint('sp_1', async () => {
            await t.query('SELECT inner');
            throw new Error('refused');
          })
          .catch(() => undefined);
        await t.query('SELECT after');
      },
      { deadlineAt: Date.now() + 45_000 },
    );
    const after = sent.indexOf('SELECT after');
    expect(sent[after - 1]).toMatch(/^SET LOCAL statement_timeout/);
    expect(sent.slice(0, after)).toContain('ROLLBACK TO SAVEPOINT sp_1');
  });

  it.each([
    ['a raw rollback', 'ROLLBACK TO SAVEPOINT sp_raw'],
    ['a lowercase rollback after a comment', '/* undo */ rollback to sp_raw'],
    ['a multi-statement string ending in a rollback', 'SELECT 1; ROLLBACK TO SAVEPOINT sp_raw'],
    ['a caller setting its own statement timeout', "SELECT set_config('statement_timeout', '0', true)"],
    ['a caller SET with a comment before the name', 'SET LOCAL /* mine */ lock_timeout = 0'],
    ['a reset', 'RESET ALL'],
  ])('refreshes after %s sent through query()', async (_label, raw) => {
    const { client, sent } = recordingClient();
    await new PoolAdapter(poolOf(client), undefined, { timeoutHeadroomMs: 1_000 }).tx(
      async t => {
        await t.query('SAVEPOINT sp_raw');
        await t.query('SELECT inner');
        await t.query(raw);
        await t.query('SELECT after');
      },
      { deadlineAt: Date.now() + 45_000 },
    );
    const after = sent.indexOf('SELECT after');
    expect(sent[after - 1]).toMatch(/^SET LOCAL statement_timeout/);
  });

  it('still reuses the timeouts across ordinary statements, UPDATE ... SET and reading the setting included', async () => {
    const { client, sent } = recordingClient();
    await new PoolAdapter(poolOf(client), undefined, { timeoutHeadroomMs: 1_000 }).tx(
      async t => {
        await t.query('SELECT 1');
        await t.query('UPDATE pages SET name = $1', ['x']);
        await t.query("SELECT current_setting('statement_timeout')");
        await t.query('SELECT 2');
      },
      { deadlineAt: Date.now() + 45_000 },
    );
    expect(setCalls(sent)).toHaveLength(1);
  });
});
