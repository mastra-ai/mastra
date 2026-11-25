import { createClient } from '@libsql/client';
import { constants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';
import { RuntimeDiagnostic, type Settings } from '../config/settings.js';
import { prepareDataDirectory } from './files.js';

type FileKind = 'application' | 'native' | 'sidecar';

/** Select the diagnostic code for an unsafe domain, native or sidecar storage path. */
const code = (kind: FileKind) =>
  kind === 'native' ? 'UNSAFE_MASTRA_DATABASE' : kind === 'sidecar' ? 'UNSAFE_DATABASE_SIDECAR' : 'UNSAFE_DATABASE';

function unsafe(kind: FileKind): never {
  throw new RuntimeDiagnostic(code(kind), `Use an owned regular ${kind} database file inside private data/.`);
}

/** Validate an existing storage path's type, ownership and optional private permissions. */
async function checkExisting(path: string, kind: FileKind, strictMode = true): Promise<boolean> {
  let stat;
  try {
    stat = await lstat(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    return unsafe(kind);
  }
  if (
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    stat.uid !== process.getuid?.() ||
    (strictMode && kind !== 'sidecar' && (stat.mode & 0o777) !== 0o600)
  )
    unsafe(kind);
  return true;
}

/** Create a private storage file without following unsafe pre-existing entries. */
async function ensureOwnedFile(path: string, kind: FileKind) {
  let file;
  try {
    file = await open(path, constants.O_CREAT | constants.O_RDWR | constants.O_NOFOLLOW, 0o600);
    const stat = await file.stat();
    if (!stat.isFile() || stat.uid !== process.getuid?.()) unsafe(kind);
    await file.chmod(0o600);
  } catch (error) {
    if (error instanceof RuntimeDiagnostic) throw error;
    unsafe(kind);
  } finally {
    await file?.close();
  }
}

/** Validate SQLite sidecars for both domain and native Mastra databases. */
async function checkSidecars(settings: Settings) {
  for (const path of [settings.databasePath, settings.mastraDatabasePath]) {
    for (const suffix of ['-wal', '-shm']) {
      const sidecar = path + suffix;
      if (await checkExisting(sidecar, 'sidecar')) await ensureOwnedFile(sidecar, 'sidecar');
    }
  }
}

/** Detect native Mastra records that require migration out of the domain database. */
async function hasLegacyNativeRows(settings: Settings): Promise<boolean> {
  const client = createClient({ url: settings.databaseUrl, concurrency: 1 });
  try {
    const tables = await client.execute(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT GLOB 'scanner_*' AND name NOT GLOB 'sqlite_*' ORDER BY name LIMIT 257",
    );
    if (tables.rows.length > 256) throw new Error('UNBOUNDED_LEGACY_SCHEMA');
    for (const row of tables.rows) {
      const name = String(row.name).replaceAll('"', '""');
      const result = await client.execute(`SELECT 1 FROM "${name}" LIMIT 1`);
      if (result.rows.length) return true;
    }
    return false;
  } catch {
    throw new RuntimeDiagnostic(
      'LEGACY_MASTRA_STATE_UNVERIFIED',
      'Could not verify native records in the existing database. Preserve data/ and inspect a compatible two-file backup before retrying.',
    );
  } finally {
    client.close();
  }
}

function rejectLegacyState(): never {
  throw new RuntimeDiagnostic(
    'LEGACY_MASTRA_STATE',
    'Native Mastra records remain in the original database. Preserve both database files and sidecars; restore a compatible two-file backup or use a separately approved lossless SDK migration before startup.',
  );
}

/** Prepare private domain and native database files while rejecting aliases and unsafe paths. */
export async function prepareStorageFiles(settings: Settings) {
  await prepareDataDirectory(settings);
  const applicationExists = await checkExisting(settings.databasePath, 'application', false);
  const nativeExists = await checkExisting(settings.mastraDatabasePath, 'native', false);
  if (!applicationExists && nativeExists)
    throw new RuntimeDiagnostic(
      'ORPHANED_MASTRA_DATABASE',
      'Native Mastra storage exists without the application database. Preserve both files and restore a matching application database backup before startup.',
    );
  await ensureOwnedFile(settings.databasePath, 'application');
  await checkSidecars(settings);
  if (await hasLegacyNativeRows(settings)) rejectLegacyState();
  await ensureOwnedFile(settings.mastraDatabasePath, 'native');
  await checkSidecars(settings);
}

/** Inspect both database paths and their sidecars without preparing or mutating storage. */
export async function inspectStorageFiles(settings: Settings) {
  let directory;
  try {
    directory = await lstat(settings.dataDirectory);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      return {
        status: 'not-initialized',
        application: settings.databasePath,
        native: settings.mastraDatabasePath,
        sidecars: [],
      };
    throw error;
  }
  if (
    !directory.isDirectory() ||
    directory.isSymbolicLink() ||
    directory.uid !== process.getuid?.() ||
    (directory.mode & 0o777) !== 0o700
  )
    throw new RuntimeDiagnostic('UNSAFE_DATA_DIRECTORY', 'Use an owned private data/ directory without symlinks.');
  const application = await checkExisting(settings.databasePath, 'application');
  const native = await checkExisting(settings.mastraDatabasePath, 'native');
  if (!application && native)
    throw new RuntimeDiagnostic(
      'ORPHANED_MASTRA_DATABASE',
      'Native Mastra storage exists without the application database. Preserve both files and restore a matching application database backup before startup.',
    );
  const sidecars: string[] = [];
  for (const path of [settings.databasePath, settings.mastraDatabasePath])
    for (const suffix of ['-wal', '-shm'])
      if (await checkExisting(path + suffix, 'sidecar')) sidecars.push(path + suffix);
  if (application && (await hasLegacyNativeRows(settings))) rejectLegacyState();
  return {
    status: application && native ? 'ready' : application ? 'native-not-initialized' : 'not-initialized',
    application: settings.databasePath,
    native: settings.mastraDatabasePath,
    sidecars,
  };
}
