import { constants } from 'node:fs';
import { chmod, lstat, mkdir, open, rename, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { RuntimeDiagnostic, type Settings } from '../config/settings.js';

/** Create and validate the private data directory used by runtime state. */
export async function prepareDataDirectory(settings: Settings) {
  await mkdir(settings.dataDirectory, { mode: 0o700 }).catch(error => {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  });
  const stat = await lstat(settings.dataDirectory);
  if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== process.getuid?.()) {
    throw new RuntimeDiagnostic('UNSAFE_DATA_DIRECTORY', 'Use an owned local data directory, without symlinks.');
  }
  await chmod(settings.dataDirectory, 0o700);
}

/** Run setup while holding the project lock and release it after success or failure. */
export async function withSetupLock<T>(settings: Settings, operation: () => Promise<T>): Promise<T> {
  await prepareDataDirectory(settings);
  const path = join(settings.dataDirectory, 'setup.lock');
  let lock;
  try {
    lock = await open(path, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW, 0o600);
  } catch {
    throw new RuntimeDiagnostic(
      'SETUP_BUSY',
      'Another setup owns data/setup.lock. Wait for it to finish; inspect a stale lock before removing it.',
    );
  }
  try {
    await lock.writeFile(`${process.pid}\n`);
    return await operation();
  } finally {
    await lock.close();
    await rm(path);
  }
}

export async function writeReceipt(settings: Settings, value: unknown) {
  const temporary = join(settings.dataDirectory, `receipt-${randomUUID()}.json`);
  try {
    const file = await open(temporary, 'wx', 0o600);
    try {
      await file.writeFile(`${JSON.stringify(value, null, 2)}\n`);
      await file.sync();
    } finally {
      await file.close();
    }
    await rename(temporary, settings.imageReceiptPath);
  } finally {
    await rm(temporary, { force: true });
  }
}
