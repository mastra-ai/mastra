import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createClient } from '@libsql/client';
import type { Client } from '@libsql/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { resetConnectionsAfterBusy } from './reset-after-busy-client';

describe('resetConnectionsAfterBusy', () => {
  let dir: string;
  const opened: Client[] = [];

  const setup = async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'libsql-reset-after-busy-'));
    const url = `file:${path.join(dir, 'db.sqlite')}`;
    const open = (timeout?: number) => {
      const client = createClient({ url, ...(timeout ? { timeout } : {}) });
      opened.push(client);
      return client;
    };
    await open().executeMultiple('PRAGMA journal_mode=WAL; CREATE TABLE t (v TEXT);');
    // A 1ms busy timeout turns a held lock into an immediate refusal.
    const client = resetConnectionsAfterBusy(open(1));
    const holdWriteLock = async () => {
      const holder = open();
      const held = await holder.transaction('write');
      return () => held.rollback();
    };
    const observer = open(1);
    const visible = async () => (await observer.execute('SELECT v FROM t')).rows.map(r => r.v);
    const lockIsFree = () =>
      observer.transaction('write').then(
        tx => tx.rollback().then(() => true),
        () => false,
      );
    return { client, holdWriteLock, visible, lockIsFree };
  };

  afterEach(() => {
    opened.splice(0).forEach(client => client.close());
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const insert = (client: Client, v: string) => client.execute({ sql: 'INSERT INTO t VALUES (?)', args: [v] });

  /** Runs `call` in an async context of its own, as a concurrent request would. */
  const elsewhere = <T>(call: () => Promise<T>) => Promise.resolve().then(call);

  it.each([
    ['an autocommit write', (client: Client) => insert(client, 'refused')],
    [
      'a write batch',
      (client: Client) => client.batch([{ sql: 'INSERT INTO t VALUES (?)', args: ['refused'] }], 'write'),
    ],
    ['a write transaction', (client: Client) => client.transaction('write')],
    [
      'a write inside a deferred transaction',
      async (client: Client) => {
        const tx = await client.transaction('deferred');
        try {
          await tx.execute({ sql: 'INSERT INTO t VALUES (?)', args: ['refused'] });
        } finally {
          tx.close();
        }
      },
    ],
  ])('commits the next write once the lock clears after %s was refused', async (_, refusedWrite) => {
    const { client, holdWriteLock, visible, lockIsFree } = await setup();
    const release = await holdWriteLock();
    await expect(refusedWrite(client)).rejects.toMatchObject({ code: 'SQLITE_BUSY' });
    await release();

    await insert(client, 'after');
    const tx = await client.transaction('write');
    await tx.execute({ sql: 'INSERT INTO t VALUES (?)', args: ['in-tx'] });
    await tx.commit();

    expect(await visible()).toEqual(['after', 'in-tx']);
    expect(await lockIsFree()).toBe(true);
  });

  it('keeps an open transaction usable and resets once it ends', async () => {
    const { client, holdWriteLock, visible } = await setup();
    const reading = await client.transaction('read');
    const release = await holdWriteLock();
    await expect(insert(client, 'refused')).rejects.toMatchObject({ code: 'SQLITE_BUSY' });
    await release();

    expect((await reading.execute('SELECT count(*) AS n FROM t')).rows[0]?.n).toBe(0);
    await reading.commit();

    await insert(client, 'after');
    expect(await visible()).toEqual(['after']);
  });

  it('resets while calls keep overlapping, by holding new calls until the running ones end', async () => {
    const { client, holdWriteLock, visible, lockIsFree } = await setup();
    const first = await elsewhere(() => client.transaction('read'));
    const release = await holdWriteLock();
    await expect(elsewhere(() => insert(client, 'refused'))).rejects.toMatchObject({ code: 'SQLITE_BUSY' });
    await release();

    // The next call arrives before the first ends and outlasts it, so the client is never idle.
    const second = elsewhere(() => client.transaction('read'));
    await first.commit();
    const reading = await second;

    await insert(client, 'after');
    expect(await visible()).toEqual(['after']);
    expect(await lockIsFree()).toBe(true);
    await reading.commit();
  });

  it('lets a caller holding an open transaction use the client while a reset waits for that transaction', async () => {
    const { client, holdWriteLock, visible } = await setup();
    const reading = await client.transaction('read');
    const release = await holdWriteLock();
    await expect(insert(client, 'refused')).rejects.toMatchObject({ code: 'SQLITE_BUSY' });
    await release();

    let timer: ReturnType<typeof setTimeout> | undefined;
    const outcome = await Promise.race([
      client.execute('SELECT count(*) AS n FROM t').then(() => 'ran'),
      new Promise(resolve => (timer = setTimeout(resolve, 1_000, 'waited for its own transaction'))),
    ]);
    clearTimeout(timer);
    expect(outcome).toBe('ran');
    await reading.commit();

    await insert(client, 'after');
    expect(await visible()).toEqual(['after']);
  });

  it('lets a replaced method delegate to the previous one after a reset became pending', async () => {
    const { client, holdWriteLock, visible } = await setup();
    let delegate!: () => void;
    const delegating = new Promise<void>(resolve => (delegate = resolve));
    const execute = client.execute;
    client.execute = (async statement => {
      await delegating;
      return execute(statement);
    }) as Client['execute'];
    const read = client.execute('SELECT count(*) AS n FROM t');

    const release = await holdWriteLock();
    await expect(
      elsewhere(() => client.batch([{ sql: 'INSERT INTO t VALUES (?)', args: ['refused'] }], 'write')),
    ).rejects.toMatchObject({ code: 'SQLITE_BUSY' });
    await release();
    delegate();

    let timer: ReturnType<typeof setTimeout> | undefined;
    const outcome = await Promise.race([
      read.then(() => 'ran'),
      new Promise(resolve => (timer = setTimeout(resolve, 1_000, 'waited for the call it delegates from'))),
    ]);
    clearTimeout(timer);
    expect(outcome).toBe('ran');

    await insert(client, 'after');
    expect(await visible()).toEqual(['after']);
  });

  it('runs afterReset once the connections have been reopened', async () => {
    const { holdWriteLock } = await setup();
    const afterReset = vi.fn();
    const raw = createClient({ url: `file:${path.join(dir, 'db.sqlite')}`, timeout: 1 });
    opened.push(raw);
    const client = resetConnectionsAfterBusy(raw, { afterReset });
    const release = await holdWriteLock();
    await expect(insert(client, 'refused')).rejects.toMatchObject({ code: 'SQLITE_BUSY' });
    expect(afterReset).toHaveBeenCalledOnce();
    await release();
    await insert(client, 'after');
    expect(afterReset).toHaveBeenCalledOnce();
  });

  it('lets a caller replace a method with one that delegates to the previous one', async () => {
    const { client, visible } = await setup();
    const seen: string[] = [];
    const execute = client.execute;
    const transaction = client.transaction;
    client.execute = (statement => {
      seen.push('execute');
      return execute(statement);
    }) as Client['execute'];
    client.transaction = (mode => {
      seen.push('transaction');
      return transaction(mode);
    }) as Client['transaction'];

    await insert(client, 'patched');
    const tx = await client.transaction('write');
    await tx.rollback();

    expect(seen).toEqual(['execute', 'transaction']);
    expect(await visible()).toEqual(['patched']);
  });

  it('does not reopen a client that was closed while a reset was pending', async () => {
    const { client, holdWriteLock } = await setup();
    const reading = await client.transaction('read');
    const release = await holdWriteLock();
    await expect(insert(client, 'refused')).rejects.toMatchObject({ code: 'SQLITE_BUSY' });
    await release();

    client.close();
    reading.close();
    expect(client.closed).toBe(true);
  });

  it('fails a call waiting for a reset once the client is closed', async () => {
    const { client, holdWriteLock } = await setup();
    await elsewhere(() => client.transaction('read'));
    const release = await holdWriteLock();
    await expect(elsewhere(() => insert(client, 'refused'))).rejects.toMatchObject({ code: 'SQLITE_BUSY' });
    await release();

    const waiting = insert(client, 'after');
    client.close();
    await expect(waiting).rejects.toMatchObject({ code: 'CLIENT_CLOSED' });
  });
});
