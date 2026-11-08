import { constants } from 'node:fs';
import { open, lstat } from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import { BillingError } from '../contracts.js';

async function restrictFile(filename: string, create: boolean): Promise<void> {
  let handle: FileHandle | undefined;
  try {
    // Restrict the inode we opened, never the target of a symbolic/hard link.
    handle = await open(filename, constants.O_RDWR | constants.O_NOFOLLOW | (create ? constants.O_CREAT : 0), 0o600);
    const before = await handle.stat();
    if (!before.isFile() || before.nlink !== 1 || before.uid !== process.getuid?.())
      throw new BillingError('storage_unavailable');
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
  // SQLite inherits the existing database's mode for new WAL/SHM files. Create
  // the main file privately before the adapter can open SQLite; also repair
  // legacy sidecars before initialization can write any additional content.
  await restrictFile(filename, true);
  await restrictFile(`${filename}-wal`, false);
  await restrictFile(`${filename}-shm`, false);
}

export async function verifyPrivateFiles(filename: string): Promise<void> {
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
