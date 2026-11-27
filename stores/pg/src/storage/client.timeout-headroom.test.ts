import net from 'node:net';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PoolAdapter, TransactionDeadlineError } from './client';
import type { TransactionClient, TxClient } from './client';
import { connectionString, TEST_CONFIG } from './test-utils';
import { PostgresStore } from '.';

/**
 * Timeout headroom against a real server: what Postgres has installed as `statement_timeout` and
 * `lock_timeout` when each statement starts, compared with the time left to the deadline. The
 * read is itself the bounded statement, so the time left measured after it returns is a lower
 * bound on the time left when it started: `installed - leftAfter` is an upper bound on how far
 * the installed timeout exceeds the time left.
 */
const TOLERANCE_MS = 50;

async function installed(t: TxClient, deadlineAt: number) {
  const startedAt = Date.now();
  const rows = await t.any<{ name: string; setting: string }>(
    `SELECT name, setting FROM pg_settings WHERE name IN ('statement_timeout', 'lock_timeout') ORDER BY name`,
  );
  const leftAfter = deadlineAt - Date.now();
  const lock = Number(rows.find(row => row.name === 'lock_timeout')!.setting);
  const statement = Number(rows.find(row => row.name === 'statement_timeout')!.setting);
  expect(lock).toBe(statement);
  return { value: statement, excess: statement - leftAfter, tookMs: Date.now() - startedAt };
}

/** A TCP proxy delaying every chunk by `delay` ms each way, in order. */
function lagProxy(targetPort: number, delay: number): Promise<{ port: number; close: () => Promise<void> }> {
  const lag = (from: net.Socket, to: net.Socket) => {
    let chain = Promise.resolve();
    from.on('data', chunk => {
      const due = Date.now() + delay;
      chain = chain
        .then(() => new Promise(resolve => setTimeout(resolve, Math.max(0, due - Date.now()))))
        .then(() => void to.write(chunk));
    });
    from.on('close', () => void chain.then(() => to.end()));
    from.on('error', () => {});
  };
  const sockets = new Set<net.Socket>();
  const server = net.createServer(client => {
    const upstream = net.connect(targetPort, (TEST_CONFIG as { host: string }).host);
    sockets.add(client).add(upstream);
    lag(client, upstream);
    lag(upstream, client);
  });
  return new Promise(resolve =>
    server.listen(0, '127.0.0.1', () =>
      resolve({
        port: (server.address() as net.AddressInfo).port,
        close: () =>
          new Promise(done => {
            for (const socket of sockets) socket.destroy();
            server.close(() => done());
          }),
      }),
    ),
  );
}

const pool = new Pool({ connectionString, max: 2 });
const withHeadroom = (timeoutHeadroomMs: number) => new PoolAdapter(pool, undefined, { timeoutHeadroomMs });

describe('PG transaction timeout headroom', () => {
  afterAll(async () => {
    await pool.end();
  });

  it('installs the time left minus the headroom, then reuses it within the headroom', async () => {
    const deadlineAt = Date.now() + 45_000;
    await withHeadroom(1_000).tx(
      async t => {
        const fresh = await installed(t, deadlineAt);
        expect(fresh.excess).toBeLessThanOrEqual(-1_000 + TOLERANCE_MS);
        const reused = await installed(t, deadlineAt);
        expect(reused.value).toBe(fresh.value);
        expect(reused.excess).toBeLessThan(0);
      },
      { deadlineAt },
    );
  });

  it('installs the whole time left within twice the headroom of the deadline', async () => {
    const deadlineAt = Date.now() + 1_500;
    await withHeadroom(1_000).tx(
      async t => {
        for (let i = 0; i < 3; i++) {
          const { excess } = await installed(t, deadlineAt);
          expect(excess).toBeLessThanOrEqual(TOLERANCE_MS);
          expect(excess).toBeGreaterThan(-TOLERANCE_MS);
        }
      },
      { deadlineAt },
    );
  });

  it('installs the whole time left before every statement with no headroom', async () => {
    const deadlineAt = Date.now() + 45_000;
    await withHeadroom(0).tx(
      async t => {
        for (let i = 0; i < 3; i++) {
          const { excess } = await installed(t, deadlineAt);
          expect(excess).toBeLessThanOrEqual(TOLERANCE_MS);
          expect(excess).toBeGreaterThan(-TOLERANCE_MS);
        }
      },
      { deadlineAt },
    );
  });

  it('exceeds the time left by no more than the refresh round trip minus the headroom when the network is slow', async () => {
    const proxy = await lagProxy(Number((TEST_CONFIG as { port: number }).port), 10);
    const slowPool = new Pool({ connectionString: connectionString.replace(/:\d+\//, `:${proxy.port}/`), max: 1 });
    try {
      const deadlineAt = Date.now() + 45_000;
      await new PoolAdapter(slowPool, undefined, { timeoutHeadroomMs: 10 }).tx(
        async t => {
          for (let i = 0; i < 5; i++) {
            const { excess, tookMs } = await installed(t, deadlineAt);
            // The refresh before this read took about as long as the read (`tookMs` includes both).
            expect(excess).toBeLessThanOrEqual(tookMs - 10 + TOLERANCE_MS);
          }
        },
        { deadlineAt },
      );
    } finally {
      await slowPool.end();
      await proxy.close();
    }
  });

  it('refreshes after a refused savepoint restores a longer timeout', async () => {
    const started = Date.now();
    const deadlineAt = started + 8_000;
    let innerError: unknown;
    let afterRollback: Awaited<ReturnType<typeof installed>> | undefined;
    const outcome = await withHeadroom(1_000)
      .tx(
        async t => {
          // Outer refresh: installs about 7,000 and records it.
          await t.query('SELECT 1');
          await (t as TransactionClient)
            // SAVEPOINT is bounded too: it reuses the outer record, so nothing inside refreshes yet.
            .savepoint('sp_headroom', async () => {
              // Still within the headroom of the outer refresh: reuses about 7,000.
              await t.query('SELECT pg_sleep(3)');
              // The record has expired: refreshes to about 4,000, records it, then fails.
              await t.query('SELECT 1 / 0');
            })
            .catch((error: unknown) => {
              innerError = error;
            });
          // ROLLBACK TO put the server back at about 7,000 with about 5,000 left.
          afterRollback = await installed(t, deadlineAt);
          await t.query('SELECT pg_sleep(30)');
        },
        { deadlineAt },
      )
      .catch((error: unknown) => error);

    expect((innerError as { code?: string }).code).toBe('22012');
    expect(afterRollback!.excess).toBeLessThanOrEqual(-1_000 + TOLERANCE_MS);
    expect(outcome).toBeInstanceOf(TransactionDeadlineError);
    expect(Date.now() - started).toBeLessThan(8_000 + 500);
  }, 15_000);
});

describe('PostgresStore transactionTimeoutHeadroomMs', () => {
  let store: PostgresStore;
  beforeAll(() => {
    store = new PostgresStore({ ...TEST_CONFIG, id: 'headroom-test', transactionTimeoutHeadroomMs: 1_000 });
  });
  afterAll(async () => {
    await store.close();
  });

  it("passes the store's headroom to its transactions", async () => {
    const deadlineAt = Date.now() + 45_000;
    await store.db.tx(
      async t => {
        const { excess } = await installed(t, deadlineAt);
        expect(excess).toBeLessThanOrEqual(-1_000 + TOLERANCE_MS);
      },
      { deadlineAt },
    );
  });
});
