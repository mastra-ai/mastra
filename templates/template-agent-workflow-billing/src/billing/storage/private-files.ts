import { constants } from 'node:fs';
import { dirname } from 'node:path';
import { open, lstat, mkdir } from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import { BillingError } from '../contracts/core.js';

function requirePrivateFilePlatform() {
  if (!['darwin', 'linux'].includes(process.platform) || typeof process.getuid !== 'function') {
    const error = new Error(
      'Unsupported platform: this template requires macOS or Linux with POSIX file ownership and permissions. Windows is not supported.',
    );
    error.name = 'UnsupportedPlatformError';
    throw error;
  }
}

async function restrictFile(filename: string, create: boolean): Promise<void> {
  let handle: FileHandle | undefined;
  try {
    // Restrict the inode we opened, never the target of a symbolic/hard link.
    handle = await open(filename, constants.O_RDWR | constants.O_NOFOLLOW | (create ? constants.O_CREAT : 0), 0o600);
    const before = await handle.stat();
    if (!before.isFile() || before.uid !== process.getuid?.()) throw new BillingError('storage_unavailable');
    // SQLite can unlink an optional WAL/SHM after open but before fstat. The
    // detached inode has no pathname to restrict, just as when open sees ENOENT.
    if (!create && before.nlink === 0) return;
    if (before.nlink !== 1) throw new BillingError('storage_unavailable');
    await handle.chmod(0o600);
    if (((await handle.stat()).mode & 0o7777) !== 0o600) throw new BillingError('storage_unavailable');
  } catch (error) {
    if (!create && error instanceof Error && 'code' in error && error.code === 'ENOENT') return;
    throw error instanceof BillingError ? error : new BillingError('storage_unavailable');
  } finally {
    await handle?.close();
  }
}

export async function privateWorkflowFiles(filename: string): Promise<void> {
  requirePrivateFilePlatform();
  await verifyDatabaseDirectory(dirname(filename));
  // SQLite inherits the existing database's mode for new WAL/SHM files. Create
  // the main file privately before the adapter can open SQLite; also repair
  // legacy sidecars before initialization can write any additional content.
  await restrictFile(filename, true);
  await restrictFile(`${filename}-wal`, false);
  await restrictFile(`${filename}-shm`, false);
}

export async function verifyPrivateFiles(filename: string): Promise<void> {
  requirePrivateFilePlatform();
  await verifyDatabaseDirectory(dirname(filename));
  for (const [index, path] of [filename, `${filename}-wal`, `${filename}-shm`].entries()) {
    try {
      const info = await lstat(path);
      if (!info.isFile() || info.nlink !== 1 || info.uid !== process.getuid?.() || (info.mode & 0o7777) !== 0o600)
        throw new BillingError('storage_unavailable');
    } catch (error) {
      if (index > 0 && error instanceof Error && 'code' in error && error.code === 'ENOENT') continue;
      throw error instanceof BillingError ? error : new BillingError('storage_unavailable');
    }
  }
}

export async function verifyDatabaseDirectory(directory: string) {
  requirePrivateFilePlatform();
  try {
    const info = await lstat(directory);
    if (!info.isDirectory() || info.uid !== process.getuid?.() || (info.mode & 0o022) !== 0)
      throw new BillingError('storage_unavailable');
  } catch (error) {
    throw error instanceof BillingError ? error : new BillingError('storage_unavailable');
  }
}

export async function privateDirectory(directory: string) {
  requirePrivateFilePlatform();
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const info = await lstat(directory);
  if (!info.isDirectory() || info.uid !== process.getuid?.() || (info.mode & 0o077) !== 0)
    throw new BillingError('storage_unavailable');
}
