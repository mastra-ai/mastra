import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import * as fsModule from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { createClient } from '@libsql/client';
import Database from 'libsql';
import { describe, it, expect, vi, afterEach } from 'vitest';

// Passthrough spies on node:fs so the swap-rollback test can fail a targeted
// renameSync call while everything else uses the real filesystem.
vi.mock('node:fs', { spy: true });
const realFs = await vi.importActual<typeof fsModule>('node:fs');

import type { LibSQLStorageConfig, PgStorageConfig } from '../project.js';
import { getDatabasePath, getVectorDatabasePath } from '../project.js';
import { createStorage } from '../storage-factory.js';
import type { StorageMaintenance } from '../storage-maintenance.js';
import {
  createStorageMaintenance,
  DEFAULT_RETENTION,
  reclaimLibSQLDisk,
  requiredFreeBytes,
  resolveLocalDbFiles,
  runStorageMaintenance,
} from '../storage-maintenance.js';

function libsqlConfig(overrides?: Partial<LibSQLStorageConfig>): LibSQLStorageConfig {
  return {
    backend: 'libsql',
    url: 'file:/tmp/mastra-test.db',
    isRemote: false,
    ...overrides,
  };
}

describe('resolveLocalDbFiles', () => {
  it('returns the main db and default vector db for a local libsql url', () => {
    const files = resolveLocalDbFiles(libsqlConfig(), 'libsql');
    expect(files).toEqual(['/tmp/mastra-test.db', getVectorDatabasePath()]);
  });

  it('uses the explicit vectorUrl when provided', () => {
    const files = resolveLocalDbFiles(libsqlConfig({ vectorUrl: 'file:/tmp/vectors.db' }), 'libsql');
    expect(files).toEqual(['/tmp/mastra-test.db', '/tmp/vectors.db']);
  });

  it('returns [] for remote libsql (turso) urls', () => {
    const files = resolveLocalDbFiles(libsqlConfig({ url: 'libsql://test.turso.io', isRemote: true }), 'libsql');
    expect(files).toEqual([]);
  });

  it('returns [] when the effective backend is pg', () => {
    const pg: PgStorageConfig = { backend: 'pg', connectionString: 'postgresql://x' } as PgStorageConfig;
    expect(resolveLocalDbFiles(pg, 'pg')).toEqual([]);
  });

  it('returns the default local files when pg fell back to libsql', () => {
    const pg: PgStorageConfig = { backend: 'pg' } as PgStorageConfig;
    expect(resolveLocalDbFiles(pg, 'libsql')).toEqual([getDatabasePath(), getVectorDatabasePath()]);
  });
});

describe('createStorageMaintenance', () => {
  it('delegates prune() to the storage instance', async () => {
    const prune = vi.fn().mockResolvedValue([{ domain: 'memory', table: 'messages', deleted: 3, done: true }]);
    const maintenance = createStorageMaintenance({
      storage: { prune } as any,
      backend: 'libsql',
      retention: DEFAULT_RETENTION,
      localDbFiles: ['/tmp/a.db'],
    });

    const results = await maintenance.prune({ maxRows: 10 });

    expect(prune).toHaveBeenCalledWith({ maxRows: 10 });
    expect(results).toEqual([{ domain: 'memory', table: 'messages', deleted: 3, done: true }]);
    expect(maintenance.reclaimDisk).toBeDefined();
  });

  it('omits reclaimDisk for pg backends and when no local files exist', () => {
    const base = { storage: { prune: vi.fn() } as any, retention: DEFAULT_RETENTION };
    expect(createStorageMaintenance({ ...base, backend: 'pg', localDbFiles: [] }).reclaimDisk).toBeUndefined();
    expect(createStorageMaintenance({ ...base, backend: 'libsql', localDbFiles: [] }).reclaimDisk).toBeUndefined();
  });

  it('closeStorage delegates to the store close() when present and no-ops otherwise', async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const closeVector = vi.fn().mockResolvedValue(undefined);
    const withClose = createStorageMaintenance({
      storage: { prune: vi.fn(), close } as any,
      backend: 'libsql',
      retention: DEFAULT_RETENTION,
      localDbFiles: [],
      closeVector,
    });
    await withClose.closeStorage!();
    expect(close).toHaveBeenCalledOnce();
    expect(closeVector).toHaveBeenCalledOnce();

    const withoutClose = createStorageMaintenance({
      storage: { prune: vi.fn() } as any,
      backend: 'libsql',
      retention: DEFAULT_RETENTION,
      localDbFiles: [],
    });
    await expect(withoutClose.closeStorage!()).resolves.toBeUndefined();
  });
});

describe('runStorageMaintenance', () => {
  function makeMaintenance(overrides?: Partial<StorageMaintenance>): StorageMaintenance {
    return {
      backend: 'libsql',
      retention: { memory: { messages: { maxAge: '90d' } } },
      prune: vi.fn().mockResolvedValue([]),
      closeStorage: vi.fn().mockResolvedValue(undefined),
      ...overrides,
    };
  }

  it('loops prune passes until every table reports done, logging cumulative progress', async () => {
    const prune = vi
      .fn()
      .mockResolvedValueOnce([
        { domain: 'observability', table: 'mastra_ai_spans', deleted: 20000, done: false },
        { domain: 'memory', table: 'mastra_messages', deleted: 120, done: true },
      ])
      .mockResolvedValueOnce([
        { domain: 'observability', table: 'mastra_ai_spans', deleted: 5000, done: true },
        { domain: 'memory', table: 'mastra_messages', deleted: 0, done: true },
      ]);
    const maintenance = makeMaintenance({ prune });
    const lines: string[] = [];

    await runStorageMaintenance({ maintenance, vacuum: false, log: line => lines.push(line) });

    expect(prune).toHaveBeenCalledTimes(2);
    // No keep-memory: the standing retention config is used (no override).
    expect(prune).toHaveBeenCalledWith({ maxBatches: 20 });
    const output = lines.join('\n');
    expect(output).toContain('memory.messages: 90d');
    expect(output).toContain('observability.mastra_ai_spans: 20000 rows deleted so far…');
    expect(output).toContain('observability.mastra_ai_spans: 25000 rows deleted');
    expect(output).toContain('memory.mastra_messages: 120 rows deleted');
    expect(output).toContain('Prune complete: 25120 rows deleted.');
    expect(maintenance.closeStorage).toHaveBeenCalledOnce();
  });

  it('keep-memory prunes with an override that drops the memory domain and marks it kept', async () => {
    const prune = vi
      .fn()
      .mockResolvedValue([{ domain: 'observability', table: 'mastra_ai_spans', deleted: 3, done: true }]);
    const maintenance = makeMaintenance({
      retention: {
        memory: { messages: { maxAge: '90d' }, threads: { maxAge: '90d' } },
        observability: { spans: { maxAge: '14d' } },
      },
      prune,
    });
    const lines: string[] = [];

    await runStorageMaintenance({ maintenance, vacuum: false, keepMemory: true, log: line => lines.push(line) });

    // Override contains everything EXCEPT the memory domain.
    expect(prune).toHaveBeenCalledWith({
      maxBatches: 20,
      retention: { observability: { spans: { maxAge: '14d' } } },
    });
    const output = lines.join('\n');
    expect(output).toContain('memory.messages: kept (keep-memory)');
    expect(output).toContain('memory.threads: kept (keep-memory)');
    expect(output).toContain('observability.spans: 14d');
  });

  it('reports when nothing is eligible and hints at /prune vacuum for local libsql', async () => {
    const maintenance = makeMaintenance({
      prune: vi.fn().mockResolvedValue([]),
      reclaimDisk: vi.fn(),
    });
    const lines: string[] = [];

    await runStorageMaintenance({ maintenance, vacuum: false, log: line => lines.push(line) });

    expect(lines.join('\n')).toContain('Nothing to prune');
    expect(lines.join('\n')).toContain('Run /prune vacuum to reclaim disk space.');
    expect(maintenance.reclaimDisk).not.toHaveBeenCalled();
  });

  it('bails out instead of spinning when a pass makes no progress', async () => {
    const prune = vi.fn().mockResolvedValue([{ domain: 'memory', table: 'mastra_messages', deleted: 0, done: false }]);
    const maintenance = makeMaintenance({ prune });
    const lines: string[] = [];

    await runStorageMaintenance({ maintenance, vacuum: false, log: line => lines.push(line) });

    expect(prune).toHaveBeenCalledTimes(1);
    expect(lines.join('\n')).toContain('no progress in the last pass');
  });

  it('closes storage before vacuuming and logs per-file reclamation', async () => {
    const order: string[] = [];
    const closeStorage = vi.fn().mockImplementation(async () => order.push('close'));
    const reclaimDisk = vi
      .fn()
      .mockImplementation(async (onFileStart?: (file: string, bytes: number, live: number) => void) => {
        order.push('vacuum');
        onFileStart?.('/tmp/mastra.db', 30 * 1024 ** 3, 10 * 1024 ** 3);
        return [{ file: '/tmp/mastra.db', bytesBefore: 30 * 1024 ** 3, bytesAfter: 5 * 1024 ** 3 }];
      });
    const maintenance = makeMaintenance({ closeStorage, reclaimDisk });
    const lines: string[] = [];

    await runStorageMaintenance({ maintenance, vacuum: true, log: line => lines.push(line) });

    expect(order).toEqual(['close', 'vacuum']);
    const output = lines.join('\n');
    expect(output).toContain('vacuuming /tmp/mastra.db (30.0 GB, ~10.0 GB live)…');
    expect(output).toContain('/tmp/mastra.db: 30.0 GB → 5.0 GB');
    expect(output).toContain('Reclaimed 25.0 GB.');
  });

  it('explains that vacuum is unavailable for non-local backends', async () => {
    const maintenance = makeMaintenance();
    const lines: string[] = [];

    await runStorageMaintenance({ maintenance, vacuum: true, log: line => lines.push(line) });

    expect(lines.join('\n')).toContain('only available for local libsql storage');
  });
});

describe('createStorage retention wiring', () => {
  it('passes DEFAULT_RETENTION to the libsql store', async () => {
    const result = await createStorage(libsqlConfig({ url: 'file::memory:' }));
    expect(result.backend).toBe('libsql');
    // retention is a protected field on MastraCompositeStore — reach in for the assertion
    expect((result.storage as any).retention).toEqual(DEFAULT_RETENTION);
  });
});

describe('requiredFreeBytes', () => {
  it('requires the compacted size plus 20% and 256 MB headroom', () => {
    const headroom = 256 * 1024 * 1024;
    expect(requiredFreeBytes(0)).toBe(headroom);
    expect(requiredFreeBytes(10 * 1024 ** 3)).toBe(Math.ceil(10 * 1024 ** 3 * 1.2) + headroom);
  });
});

describe('reclaimLibSQLDisk', () => {
  let dir: string | undefined;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  async function seedDb(dbFile: string, opts?: { keepRows?: boolean }) {
    const client = createClient({ url: `file:${dbFile}` });
    await client.execute('PRAGMA journal_mode = WAL');
    await client.execute('CREATE TABLE blobs (id INTEGER PRIMARY KEY, data TEXT)');
    const payload = 'x'.repeat(4096);
    for (let batch = 0; batch < 10; batch++) {
      await client.execute({
        sql: `INSERT INTO blobs (data) VALUES ${Array.from({ length: 100 }, () => '(?)').join(',')}`,
        args: Array.from({ length: 100 }, () => payload),
      });
    }
    await client.execute(opts?.keepRows ? 'DELETE FROM blobs WHERE id > 100' : 'DELETE FROM blobs');
    // Swap-based reclamation requires all connections closed. Mirror
    // LibSQLStore.close(): exit WAL mode before closing — a closed
    // @libsql/client that never left WAL keeps its shared-memory lock alive
    // in-process, which would (correctly) trip the exclusivity probe.
    await client.execute('PRAGMA wal_checkpoint(TRUNCATE)');
    await client.execute('PRAGMA journal_mode = DELETE');
    client.close();
  }

  it('compacts a local db file via VACUUM INTO + swap and shrinks it after deletes', async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'mc-reclaim-'));
    const dbFile = path.join(dir, 'test.db');
    await seedDb(dbFile, { keepRows: true });

    const starts: Array<{ file: string; bytesBefore: number; liveBytes: number }> = [];
    const results = await reclaimLibSQLDisk([dbFile, path.join(dir, 'missing.db')], (file, bytesBefore, liveBytes) =>
      starts.push({ file, bytesBefore, liveBytes }),
    );

    // Missing files are skipped
    expect(results).toHaveLength(1);
    expect(results[0]!.file).toBe(dbFile);
    expect(results[0]!.bytesAfter).toBeLessThan(results[0]!.bytesBefore);
    expect(statSync(dbFile).size).toBe(results[0]!.bytesAfter);
    expect(starts).toHaveLength(1);
    expect(starts[0]!.liveBytes).toBeGreaterThan(0);
    expect(starts[0]!.liveBytes).toBeLessThan(starts[0]!.bytesBefore);

    // No temp/swap artifacts or stale WAL sidecars left behind
    expect(existsSync(`${dbFile}.vacuum-tmp`)).toBe(false);
    expect(existsSync(`${dbFile}.old`)).toBe(false);
    expect(existsSync(`${dbFile}-wal`)).toBe(false);
    expect(existsSync(`${dbFile}-shm`)).toBe(false);

    // Surviving rows are intact in the compacted file
    const verify = createClient({ url: `file:${dbFile}` });
    const rows = await verify.execute('SELECT COUNT(*) AS n FROM blobs');
    expect(Number(rows.rows[0]!.n)).toBe(100);
    verify.close();
  });

  it('refuses to compact while another connection has the file open', async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'mc-reclaim-busy-'));
    const dbFile = path.join(dir, 'test.db');
    await seedDb(dbFile, { keepRows: true });

    // Simulate another running Mastra Code session holding the db open —
    // LibSQLStore always switches local files to WAL on open, and every open
    // WAL connection holds the shared-memory lock the probe detects.
    // exec(), not pragma()/prepare(): an unfinalized prepared statement pins
    // the libsql connection past close(), which would keep this simulated
    // session "open" forever and break the retry below.
    const otherSession = new Database(dbFile);
    otherSession.exec('PRAGMA journal_mode = WAL');
    otherSession.exec("INSERT INTO blobs (data) VALUES ('other-session')");

    await expect(reclaimLibSQLDisk([dbFile])).rejects.toThrow(/another Mastra Code session/);
    // Source file untouched and no swap artifacts left behind
    expect(existsSync(dbFile)).toBe(true);
    expect(existsSync(`${dbFile}.vacuum-tmp`)).toBe(false);
    expect(existsSync(`${dbFile}.old`)).toBe(false);

    otherSession.close();
    // With the other session gone, compaction proceeds
    const results = await reclaimLibSQLDisk([dbFile]);
    expect(results).toHaveLength(1);
    expect(results[0]!.bytesAfter).toBeLessThan(results[0]!.bytesBefore);
  });

  it('refuses the swap when a session opens the file during compaction (TOCTOU re-probe)', async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'mc-reclaim-toctou-'));
    const dbFile = path.join(dir, 'test.db');
    await seedDb(dbFile, { keepRows: true });

    // onFileStart fires between the exclusivity probe and VACUUM INTO — the
    // window a new session could start in. Simulate one: opening the db in
    // WAL mode flips the file header back, which the pre-swap re-probe must
    // catch (swapping under a live session would orphan its inode).
    const lateSession: InstanceType<typeof Database>[] = [];
    await expect(
      reclaimLibSQLDisk([dbFile], file => {
        const session = new Database(file);
        session.exec('PRAGMA journal_mode = WAL');
        lateSession.push(session);
      }),
    ).rejects.toThrow(/during compaction/);

    // Original file untouched, no swap artifacts left behind
    expect(existsSync(dbFile)).toBe(true);
    expect(existsSync(`${dbFile}.vacuum-tmp`)).toBe(false);
    expect(existsSync(`${dbFile}.old`)).toBe(false);
    for (const session of lateSession) session.close();
  });

  it('restores the original file when the swap fails partway (rollback)', async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'mc-reclaim-rollback-'));
    const dbFile = path.join(dir, 'test.db');
    await seedDb(dbFile, { keepRows: true });

    // Fail the second rename (compacted tmp → db path), after the original
    // was already moved aside — the worst partial-failure point.
    const realRenameSync = realFs.renameSync;
    vi.mocked(fsModule.renameSync).mockImplementation(((from: any, to: any) => {
      if (String(from).endsWith('.vacuum-tmp')) throw new Error('simulated rename failure');
      return realRenameSync(from, to);
    }) as typeof realFs.renameSync);
    try {
      await expect(reclaimLibSQLDisk([dbFile])).rejects.toThrow('simulated rename failure');
    } finally {
      vi.mocked(fsModule.renameSync).mockRestore();
    }

    // The original file is back at the db path — never left empty — and no
    // swap artifacts remain.
    expect(existsSync(dbFile)).toBe(true);
    expect(existsSync(`${dbFile}.old`)).toBe(false);
    expect(existsSync(`${dbFile}.vacuum-tmp`)).toBe(false);
    const verify = createClient({ url: `file:${dbFile}` });
    const rows = await verify.execute('SELECT COUNT(*) AS n FROM blobs');
    expect(Number(rows.rows[0]!.n)).toBe(100);
    await verify.execute('PRAGMA journal_mode = DELETE');
    verify.close();
  });
});

describe('reclaimLibSQLDisk vector-index safety (#23439)', () => {
  let dir: string | undefined;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  /**
   * Seed with the native `libsql` driver (the one the source uses), exec()
   * only, finished before close() — a @libsql/client left in WAL would pin the
   * shm lock in-process and trip the exclusivity probe for the fixture's own
   * reason rather than the behaviour under test.
   *
   * Rows are deleted before closing so the file carries free pages:
   * `freelist_count` is the load-bearing "was it vacuumed" signal.
   */
  function seedVectorDb(dbFile: string) {
    const db = new Database(dbFile);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, body TEXT, embedding F32_BLOB(384))');
    db.exec('CREATE INDEX t_vector_idx ON t (libsql_vector_idx(embedding))');
    const vec = (seed: number) =>
      `vector32('[${Array.from({ length: 384 }, (_, i) => ((seed + i) % 97) / 97).join(',')}]')`;
    for (let i = 0; i < 400; i++) {
      db.exec(`INSERT INTO t (body, embedding) VALUES ('${'y'.repeat(512)}', ${vec(i)})`);
    }
    db.exec('DELETE FROM t WHERE id > 300');
    db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    db.exec('PRAGMA journal_mode = DELETE');
    db.close();
  }

  function seedPlainDb(dbFile: string, opts?: { leaveInWal?: boolean }) {
    const db = new Database(dbFile);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('CREATE TABLE blobs (id INTEGER PRIMARY KEY, data TEXT)');
    db.exec('CREATE INDEX blobs_data_idx ON blobs (data)');
    for (let i = 0; i < 400; i++) db.exec(`INSERT INTO blobs (data) VALUES ('${'x'.repeat(2048)}')`);
    db.exec('DELETE FROM blobs WHERE id > 50');
    db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    if (!opts?.leaveInWal) db.exec('PRAGMA journal_mode = DELETE');
    db.close();
  }

  function inspect(dbFile: string) {
    const db = new Database(dbFile);
    try {
      const num = (p: string) => Number(Object.values((db.pragma(p) as any[])[0])[0]);
      const integrity = String(Object.values((db.pragma('integrity_check') as any[])[0])[0]);
      const rows = Number((db.prepare('SELECT COUNT(*) AS n FROM t').get() as any).n);
      // A corrupted index can throw here rather than return nothing; treat that
      // as "search is broken" so the failure stays a clean assertion.
      let topK = 0;
      try {
        topK = (
          db
            .prepare(`SELECT v.id FROM vector_top_k('t_vector_idx', (SELECT embedding FROM t LIMIT 1), 5) AS v`)
            .all() as unknown[]
        ).length;
      } catch {
        topK = 0;
      }
      return { integrity, rows, topK, pageCount: num('page_count'), freelist: num('freelist_count') };
    } finally {
      db.close();
    }
  }

  it('skips a vector-indexed database instead of vacuuming it', async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'mc-vec-'));
    const dbFile = path.join(dir, 'mastra-vectors.db');
    seedVectorDb(dbFile);
    const before = inspect(dbFile);
    expect(before.freelist).toBeGreaterThan(0);

    const starts: string[] = [];
    const results = await reclaimLibSQLDisk([dbFile], file => starts.push(file));

    // Assert the damage first, so this test's own red output names the defect
    // (`row not in PRIMARY KEY order …`) rather than a missing result marker.
    const after = inspect(dbFile);
    expect(after.integrity).toBe('ok');
    expect(after.topK).toBeGreaterThan(0);
    expect(after.rows).toBe(before.rows);
    // Not byte-identical (the probe flips the journal-mode header bytes), but
    // a vacuum necessarily rewrites pages and reclaims the freelist.
    expect(after.pageCount).toBe(before.pageCount);
    expect(after.freelist).toBe(before.freelist);

    expect(results).toHaveLength(1);
    expect(results[0]!.skipped).toBe('vector-index');
    expect(results[0]!.bytesAfter).toBe(results[0]!.bytesBefore);
    // onFileStart logs "vacuuming <file>…" — never emitted for a skipped file.
    expect(starts).toEqual([]);
    expect(existsSync(`${dbFile}.vacuum-tmp`)).toBe(false);
    expect(existsSync(`${dbFile}.old`)).toBe(false);
  });

  it('still compacts an ordinary database (detection is not over-broad)', async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'mc-vec-plain-'));
    const dbFile = path.join(dir, 'plain.db');
    seedPlainDb(dbFile);

    const results = await reclaimLibSQLDisk([dbFile]);

    expect(results).toHaveLength(1);
    expect(results[0]!.skipped).toBeUndefined();
    expect(results[0]!.bytesAfter).toBeLessThan(results[0]!.bytesBefore);
  });

  it('still compacts an ordinary database left in WAL mode', async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'mc-vec-wal-'));
    const dbFile = path.join(dir, 'plain-wal.db');
    seedPlainDb(dbFile, { leaveInWal: true });

    const results = await reclaimLibSQLDisk([dbFile]);

    expect(results).toHaveLength(1);
    expect(results[0]!.skipped).toBeUndefined();
    expect(results[0]!.bytesAfter).toBeLessThan(results[0]!.bytesBefore);
  });

  it('detects by schema, not filename: a vector index in the MAIN db is skipped', async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'mc-vec-mainbd-'));
    // Deliberately inverted names: the vector index lives in the main db, and
    // the file called "mastra-vectors.db" has none. A filename shortcut fails.
    const mainFile = path.join(dir, 'mastra.db');
    const vectorsNamedFile = path.join(dir, 'mastra-vectors.db');
    seedVectorDb(mainFile);
    seedPlainDb(vectorsNamedFile);

    const results = await reclaimLibSQLDisk([mainFile, vectorsNamedFile]);

    expect(results.find(r => r.file === mainFile)!.skipped).toBe('vector-index');
    expect(results.find(r => r.file === vectorsNamedFile)!.skipped).toBeUndefined();
  });

  it('skips an index written with a space before the parenthesis', async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'mc-vec-space-'));
    const dbFile = path.join(dir, 'spaced.db');
    const db = new Database(dbFile);
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, embedding F32_BLOB(384))');
    // SQLite stores CREATE INDEX SQL verbatim — the space must not slip past.
    db.exec('CREATE INDEX t_vector_idx ON t (libsql_vector_idx (embedding))');
    db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
    db.exec('PRAGMA journal_mode = DELETE');
    db.close();

    const results = await reclaimLibSQLDisk([dbFile]);

    expect(results[0]!.skipped).toBe('vector-index');
  });

  it('skips exactly the vector db and compacts exactly the plain one', async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'mc-vec-mixed-'));
    const vectorFile = path.join(dir, 'vectors.db');
    const plainFile = path.join(dir, 'main.db');
    seedVectorDb(vectorFile);
    seedPlainDb(plainFile);

    const results = await reclaimLibSQLDisk([vectorFile, plainFile]);

    expect(results).toHaveLength(2);
    expect(results.find(r => r.file === vectorFile)!.skipped).toBe('vector-index');
    const plain = results.find(r => r.file === plainFile)!;
    expect(plain.skipped).toBeUndefined();
    expect(plain.bytesAfter).toBeLessThan(plain.bytesBefore);
  });

  it('fails closed when detection itself throws after a successful probe', async () => {
    dir = mkdtempSync(path.join(tmpdir(), 'mc-vec-failclosed-'));
    const dbFile = path.join(dir, 'plain.db');
    seedPlainDb(dbFile);
    const sizeBefore = statSync(dbFile).size;

    // Break only the detection query, on a file that passes the probe.
    const realPrepare = Database.prototype.prepare;
    const spy = vi.spyOn(Database.prototype, 'prepare').mockImplementation(function (
      this: any,
      sql: string,
      ...rest: unknown[]
    ) {
      if (sql.includes('libsql_vector_idx')) throw new Error('simulated detection failure');
      return (realPrepare as any).call(this, sql, ...rest);
    } as any);

    const starts: string[] = [];
    let results;
    try {
      results = await reclaimLibSQLDisk([dbFile], file => starts.push(file));
    } finally {
      spy.mockRestore();
    }

    expect(results).toHaveLength(1);
    expect(results[0]!.skipped).toBe('detection-failed');
    expect(starts).toEqual([]);
    expect(existsSync(`${dbFile}.vacuum-tmp`)).toBe(false);
    expect(existsSync(`${dbFile}.old`)).toBe(false);
    expect(statSync(dbFile).size).toBe(sizeBefore);
  });

  it('reports both skip reasons distinctly in /prune output', async () => {
    const lines: string[] = [];
    await runStorageMaintenance({
      maintenance: {
        backend: 'libsql',
        retention: {},
        prune: vi.fn().mockResolvedValue([]),
        closeStorage: vi.fn().mockResolvedValue(undefined),
        reclaimDisk: vi.fn().mockResolvedValue([
          { file: '/tmp/vectors.db', bytesBefore: 10, bytesAfter: 10, skipped: 'vector-index' },
          { file: '/tmp/odd.db', bytesBefore: 20, bytesAfter: 20, skipped: 'detection-failed' },
        ]),
      },
      vacuum: true,
      log: line => lines.push(line),
    });

    const output = lines.join('\n');
    expect(output).toContain('/tmp/vectors.db: skipped — it contains a vector index');
    expect(output).toContain('/tmp/odd.db: skipped — it could not be inspected');
    expect(output).not.toContain('/tmp/odd.db: skipped — it contains a vector index');
    expect(output).toContain('No database files were compacted;');
    expect(lines).not.toContain('Reclaimed 0 B.');
  });

  it('keeps the totals line truthful when some files compact and some are skipped', async () => {
    const lines: string[] = [];
    await runStorageMaintenance({
      maintenance: {
        backend: 'libsql',
        retention: {},
        prune: vi.fn().mockResolvedValue([]),
        closeStorage: vi.fn().mockResolvedValue(undefined),
        reclaimDisk: vi.fn().mockResolvedValue([
          { file: '/tmp/a.db', bytesBefore: 10, bytesAfter: 10, skipped: 'vector-index' },
          { file: '/tmp/b.db', bytesBefore: 20, bytesAfter: 20, skipped: 'vector-index' },
          { file: '/tmp/main.db', bytesBefore: 2048, bytesAfter: 1024 },
        ]),
      },
      vacuum: true,
      log: line => lines.push(line),
    });

    const output = lines.join('\n');
    // Savings count only the compacted file, and the skips stay visible.
    expect(output).toContain('/tmp/main.db: 2.0 KB → 1.0 KB');
    expect(output).toContain('Reclaimed 1.0 KB; 2 skipped because they contain a vector index.');
  });
});
