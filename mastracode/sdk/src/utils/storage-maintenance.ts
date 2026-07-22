/**
 * Storage maintenance — retention defaults and disk reclamation for mastracode.
 *
 * Retention (`DEFAULT_RETENTION`) is wired into the inner store by the storage
 * factory so `storage.prune()` can delete aged rows across every domain,
 * including the legacy libsql observability spans table.
 *
 * `prune()` only deletes rows — SQLite keeps the freed pages inside the file.
 * `reclaimLibSQLDisk()` returns that space to the OS by streaming a
 * `VACUUM INTO` copy of each file and swapping it into place. It requires all
 * connections to be closed first, so it only runs from the post-TUI
 * maintenance flow. We deliberately do NOT expose VACUUM as a public API on
 * LibSQLStore.
 */

import { closeSync, existsSync, openSync, readSync, renameSync, rmSync, statSync, statfsSync } from 'node:fs';
import { dirname } from 'node:path';

import type { MastraCompositeStore, PruneOptions, PruneResult, RetentionConfig } from '@mastra/core/storage';
// Native `libsql` driver, deliberately alongside `@libsql/client` (used by the
// stores): maintenance needs deterministic connection close for the
// exclusivity probe, and the wrapper's close() can leave the file lock held
// until GC finalizes cached statements. Don't "clean up" either dependency.
// Upstream report: https://github.com/tursodatabase/libsql-js/issues/228
import Database from 'libsql';

import type { StorageConfig } from './project.js';
import { getDatabasePath, getVectorDatabasePath } from './project.js';

/**
 * Default retention for mastracode's own storage. Tables not listed are kept
 * forever. Ages chosen for a local dev tool where observability data dwarfs
 * everything else (spans have been observed at 17+ GB):
 * - spans/logs: short-lived debugging telemetry → 14d
 * - scorer results & workflow snapshots: medium-lived run records → 30d
 * - chat history (messages/threads): long-lived, user-visible → 90d
 */
export const DEFAULT_RETENTION: RetentionConfig = {
  memory: {
    messages: { maxAge: '90d' },
    threads: { maxAge: '90d' },
  },
  observability: {
    spans: { maxAge: '14d' },
    logs: { maxAge: '14d' },
  },
  scores: {
    scorers: { maxAge: '30d' },
  },
  workflows: {
    workflowSnapshot: { maxAge: '30d' },
  },
};

/** Result of reclaiming disk for one database file (sizes include the WAL). */
export interface ReclaimResult {
  file: string;
  bytesBefore: number;
  bytesAfter: number;
}

/** Handle the TUI uses to run storage maintenance without reaching into store internals. */
export interface StorageMaintenance {
  backend: 'libsql' | 'pg';
  /** Retention policies in effect (for display in /prune output). */
  retention: RetentionConfig;
  /** Delete rows older than the retention policies. Safe to re-run; batched and cancellable. `options.retention` replaces the standing policies for this call only. */
  prune: (options?: PruneOptions) => Promise<PruneResult[]>;
  /** Close the long-lived storage connection (checkpoints WAL for local libsql). Nothing can use the store afterwards. */
  closeStorage?: () => Promise<void>;
  /** Compact local libsql files (VACUUM INTO + swap) to return freed pages to the OS. Only set for local libsql backends. */
  reclaimDisk?: (
    onFileStart?: (file: string, bytesBefore: number, liveBytes: number) => void,
  ) => Promise<ReclaimResult[]>;
}

/** db file size + its WAL sidecar, in bytes. Missing files count as 0. */
function fileSizeWithWal(dbFile: string): number {
  let total = 0;
  for (const candidate of [dbFile, `${dbFile}-wal`]) {
    try {
      total += statSync(candidate).size;
    } catch {
      // file may not exist (e.g. WAL already truncated)
    }
  }
  return total;
}

/** Free bytes required before compacting: the compacted copy plus 20% + 256 MB headroom. */
export function requiredFreeBytes(liveBytes: number): number {
  return Math.ceil(liveBytes * 1.2) + 256 * 1024 * 1024;
}

/** First column of the first row of a PRAGMA result, as a number. */
function pragmaNumber(db: InstanceType<typeof Database>, pragma: string): number {
  const rows = db.pragma(pragma) as Array<Record<string, unknown>> | undefined;
  const row = rows?.[0];
  return row ? Number(Object.values(row)[0]) : 0;
}

/**
 * Journal mode straight from the SQLite file header (bytes 18/19:
 * 1 = rollback journal, 2 = WAL) — readable without opening a connection.
 */
function journalModeFromHeader(file: string): 'wal' | 'delete' | 'unknown' {
  const fd = openSync(file, 'r');
  try {
    const buf = Buffer.alloc(2);
    if (readSync(fd, buf, 0, 2, 18) !== 2) return 'unknown';
    if (buf[0] === 2 && buf[1] === 2) return 'wal';
    if (buf[0] === 1 && buf[1] === 1) return 'delete';
    return 'unknown';
  } finally {
    closeSync(fd);
  }
}

/**
 * Compact each local libsql db file by streaming a `VACUUM INTO` copy next to
 * it, then swapping the copy into place. Reports before/after sizes.
 *
 * Deliberately NOT an in-place `VACUUM`: that copies all live content into a
 * temp store (held in memory by libsql builds with `temp_store=MEMORY`) and
 * then rewrites the entire database back through the WAL — on multi-GB
 * databases that has frozen whole machines via memory/IO exhaustion.
 * `VACUUM INTO` reads the logical database once and writes the compacted copy
 * sequentially with bounded memory, and the WAL never grows.
 *
 * Each file is preflighted: live bytes are estimated from
 * `page_count - freelist_count` and the copy is refused unless the volume has
 * `requiredFreeBytes()` available.
 *
 * MUST run with every connection to these files closed (the swap replaces the
 * inode — a surviving connection would keep writing to the unlinked old file).
 * `runStorageMaintenance()` closes storage before calling this.
 */
export async function reclaimLibSQLDisk(
  dbFiles: string[],
  onFileStart?: (file: string, bytesBefore: number, liveBytes: number) => void,
): Promise<ReclaimResult[]> {
  const results: ReclaimResult[] = [];
  for (const file of dbFiles) {
    // Skip missing files and files too small to have a SQLite header — nothing to reclaim
    if (!existsSync(file) || statSync(file).size < 100) continue;
    const bytesBefore = fileSizeWithWal(file);
    const tmp = `${file}.vacuum-tmp`;
    rmSync(tmp, { force: true });
    // Prove we're the only connection before the swap: every open WAL-mode
    // connection (all Mastra Code sessions run WAL) holds a shared-memory
    // lock, so switching WAL -> DELETE only succeeds with exclusive access.
    // A surviving connection would keep writing to the unlinked old inode
    // after the swap and silently lose data.
    //
    // The probe uses exec() only and verifies the outcome from the SQLite
    // file header: prepared statements (including db.pragma()) pin a libsql
    // connection open past close(), so a failed in-connection probe would
    // itself hold the WAL lock and poison every retry in this process.
    // Upstream bug (libsql 0.5.x / @libsql/client 0.17.x): Database.close()
    // does not finalize outstanding statements — they are only finalized by
    // GC, so lock release after close() is nondeterministic. Reported as
    // https://github.com/tursodatabase/libsql-js/issues/228 (fix in flight in
    // PR #214). Once that lands, the header check can become a plain
    // journal_mode query.
    const probe = new Database(file);
    try {
      probe.exec('PRAGMA busy_timeout = 2000');
      // Round-trip through WAL so the probe also works when a clean shutdown
      // already left the file in rollback mode.
      probe.exec('PRAGMA journal_mode = WAL');
      probe.exec('PRAGMA journal_mode = DELETE');
    } catch {
      // busy — the header check below reports the failure
    } finally {
      probe.close();
    }
    if (journalModeFromHeader(file) !== 'delete') {
      throw new Error(
        `${file} is in use by another process — is another Mastra Code session running? ` +
          `Close other sessions and run /prune vacuum again.`,
      );
    }
    // Native `libsql` driver, not `@libsql/client`: the wrapper's close() can
    // leave the file lock held in-process (cached statements), which would
    // block other connections afterwards. This connection stays in rollback
    // mode, so even a pinned statement holds no lock once we're done.
    const db = new Database(file);
    try {
      db.exec('PRAGMA busy_timeout = 2000');
      const pageSize = pragmaNumber(db, 'page_size');
      const pageCount = pragmaNumber(db, 'page_count');
      const freelistCount = pragmaNumber(db, 'freelist_count');
      const liveBytes = Math.max(0, pageCount - freelistCount) * pageSize;
      const { bsize, bavail } = statfsSync(dirname(file));
      const freeBytes = bsize * bavail;
      if (freeBytes < requiredFreeBytes(liveBytes)) {
        throw new Error(
          `Not enough free disk space to compact ${file}: need ${formatBytes(requiredFreeBytes(liveBytes))} ` +
            `for a ${formatBytes(liveBytes)} compacted copy, but only ${formatBytes(freeBytes)} is free.`,
        );
      }
      onFileStart?.(file, bytesBefore, liveBytes);
      db.exec(`VACUUM INTO '${tmp.replace(/'/g, "''")}'`);
    } catch (err) {
      rmSync(tmp, { force: true });
      throw err;
    } finally {
      db.close();
    }
    // Re-probe right before the swap: `VACUUM INTO` can take tens of seconds
    // on multi-GB files, and a session started in that window reopens the db
    // in WAL mode (flipping the header back). Swapping under it would orphan
    // that session's inode and silently lose its writes.
    if (journalModeFromHeader(file) !== 'delete') {
      rmSync(tmp, { force: true });
      throw new Error(
        `${file} was opened by another process during compaction — is another Mastra Code session running? ` +
          `Close other sessions and run /prune vacuum again.`,
      );
    }
    // Swap the compacted copy into place. The old WAL/SHM sidecars belong to
    // the old inode — they must never be paired with the new file. If any step
    // after the first rename fails, restore the original so the db path is
    // never left empty (a naive restart would otherwise create a fresh db).
    renameSync(file, `${file}.old`);
    try {
      rmSync(`${file}-wal`, { force: true });
      rmSync(`${file}-shm`, { force: true });
      renameSync(tmp, file);
    } catch (err) {
      try {
        renameSync(`${file}.old`, file);
      } catch {
        throw new Error(
          `Failed to swap compacted copy into place AND failed to restore the original — ` +
            `your data is intact at ${file}.old; rename it back to ${file} manually. ` +
            `Original error: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      rmSync(tmp, { force: true });
      throw err;
    }
    rmSync(`${file}.old`, { force: true });
    results.push({ file, bytesBefore, bytesAfter: fileSizeWithWal(file) });
  }
  return results;
}

/** `file:/path` or `file:///path` → filesystem path; undefined for non-file urls. */
function fileUrlToPath(url: string): string | undefined {
  if (!url.startsWith('file:')) return undefined;
  return url.replace(/^file:\/\//, '').replace(/^file:/, '');
}

/**
 * Resolve the local libsql db files eligible for checkpoint + VACUUM.
 * Returns [] for remote (turso) urls and PG backends. When PG was requested
 * but the factory fell back to libsql, the fallback uses the default files.
 */
export function resolveLocalDbFiles(config: StorageConfig, effectiveBackend: 'libsql' | 'pg'): string[] {
  if (effectiveBackend !== 'libsql') return [];
  if (config.backend === 'pg') {
    // PG requested but fell back to the default local libsql files
    return [getDatabasePath(), getVectorDatabasePath()];
  }
  if (config.isRemote) return [];
  const files: string[] = [];
  const main = fileUrlToPath(config.url);
  if (main) files.push(main);
  const vector = config.vectorUrl ? fileUrlToPath(config.vectorUrl) : getVectorDatabasePath();
  if (vector) files.push(vector);
  return files;
}

/**
 * Build the maintenance handle for the effective storage backend.
 * `localDbFiles` are the local libsql file paths eligible for VACUUM;
 * pass an empty array for remote (turso) or PG backends.
 */
export function createStorageMaintenance(opts: {
  storage: MastraCompositeStore;
  backend: 'libsql' | 'pg';
  retention: RetentionConfig;
  localDbFiles: string[];
  /** Closes the vector store's connection; required for local libsql so the compaction swap isn't blocked by our own handle. */
  closeVector?: () => Promise<void>;
}): StorageMaintenance {
  const { storage, backend, retention, localDbFiles, closeVector } = opts;
  let closePromise: Promise<void> | undefined;
  return {
    backend,
    retention,
    prune: options => storage.prune(options),
    closeStorage: () => {
      closePromise ??= (async () => {
        const results = await Promise.allSettled([
          Promise.resolve().then(() => storage.close?.()),
          Promise.resolve().then(() => closeVector?.()),
        ]);
        const errors = results
          .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
          .map(result => result.reason);
        if (errors.length === 1) throw errors[0];
        if (errors.length > 1) throw new AggregateError(errors, 'Failed to close Mastra Code storage');
      })();
      return closePromise;
    },
    ...(backend === 'libsql' && localDbFiles.length > 0
      ? {
          reclaimDisk: (onFileStart?: (file: string, bytesBefore: number, liveBytes: number) => void) =>
            reclaimLibSQLDisk(localDbFiles, onFileStart),
        }
      : {}),
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 'B';
  for (const next of units) {
    if (value < 1024) break;
    value /= 1024;
    unit = next;
  }
  return `${value.toFixed(1)} ${unit}`;
}

/** Rows deleted per table per pass: default batchSize (1000) × 20 batches. */
const PASS_MAX_BATCHES = 20;

/**
 * Run storage maintenance with exclusive access to the database, reporting
 * progress through `log` (one line per pass so large deletes are visible).
 *
 * Must run AFTER the TUI is stopped and background writers are quiesced —
 * batched deletes and VACUUM contend with live writes (SQLITE_BUSY) and can
 * starve the event loop that renders the TUI. The storage connection is
 * closed at the end (checkpointing the WAL for local libsql), so the process
 * must exit afterwards.
 */
export async function runStorageMaintenance(opts: {
  maintenance: StorageMaintenance;
  vacuum: boolean;
  /** Skip the memory domain (messages/threads) so chat history is preserved. */
  keepMemory?: boolean;
  log: (line: string) => void;
}): Promise<void> {
  const { maintenance, vacuum, keepMemory = false, log } = opts;

  // keep-memory: prune with the standing policies minus the memory domain,
  // for this run only. The configured retention is untouched.
  const { memory: _memory, ...withoutMemory } = maintenance.retention;
  const retentionForRun = keepMemory ? { retention: withoutMemory } : {};

  log('Pruning rows older than the retention policies:');
  for (const [domain, tables] of Object.entries(maintenance.retention)) {
    for (const [table, policy] of Object.entries(tables ?? {})) {
      const kept = keepMemory && domain === 'memory';
      log(`  ${domain}.${table}: ${kept ? 'kept (keep-memory)' : (policy as { maxAge: string | number }).maxAge}`);
    }
  }

  const totals = new Map<string, number>();
  for (;;) {
    const results = await maintenance.prune({ maxBatches: PASS_MAX_BATCHES, ...retentionForRun });
    if (results.length === 0) break;
    let remaining = false;
    let deletedThisPass = 0;
    for (const r of results) {
      const key = `${r.domain}.${r.table}`;
      totals.set(key, (totals.get(key) ?? 0) + r.deleted);
      deletedThisPass += r.deleted;
      if (!r.done) remaining = true;
      if (r.deleted > 0) {
        log(`  ${key}: ${totals.get(key)} rows deleted${r.done ? '' : ' so far…'}`);
      }
    }
    if (!remaining) break;
    // Safety valve: a table reported more eligible rows but nothing was
    // deleted this pass — bail instead of spinning forever.
    if (deletedThisPass === 0) {
      log('  stopping: no progress in the last pass.');
      break;
    }
  }
  const totalDeleted = [...totals.values()].reduce((sum, n) => sum + n, 0);
  log(
    totalDeleted === 0
      ? 'Nothing to prune — no retention-eligible rows found.'
      : `Prune complete: ${totalDeleted} rows deleted.`,
  );

  // Release the long-lived connection: checkpoints the WAL for local libsql
  // and guarantees VACUUM below isn't blocked by our own open handles.
  await maintenance.closeStorage?.();

  if (!vacuum) {
    if (maintenance.reclaimDisk) {
      log('Deleted rows free pages inside the db file but not on disk. Run /prune vacuum to reclaim disk space.');
    }
    return;
  }

  if (!maintenance.reclaimDisk) {
    log('Disk reclamation (VACUUM) is only available for local libsql storage.');
    return;
  }

  log('Reclaiming disk (compacting database files)… this can take several minutes on large databases.');
  const reclaimed = await maintenance.reclaimDisk((file, bytesBefore, liveBytes) => {
    log(`  vacuuming ${file} (${formatBytes(bytesBefore)}, ~${formatBytes(liveBytes)} live)…`);
  });
  if (reclaimed.length === 0) {
    log('No local database files found to vacuum.');
    return;
  }
  for (const r of reclaimed) {
    log(`  ${r.file}: ${formatBytes(r.bytesBefore)} → ${formatBytes(r.bytesAfter)}`);
  }
  const saved = reclaimed.reduce((sum, r) => sum + Math.max(0, r.bytesBefore - r.bytesAfter), 0);
  log(`Reclaimed ${formatBytes(saved)}.`);
}
