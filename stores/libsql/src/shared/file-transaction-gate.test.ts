import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@libsql/client';
import type { Client } from '@libsql/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { gateIfLocalFile, localDatabaseFileKey } from './file-transaction-gate';

describe('gateIfLocalFile', () => {
  let dir: string;
  let url: string;
  const clients: Client[] = [];

  const open = (gated: boolean) => {
    const client = createClient({ url, timeout: 1_000 });
    clients.push(client);
    return gated ? gateIfLocalFile(client, url) : client;
  };

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'libsql-gate-'));
    url = `file:${join(dir, 'db.sqlite')}`;
    await open(false).executeMultiple('PRAGMA journal_mode=WAL; CREATE TABLE t (v TEXT);');
  });

  afterEach(() => {
    for (const client of clients.splice(0)) client.close();
    rmSync(dir, { recursive: true, force: true });
  });

  // Holds a write transaction open across an await while another client writes the same file.
  // Each side runs in its own async flow, as unrelated store calls do.
  const writeDuringTransaction = async (a: Client, b: Client) => {
    let opened!: () => void;
    const isOpen = new Promise<void>(resolve => (opened = resolve));
    const holder = (async () => {
      await null;
      const tx = await a.transaction('write');
      await tx.execute("INSERT INTO t VALUES ('a')");
      opened();
      await new Promise(resolve => setTimeout(resolve, 20));
      await tx.commit();
    })();
    const writer = (async () => {
      await isOpen;
      await b.execute("INSERT INTO t VALUES ('b')");
    })();
    const failed = (await Promise.allSettled([holder, writer])).find(r => r.status === 'rejected');
    if (failed) throw failed.reason;
    return (await b.execute('SELECT v FROM t ORDER BY v')).rows.map(row => row.v);
  };

  it('fails with SQLITE_BUSY without the gate', async () => {
    await expect(writeDuringTransaction(open(false), open(false))).rejects.toMatchObject({ code: 'SQLITE_BUSY' });
  });

  it("lets another client's write wait for an open transaction on the same file", async () => {
    await expect(writeDuringTransaction(open(true), open(true))).resolves.toEqual(['a', 'b']);
  });

  it('opens one transaction at a time when several clients were waiting for the same one', async () => {
    const holder = open(true);
    const tx = await holder.transaction('write');
    await tx.execute("INSERT INTO t VALUES ('a')");
    const queued = ['b', 'c'].map(v =>
      (async () => {
        const own = await open(true).transaction('write');
        await own.execute({ sql: 'INSERT INTO t VALUES (?)', args: [v] });
        await new Promise(resolve => setTimeout(resolve, 20));
        await own.commit();
      })(),
    );
    await new Promise(resolve => setTimeout(resolve, 20));
    await tx.commit();
    const failed = (await Promise.allSettled(queued)).find(r => r.status === 'rejected');
    if (failed) throw failed.reason;
    expect((await holder.execute('SELECT v FROM t ORDER BY v')).rows.map(row => row.v)).toEqual(['a', 'b', 'c']);
  });

  const within = <T>(promise: Promise<T>, ms: number) =>
    Promise.race([promise, new Promise<'waited'>(resolve => setTimeout(resolve, ms, 'waited'))]);

  it("doesn't make a client wait for its own transaction", async () => {
    const a = open(true);
    const tx = await a.transaction('write');
    await tx.execute("INSERT INTO t VALUES ('a')");
    const read = await within(a.execute('SELECT count(*) AS n FROM t'), 500);
    await tx.commit();
    expect(read).not.toBe('waited');
  });

  it('goes ahead once a transaction has been open for maxWaitMs, so a caller holding it cannot hang', async () => {
    const a = open(true);
    const b = gateIfLocalFile(createClient({ url, timeout: 1_000 }), url, { maxWaitMs: 50 });
    clients.push(b);
    const tx = await a.transaction('write');
    await tx.execute("INSERT INTO t VALUES ('a')");
    const read = await within(b.execute('SELECT count(*) AS n FROM t'), 1_000);
    await tx.commit();
    expect(read).not.toBe('waited');
  });

  it('keys urls by the file they point at', () => {
    expect(localDatabaseFileKey('file:./a.db')).toBe(localDatabaseFileKey(`file:${join(process.cwd(), 'a.db')}`));
    expect(localDatabaseFileKey('file::memory:')).toBeUndefined();
    expect(localDatabaseFileKey('libsql://example.turso.io')).toBeUndefined();
  });
});
