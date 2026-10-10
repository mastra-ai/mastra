import { randomUUID } from 'node:crypto';
import { open, readFile, rename, unlink, writeFile } from 'node:fs/promises';

/** Reserve the shared recovery record without overwriting a run that still needs cleanup. */
export async function reserveRunRecord(recordFile: URL, record: { name: string }): Promise<void> {
  const lockFile = new URL(`${recordFile.href}.lock`);
  const lock = await open(lockFile, 'wx');
  try {
    let previous: string | undefined;
    try {
      previous = await readFile(recordFile, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    if (previous !== undefined) {
      if (JSON.parse(previous)?.cleanupConfirmed !== true) {
        throw new Error('Previous run still requires cleanup; preserve run.json');
      }
      await rename(recordFile, new URL(`run-completed-${randomUUID()}.json`, recordFile));
    }
    await writeFile(recordFile, JSON.stringify(record, null, 2), { flag: 'wx' });
  } finally {
    await lock.close();
    await unlink(lockFile);
  }
}
