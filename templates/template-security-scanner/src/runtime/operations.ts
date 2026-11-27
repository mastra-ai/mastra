import { createClient } from '@libsql/client';
import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { basename, join } from 'node:path';
import { chmod, copyFile, lstat, mkdir, open, readFile, rename, rm } from 'node:fs/promises';
import { z } from 'zod';
import { ControlPlaneError } from '../core/contracts.js';
import { scanSchema } from '../discovery/contracts.js';
import { DiscoveryStore } from '../discovery/store.js';
import { ScanResources } from '../discovery/resources.js';
import {
  InvestigationStore,
  LEGACY_OWNED_RESOURCE_SQL,
  CURRENT_OWNED_RESOURCE_SQL,
  CURRENT_OWNED_RESOURCE_POINTER_SQL,
  type Approval,
  type Hypothesis,
  type Investigation,
  type Job,
} from '../investigation/store.js';
import type { Settings } from '../config/settings.js';
import { acquireInstance } from '../discovery/instance.js';
import { prepareDataDirectory } from './files.js';
import { inspectStorageFiles } from './storage-files.js';

const compatibility = 'security-scanner-storage-v1';
const maximumFileBytes = 512 * 1024 * 1024;
const safeName = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/);
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const snapshotSchema = z
  .object({
    /** SHA-256 of this database snapshot. */
    sha256: hash,
    /** Snapshot file size in bytes. */
    bytes: z.number().int().min(1).max(maximumFileBytes),
    /** Fingerprint of the database schema. */
    schemaHash: hash,
  })
  .strict();
const manifestSchema = z
  .object({
    /** Backup-manifest format version. */
    version: z.literal(1),
    /** Storage compatibility identifier required by restore. */
    compatibility: z.literal(compatibility),
    /** UTC timestamp when the compatible pair was captured. */
    createdAt: z.iso.datetime(),
    /** Required scanner application schema version. */
    applicationSchema: z.union([z.literal(3), z.literal(4)]),
    /** Installed Mastra core version bound to this pair. */
    coreVersion: z.string().max(80),
    /** Installed Mastra libSQL adapter version bound to this pair. */
    libsqlVersion: z.string().max(80),
    /** Application database snapshot integrity metadata. */
    application: snapshotSchema,
    /** Native Mastra database snapshot integrity metadata. */
    native: snapshotSchema,
  })
  .strict();
const journalSchema = z
  .object({
    /** Restoration-journal format version. */
    version: z.literal(1),
    /** Last durably recorded replacement stage. */
    stage: z.enum(['PREPARED', 'APPLICATION_SWAPPED', 'BOTH_SWAPPED']),
    /** Owned staging directory identifier under data/restore/. */
    directory: z.string().uuid(),
    /** Application database basename to restore. */
    application: z.string().regex(/^[A-Za-z0-9_-]+\.db$/),
    /** Native Mastra database basename to restore. */
    native: z.string().regex(/^[A-Za-z0-9_-]+-mastra\.db$/),
    /** SHA-256 of the retained previous application snapshot. */
    previousApplication: hash,
    /** SHA-256 of the retained previous native snapshot. */
    previousNative: hash,
  })
  .strict();
/** Durable two-file restoration stage recorded before and between replacements. */
export type RestoreStage = z.infer<typeof journalSchema>['stage'];

/** Create or validate a private operational directory without accepting unsafe existing paths. */
async function privateDirectory(path: string) {
  await mkdir(path, { mode: 0o700 }).catch(error => {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  });
  const stat = await lstat(path);
  if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== process.getuid?.() || (stat.mode & 0o777) !== 0o700)
    throw new ControlPlaneError('OPERATION_DIRECTORY_UNSAFE', 503);
}
/** Validate ownership, permissions, type and size before reading an operational file. */
async function ownedFile(path: string, maximum = maximumFileBytes) {
  const stat = await lstat(path);
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    stat.uid !== process.getuid?.() ||
    (stat.mode & 0o777) !== 0o600 ||
    stat.size > maximum
  )
    throw new ControlPlaneError('OPERATION_FILE_UNSAFE', 503);
  return stat;
}
async function bytes(path: string, maximum = maximumFileBytes) {
  await ownedFile(path, maximum);
  return readFile(path);
}
const digest = (value: Buffer | string) => createHash('sha256').update(value).digest('hex');
async function atomicJson(path: string, value: unknown) {
  const temporary = `${path}.${randomUUID()}`;
  const file = await open(temporary, 'wx', 0o600);
  try {
    await file.writeFile(JSON.stringify(value));
    await file.sync();
  } finally {
    await file.close();
  }
  await rename(temporary, path);
}
async function copyPrivate(source: string, destination: string) {
  await ownedFile(source);
  await copyFile(source, destination, constants.COPYFILE_EXCL);
  await chmod(destination, 0o600);
  const file = await open(destination, 'r');
  try {
    await file.sync();
  } finally {
    await file.close();
  }
}
async function replacePrivate(source: string, destination: string) {
  const temporary = `${destination}.${randomUUID()}`;
  try {
    await copyPrivate(source, temporary);
    await rename(temporary, destination);
  } finally {
    await rm(temporary, { force: true });
  }
}
/** Check a private SQLite file for structural integrity before operational use. */
async function inspectDatabase(path: string) {
  await ownedFile(path);
  const client = createClient({ url: `file:${path}` });
  try {
    const integrity = await client.execute('PRAGMA quick_check');
    if (integrity.rows.length !== 1 || Object.values(integrity.rows[0]!)[0] !== 'ok')
      throw new ControlPlaneError('BACKUP_DATABASE_INVALID', 409);
    const schema = await client.execute(
      "SELECT name,type,sql FROM sqlite_master WHERE name NOT GLOB 'sqlite_*' ORDER BY type,name",
    );
    if (schema.rows.length > 256) throw new ControlPlaneError('BACKUP_SCHEMA_BOUND', 409);
    return digest(JSON.stringify(schema.rows));
  } finally {
    client.close();
  }
}
const applicationTables: Record<string, Record<string, string>> = {
  scanner_migrations: { version: 'INTEGER' },
  scanner_records: { kind: 'TEXT', id: 'TEXT', owner: 'TEXT', revision: 'INTEGER', data: 'TEXT' },
  scanner_credentials: { profile_id: 'TEXT', envelope: 'TEXT' },
  scanner_discovery_scans: {
    id: 'TEXT',
    job_id: 'TEXT',
    target_id: 'TEXT',
    owner: 'TEXT',
    idempotency_key: 'TEXT',
    request_hash: 'TEXT',
    active: 'INTEGER',
    data: 'TEXT',
  },
  scanner_discovery_evidence: { id: 'TEXT', scan_id: 'TEXT', owner: 'TEXT', expires_at: 'TEXT', data: 'TEXT' },
  scanner_verification_jobs: {
    id: 'TEXT',
    investigation_id: 'TEXT',
    hypothesis_id: 'TEXT',
    target_id: 'TEXT',
    owner: 'TEXT',
    state: 'TEXT',
    fence: 'INTEGER',
    lease_until: 'TEXT',
    data: 'TEXT',
  },
  scanner_verification_proofs: { id: 'TEXT', job_id: 'TEXT', investigation_id: 'TEXT', owner: 'TEXT', data: 'TEXT' },
  scanner_proof_sources: { evidence_id: 'TEXT', proof_id: 'TEXT', owner: 'TEXT' },
  scanner_approvals: {
    id: 'TEXT',
    job_id: 'TEXT',
    investigation_id: 'TEXT',
    owner: 'TEXT',
    decision: 'TEXT',
    revision: 'INTEGER',
    data: 'TEXT',
  },
  scanner_advisory_schedule: { singleton: 'INTEGER', data: 'TEXT' },
  scanner_owned_resources: {
    id: 'TEXT',
    owner: 'TEXT',
    target_id: 'TEXT',
    category: 'TEXT',
    path: 'TEXT',
    data: 'TEXT',
  },
};
// Restore compares exact schema fingerprints; the only supported historical
// projection is the known schema3 resource table before immutable renewal.
/** Verify the supported application schema, including the requested legacy projection. */
async function applicationSchema(path: string, version: 3 | 4, legacyProjection = false) {
  await inspectDatabase(path);
  const client = createClient({ url: `file:${path}` });
  try {
    const migrations = await client.execute('SELECT version FROM scanner_migrations ORDER BY version');
    if (
      JSON.stringify(migrations.rows.map(row => Number(row.version))) !==
      JSON.stringify(version === 3 ? [1, 2, 3] : [1, 2, 3, 4])
    )
      throw new ControlPlaneError('BACKUP_APPLICATION_SCHEMA_INCOMPATIBLE', 409);
    for (const [table, expected] of Object.entries(applicationTables)) {
      const columns = await client.execute(`PRAGMA table_info(${table})`);
      const actual = Object.fromEntries(columns.rows.map(row => [String(row.name), String(row.type).toUpperCase()]));
      if (
        Object.keys(actual).length !== Object.keys(expected).length ||
        Object.entries(expected).some(([name, type]) => actual[name] !== type)
      )
        throw new ControlPlaneError('BACKUP_APPLICATION_SCHEMA_INCOMPATIBLE', 409);
    }
    const schema = await client.execute(
      "SELECT name,type,sql FROM sqlite_master WHERE name NOT GLOB 'sqlite_*' AND name!='scanner_operation_cleanup_cursor' ORDER BY type,name",
    );
    if (schema.rows.some(row => row.type === 'trigger'))
      throw new ControlPlaneError('BACKUP_APPLICATION_SCHEMA_INCOMPATIBLE', 409);
    const resource = schema.rows.find(row => row.name === 'scanner_owned_resources');
    const current = schema.rows.find(row => row.name === 'scanner_current_owned_resources');
    if (version === 3 && (resource?.sql !== LEGACY_OWNED_RESOURCE_SQL || current))
      throw new ControlPlaneError('BACKUP_APPLICATION_SCHEMA_INCOMPATIBLE', 409);
    if (version === 4) {
      if (resource?.sql !== CURRENT_OWNED_RESOURCE_SQL || current?.sql !== CURRENT_OWNED_RESOURCE_POINTER_SQL)
        throw new ControlPlaneError('BACKUP_APPLICATION_SCHEMA_INCOMPATIBLE', 409);
      const columns = await client.execute('PRAGMA table_info(scanner_current_owned_resources)');
      if (
        JSON.stringify(columns.rows.map(row => [row.name, row.type])) !==
        JSON.stringify([
          ['owner', 'TEXT'],
          ['target_id', 'TEXT'],
          ['category', 'TEXT'],
          ['path', 'TEXT'],
          ['resource_id', 'TEXT'],
        ])
      )
        throw new ControlPlaneError('BACKUP_APPLICATION_SCHEMA_INCOMPATIBLE', 409);
    }
    const rows = legacyProjection
      ? schema.rows
          .filter(row => row.name !== 'scanner_current_owned_resources')
          .map(row => (row.name === 'scanner_owned_resources' ? { ...row, sql: LEGACY_OWNED_RESOURCE_SQL } : row))
      : schema.rows;
    return digest(JSON.stringify(rows));
  } finally {
    client.close();
  }
}
/** Read the application migration version and reject unsupported database generations. */
async function applicationVersion(path: string): Promise<3 | 4> {
  const db = createClient({ url: `file:${path}` });
  try {
    const rows = await db.execute('SELECT MAX(version) AS version FROM scanner_migrations');
    const version = Number(rows.rows[0]?.version);
    if (version !== 3 && version !== 4) throw new ControlPlaneError('BACKUP_APPLICATION_SCHEMA_INCOMPATIBLE', 409);
    await applicationSchema(path, version);
    return version;
  } finally {
    db.close();
  }
}
/** Migrate a compatible application database copy without modifying the original backup. */
async function upgradeApplicationCopy(path: string) {
  const version = await applicationVersion(path);
  if (version === 3) {
    const store = new InvestigationStore(`file:${path}`);
    try {
      await store.initialize();
    } finally {
      await store.close();
    }
  }
  return applicationSchema(path, 4);
}
async function snapshot(source: string, destination: string) {
  await ownedFile(source);
  const file = await open(destination, 'wx', 0o600);
  await file.close();
  const client = createClient({ url: `file:${source}` });
  try {
    await client.execute({ sql: 'VACUUM INTO ?', args: [destination] });
  } finally {
    client.close();
  }
  await chmod(destination, 0o600);
  const content = await bytes(destination);
  return { sha256: digest(content), bytes: content.length, schemaHash: await inspectDatabase(destination) };
}
/** Checkpoint both drained databases before removing their safe, owned sidecar files. */
async function checkpointAndClearSidecars(settings: Settings) {
  for (const path of [settings.databasePath, settings.mastraDatabasePath]) {
    const client = createClient({ url: `file:${path}` });
    try {
      const result = await client.execute('PRAGMA wal_checkpoint(TRUNCATE)');
      if (Number(Object.values(result.rows[0] ?? {})[0]) !== 0)
        throw new ControlPlaneError('OPERATION_DATABASE_BUSY', 409);
    } finally {
      client.close();
    }
    for (const suffix of ['-wal', '-shm']) {
      const sidecar = path + suffix;
      try {
        await ownedFile(sidecar);
        await rm(sidecar);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
  }
}
async function versions() {
  const read = async (name: string) =>
    JSON.parse(await readFile(new URL(`../../node_modules/@mastra/${name}/package.json`, import.meta.url), 'utf8')) as {
      version: string;
    };
  return { coreVersion: (await read('core')).version, libsqlVersion: (await read('libsql')).version };
}
/** Reject maintenance while persisted work still requires active runtime ownership. */
async function assertDrained(settings: Settings) {
  const client = createClient({ url: settings.databaseUrl });
  try {
    const scans = await client.execute(
      "SELECT 1 FROM scanner_discovery_scans WHERE active=1 OR json_extract(data,'$.cleanup')='DEBT' LIMIT 1",
    );
    const jobs = await client.execute(
      "SELECT 1 FROM scanner_verification_jobs WHERE state IN ('QUEUED','LEASED','AWAITING_APPROVAL') LIMIT 1",
    );
    const planning = await client.execute(
      "SELECT 1 FROM scanner_investigations WHERE state IN ('QUEUED','PLANNING','RUNNING','AWAITING_APPROVAL') LIMIT 1",
    );
    const schema = await client.execute('SELECT MAX(version) AS version FROM scanner_migrations');
    if (![3, 4].includes(Number(schema.rows[0]?.version)))
      throw new ControlPlaneError('BACKUP_SCHEMA_INCOMPATIBLE', 409);
    if (scans.rows.length || jobs.rows.length || planning.rows.length)
      throw new ControlPlaneError('OPERATION_DRAIN_REQUIRED', 409);
  } finally {
    client.close();
  }
}
async function status(settings: Settings, state: string, detail: string | null = null) {
  await atomicJson(join(settings.dataDirectory, 'operation-status.json'), {
    state,
    detail,
    at: new Date().toISOString(),
  });
}
/** Inspect local maintenance readiness, recovery state and owned runtime resources. */
export async function operationStatus(settings: Settings) {
  try {
    const path = join(settings.dataDirectory, 'owned-lab-runtime.json');
    const lab = z
      .object({ phase: z.enum(['PREPARING', 'RUNNING', 'DEBT']), pid: z.number().int().positive() })
      .passthrough()
      .parse(JSON.parse((await bytes(path, 8192)).toString()));
    let reason: string | null = lab.phase === 'DEBT' ? 'OWNED_LAB_CLEANUP_DEBT' : null;
    try {
      process.kill(lab.pid, 0);
    } catch (error) {
      reason =
        (error as NodeJS.ErrnoException).code === 'ESRCH'
          ? 'OWNED_LAB_PROCESS_INTERRUPTED'
          : 'OWNED_LAB_INSTANCE_UNVERIFIED';
    }
    if (reason) return { state: 'DEBT', detail: reason, at: (await lstat(path)).mtime.toISOString() };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  try {
    return JSON.parse((await bytes(join(settings.dataDirectory, 'operation-status.json'), 8192)).toString()) as {
      state: string;
      detail: string | null;
      at: string;
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { state: 'NOT_PERFORMED', detail: null, at: null };
    throw error;
  }
}

// The server and offline commands call this only while holding the instance
// fence, before opening either live database. Recovery restores the prior pair.
/** Recover an interrupted two-file restore from its validated durable journal. */
export async function recoverInterruptedRestore(settings: Settings) {
  const journalPath = join(settings.dataDirectory, 'restore-journal.json');
  let journal: z.infer<typeof journalSchema>;
  try {
    journal = journalSchema.parse(JSON.parse((await bytes(journalPath, 8192)).toString()));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw new ControlPlaneError('RESTORE_JOURNAL_INVALID', 503);
  }
  if (
    journal.application !== basename(settings.databasePath) ||
    journal.native !== basename(settings.mastraDatabasePath)
  )
    throw new ControlPlaneError('RESTORE_PAIR_MISMATCH', 503);
  const directory = join(settings.dataDirectory, 'restore', journal.directory);
  await privateDirectory(join(settings.dataDirectory, 'restore'));
  await privateDirectory(directory);
  const previousApplication = join(directory, 'application.previous'),
    previousNative = join(directory, 'native.previous');
  try {
    if (
      digest(await bytes(previousApplication)) !== journal.previousApplication ||
      digest(await bytes(previousNative)) !== journal.previousNative
    )
      throw new ControlPlaneError('RESTORE_RECOVERY_HASH_MISMATCH', 503);
    await inspectDatabase(previousApplication);
    await inspectDatabase(previousNative);
    await checkpointAndClearSidecars(settings);
    await replacePrivate(previousApplication, settings.databasePath);
    await replacePrivate(previousNative, settings.mastraDatabasePath);
    await status(settings, 'RECOVERED_PREVIOUS_PAIR', 'INTERRUPTED_RESTORE');
    await rm(journalPath);
    await rm(directory, { recursive: true });
    return true;
  } catch {
    await status(settings, 'DEBT', 'RESTORE_RECOVERY_FAILED');
    throw new ControlPlaneError('RESTORE_RECOVERY_FAILED', 503);
  }
}
async function offline<T>(settings: Settings, operation: () => Promise<T>) {
  await prepareDataDirectory(settings);
  const release = await acquireInstance(settings);
  try {
    await recoverInterruptedRestore(settings);
    return await operation();
  } finally {
    await release();
  }
}

export async function drainOffline(settings: Settings) {
  return offline(settings, () => drainWithInstanceHeld(settings));
}
// Internal recovery entry point; callers must already own the instance fence.
/** Drain scanner work while retaining the instance fence throughout maintenance. */
export async function drainWithInstanceHeld(
  settings: Settings,
  cause: 'OPERATOR_DRAIN' | 'PROCESS_INTERRUPTED' = 'OPERATOR_DRAIN',
) {
  const store = new DiscoveryStore(settings.databaseUrl),
    db = createClient({ url: settings.databaseUrl });
  let complete = true;
  try {
    await store.initialize();
    // Limit work per operator invocation; an unfinished drain remains visible.
    const resources = await db.execute(
      "SELECT DISTINCT scan_id FROM scanner_discovery_resources WHERE json_extract(data,'$.kind')!='image' LIMIT 128",
    );
    for (const row of resources.rows)
      complete = (await new ScanResources(settings, store, String(row.scan_id)).cleanup()) && complete;
    await db.execute(
      'CREATE TABLE IF NOT EXISTS scanner_operation_cleanup_cursor (singleton INTEGER PRIMARY KEY CHECK(singleton=1),last_rowid INTEGER NOT NULL)',
    );
    const cursor = await db.execute('SELECT last_rowid FROM scanner_operation_cleanup_cursor WHERE singleton=1');
    let imageRows = await db.execute({
      sql: "SELECT rowid,scan_id FROM scanner_discovery_resources WHERE json_extract(data,'$.kind')='image' AND rowid>? ORDER BY rowid LIMIT 128",
      args: [Number(cursor.rows[0]?.last_rowid ?? 0)],
    });
    if (!imageRows.rows.length)
      imageRows = await db.execute(
        "SELECT rowid,scan_id FROM scanner_discovery_resources WHERE json_extract(data,'$.kind')='image' ORDER BY rowid LIMIT 128",
      );
    for (const id of new Set(imageRows.rows.map(row => String(row.scan_id))))
      complete = (await new ScanResources(settings, store, id).cleanup()) && complete;
    await db.execute({
      sql: 'INSERT INTO scanner_operation_cleanup_cursor(singleton,last_rowid) VALUES (1,?) ON CONFLICT(singleton) DO UPDATE SET last_rowid=excluded.last_rowid',
      args: [Number(imageRows.rows.at(-1)?.rowid ?? 0)],
    });
    const scans = await db.execute(
      "SELECT data FROM scanner_discovery_scans WHERE active=1 OR json_extract(data,'$.cleanup')='DEBT' LIMIT 128",
    );
    for (const row of scans.rows) {
      const scan = scanSchema.parse(JSON.parse(String(row.data)));
      const clean = await new ScanResources(settings, store, scan.id).cleanup();
      complete &&= clean;
      await store.update(scan.id, scan.owner, current => ({
        ...current,
        state: ['COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED', 'CANCELLED', 'AUTH_REQUIRED'].includes(current.state)
          ? current.state
          : cause === 'PROCESS_INTERRUPTED'
            ? 'FAILED'
            : 'CANCELLED',
        reason: clean
          ? cause === 'PROCESS_INTERRUPTED'
            ? 'PROCESS_INTERRUPTED'
            : 'CANCELLED_BY_OPERATOR'
          : 'CLEANUP_FAILED',
        budget: { remainingRequests: null, remainingBytes: null, exhausted: true, reason: 'unknown' },
        partial: true,
        cleanup: clean ? 'COMPLETE' : 'DEBT',
      }));
    }
    const tx = await db.transaction('write');
    try {
      const jobs = await tx.execute(
        "SELECT data FROM scanner_verification_jobs WHERE state IN ('QUEUED','LEASED','AWAITING_APPROVAL') LIMIT 128",
      );
      const investigations = new Set<string>();
      const uncertain = new Set<string>();
      const pending = await tx.execute(
        "SELECT id FROM scanner_investigations WHERE state IN ('QUEUED','PLANNING','RUNNING','AWAITING_APPROVAL') LIMIT 128",
      );
      for (const row of pending.rows) investigations.add(String(row.id));
      for (const row of jobs.rows) {
        const job = JSON.parse(String(row.data)) as Job;
        investigations.add(job.investigationId);
        const hypotheses = await tx.execute({
          sql: 'SELECT data FROM scanner_hypotheses WHERE id=?',
          args: [job.hypothesisId],
        });
        const hypothesis = hypotheses.rows[0] ? (JSON.parse(String(hypotheses.rows[0].data)) as Hypothesis) : null;
        const activeUnknown = job.state === 'LEASED' && hypothesis?.risk === 'active';
        if (activeUnknown) uncertain.add(job.investigationId);
        const reason = activeUnknown
          ? 'ACTIVE_PROBE_OUTCOME_UNKNOWN'
          : job.state === 'LEASED'
            ? 'PROCESS_INTERRUPTED'
            : cause;
        const next = {
          ...job,
          state: activeUnknown ? 'DEAD' : 'CANCELLED',
          fence: job.fence + 1,
          leaseUntil: null,
          updatedAt: new Date().toISOString(),
          result:
            job.state === 'LEASED'
              ? { outcome: 'EXECUTION_ERROR', evidenceIds: [], reason, modelId: null, usageTokens: null }
              : job.result,
        };
        await tx.execute({
          sql: 'UPDATE scanner_verification_jobs SET state=?,fence=?,lease_until=NULL,data=? WHERE id=?',
          args: [next.state, next.fence, JSON.stringify(next), job.id],
        });
        if (hypothesis) {
          const state = activeUnknown ? 'BLOCKED' : 'CANCELLED';
          await tx.execute({
            sql: 'UPDATE scanner_hypotheses SET state=?,data=? WHERE id=?',
            args: [state, JSON.stringify({ ...hypothesis, state, reason }), hypothesis.id],
          });
        }
        const approvals = await tx.execute({
          sql: 'SELECT data FROM scanner_approvals WHERE job_id=?',
          args: [job.id],
        });
        for (const approvalRow of approvals.rows) {
          const approval = JSON.parse(String(approvalRow.data)) as Approval;
          await tx.execute({
            sql: "UPDATE scanner_approvals SET decision='expired',revision=?,data=? WHERE id=?",
            args: [
              approval.revision + 1,
              JSON.stringify({ ...approval, decision: 'expired', revision: approval.revision + 1 }),
              approval.id,
            ],
          });
        }
      }
      for (const id of investigations) {
        const row = await tx.execute({ sql: 'SELECT data FROM scanner_investigations WHERE id=?', args: [id] });
        const investigation = JSON.parse(String(row.rows[0]!.data)) as Investigation;
        const next = {
          ...investigation,
          state: uncertain.has(id) ? 'BLOCKED' : 'CANCELLED',
          reason: uncertain.has(id) ? 'ACTIVE_PROBE_OUTCOME_UNKNOWN' : cause,
          revision: investigation.revision + 1,
          updatedAt: new Date().toISOString(),
        };
        await tx.execute({
          sql: 'UPDATE scanner_investigations SET state=?,revision=?,data=? WHERE id=?',
          args: [next.state, next.revision, JSON.stringify(next), id],
        });
      }
      await tx.commit();
    } catch (error) {
      await tx.rollback();
      throw error;
    } finally {
      tx.close();
    }
    await assertDrained(settings).catch(() => {
      complete = false;
    });
    const remaining = await store.resourceSummary();
    if ((remaining.container ?? 0) > 0 || (remaining.network ?? 0) > 0) complete = false;
    const sharedImages = remaining.image ?? 0;
    await status(
      settings,
      complete ? 'DRAINED' : 'DEBT',
      complete ? (sharedImages ? 'SHARED_IMAGES_WAITING' : null) : 'DRAIN_INCOMPLETE',
    );
    if (!complete) throw new ControlPlaneError('OPERATION_DRAIN_INCOMPLETE', 503);
    return { state: 'DRAINED', imageRecordsPending: sharedImages };
  } finally {
    db.close();
    await store.close();
  }
}
export async function createBackup(settings: Settings, name: string) {
  safeName.parse(name);
  return offline(settings, async () => {
    if ((await inspectStorageFiles(settings)).status !== 'ready')
      throw new ControlPlaneError('BACKUP_STORAGE_UNAVAILABLE', 409);
    await assertDrained(settings);
    const folder = join(settings.dataDirectory, 'backups');
    await privateDirectory(folder);
    const directory = join(folder, name);
    await mkdir(directory, { mode: 0o700 });
    try {
      const application = await snapshot(settings.databasePath, join(directory, 'application.db'));
      application.schemaHash = await upgradeApplicationCopy(join(directory, 'application.db'));
      const upgraded = await bytes(join(directory, 'application.db'));
      application.sha256 = digest(upgraded);
      application.bytes = upgraded.length;
      const native = await snapshot(settings.mastraDatabasePath, join(directory, 'native.db'));
      const manifest = manifestSchema.parse({
        version: 1,
        compatibility,
        createdAt: new Date().toISOString(),
        applicationSchema: 4,
        ...(await versions()),
        application,
        native,
      });
      await atomicJson(join(directory, 'manifest.json'), manifest);
      await status(settings, 'BACKUP_COMPLETE', name);
      return manifest;
    } catch (error) {
      await rm(directory, { recursive: true, force: true });
      throw error;
    }
  });
}
async function invalidateRestoredApprovals(path: string) {
  const db = createClient({ url: `file:${path}` });
  try {
    await db.execute(
      "UPDATE scanner_approvals SET decision='expired',revision=revision+1,data=json_set(data,'$.decision','expired','$.revision',revision+1) WHERE decision IN ('pending','approved')",
    );
    await db.execute(
      "UPDATE scanner_recurrences SET enabled=0,revision=revision+1,data=json_set(data,'$.enabled',json('false'),'$.revision',revision+1)",
    );
    await db.execute("UPDATE scanner_recurrence_events SET state='CANCELLED' WHERE state='PENDING'");
    await db.execute("UPDATE scanner_advisory_reassessment_events SET state='CANCELLED' WHERE state='PENDING'");
    await db.execute(
      "UPDATE scanner_advisory_schedule SET data=json_set(data,'$.paused',json('true'),'$.revision',json_extract(data,'$.revision')+1) WHERE singleton=1",
    );
  } finally {
    db.close();
  }
}
export async function restoreBackup(
  settings: Settings,
  name: string,
  onStage: (stage: RestoreStage) => Promise<void> = async () => {},
) {
  safeName.parse(name);
  return offline(settings, async () => {
    await assertDrained(settings);
    await privateDirectory(join(settings.dataDirectory, 'backups'));
    const directory = join(settings.dataDirectory, 'backups', name);
    await privateDirectory(directory);
    const manifest = manifestSchema.parse(
      JSON.parse((await bytes(join(directory, 'manifest.json'), 16384)).toString()),
    );
    const current = await versions();
    if (manifest.coreVersion !== current.coreVersion || manifest.libsqlVersion !== current.libsqlVersion)
      throw new ControlPlaneError('BACKUP_CODE_INCOMPATIBLE', 409);
    for (const [name, record] of [
      ['application', manifest.application],
      ['native', manifest.native],
    ] as const) {
      const file = join(directory, `${name}.db`),
        content = await bytes(file);
      if (
        content.length !== record.bytes ||
        digest(content) !== record.sha256 ||
        (await (name === 'application'
          ? applicationSchema(file, manifest.applicationSchema)
          : inspectDatabase(file))) !== record.schemaHash
      )
        throw new ControlPlaneError('BACKUP_HASH_MISMATCH', 409);
    }
    const stageRoot = join(settings.dataDirectory, 'restore');
    await privateDirectory(stageRoot);
    const id = randomUUID(),
      staging = join(stageRoot, id);
    await mkdir(staging, { mode: 0o700 });
    const journalPath = join(settings.dataDirectory, 'restore-journal.json');
    let prepared = false;
    try {
      const previousApplication = await snapshot(settings.databasePath, join(staging, 'application.previous'));
      const previousNative = await snapshot(settings.mastraDatabasePath, join(staging, 'native.previous'));
      // Derive both supported contracts from a private copy of the live pair.
      // Neither the original backup nor a live schema3 database is upgraded here.
      await copyPrivate(join(staging, 'application.previous'), join(staging, 'application.expected'));
      const expected = await upgradeApplicationCopy(join(staging, 'application.expected'));
      const expectedBackup =
        manifest.applicationSchema === 3
          ? await applicationSchema(join(staging, 'application.expected'), 4, true)
          : expected;
      if (manifest.application.schemaHash !== expectedBackup)
        throw new ControlPlaneError('BACKUP_APPLICATION_SCHEMA_INCOMPATIBLE', 409);
      await copyPrivate(join(directory, 'application.db'), join(staging, 'application.next'));
      await copyPrivate(join(directory, 'native.db'), join(staging, 'native.next'));
      if ((await upgradeApplicationCopy(join(staging, 'application.next'))) !== expected)
        throw new ControlPlaneError('BACKUP_APPLICATION_SCHEMA_INCOMPATIBLE', 409);
      await invalidateRestoredApprovals(join(staging, 'application.next'));
      // A valid old WAL belongs to the previous inode and must never be
      // replayed over a replacement database. Checkpoint under the offline
      // fence, reject busy readers, then clear only these owned sidecars.
      await checkpointAndClearSidecars(settings);
      const journal = {
        version: 1 as const,
        stage: 'PREPARED' as RestoreStage,
        directory: id,
        application: basename(settings.databasePath),
        native: basename(settings.mastraDatabasePath),
        previousApplication: previousApplication.sha256,
        previousNative: previousNative.sha256,
      };
      await atomicJson(journalPath, journal);
      prepared = true;
      await onStage('PREPARED');
      await rename(join(staging, 'application.next'), settings.databasePath);
      journal.stage = 'APPLICATION_SWAPPED';
      await atomicJson(journalPath, journal);
      await onStage(journal.stage);
      await rename(join(staging, 'native.next'), settings.mastraDatabasePath);
      journal.stage = 'BOTH_SWAPPED';
      await atomicJson(journalPath, journal);
      await onStage(journal.stage);
      await status(settings, 'RESTORED', name);
      await rm(journalPath);
      await rm(staging, { recursive: true });
      return { state: 'RESTORED', schedulesPaused: true, approvalsInvalidated: true };
    } catch (error) {
      if (prepared) await recoverInterruptedRestore(settings);
      else await rm(staging, { recursive: true, force: true });
      await status(settings, 'RESTORE_REJECTED', error instanceof ControlPlaneError ? error.code : 'RESTORE_FAILED');
      throw error;
    }
  });
}
