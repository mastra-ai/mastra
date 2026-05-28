import { readFileSync, unlinkSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';
import pc from 'picocolors';

const LOCK_FILENAME = 'dev.lock';

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function getLockPath(dotMastraPath: string): string {
  return join(dotMastraPath, LOCK_FILENAME);
}

/**
 * Attempt to acquire the dev lock. If another `mastra dev` instance is
 * already running against the same `.mastra` directory, print a
 * user-friendly error and exit instead of letting DuckDB (or other
 * resources) fail with a confusing file-lock error.
 */
export async function acquireDevLock(dotMastraPath: string): Promise<void> {
  const lockPath = getLockPath(dotMastraPath);

  try {
    const contents = await readFile(lockPath, 'utf-8');
    const pid = Number(contents.trim());

    if (!isNaN(pid) && pid > 0 && isProcessRunning(pid)) {
      console.error('');
      console.error(
        pc.red('  ✗ ') + pc.bold(pc.red('Another instance of `mastra dev` is already running in this directory')),
      );
      console.error('');
      console.error(`  ${pc.red('│')} PID ${pc.bold(String(pid))} is still active.`);
      console.error(`  ${pc.red('│')} Only one dev server can run per project at a time because`);
      console.error(`  ${pc.red('│')} DuckDB requires an exclusive lock on its database file.`);
      console.error('');
      console.error(`  ${pc.dim('To fix this:')}`);
      console.error(`  ${pc.dim('•')} Stop the other \`mastra dev\` process (PID ${pid}), or`);
      console.error(`  ${pc.dim('•')} If that process is stuck, run: ${pc.cyan(`kill ${pid}`)}`);
      console.error('');
      process.exit(1);
    }

    // Stale lockfile — the process is gone. Remove and continue.
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      // Unexpected read error — log and continue rather than blocking startup
    }
  }

  // Write our own PID
  await writeFile(lockPath, String(process.pid), 'utf-8');
}

/**
 * Best-effort removal of the lockfile on shutdown.
 * Synchronous so it can be called from signal handlers without risk of
 * being interrupted.
 */
export function releaseDevLock(dotMastraPath: string): void {
  const lockPath = getLockPath(dotMastraPath);
  try {
    // Only remove if we own the lock
    const contents = readFileSync(lockPath, 'utf-8');
    if (Number(contents.trim()) === process.pid) {
      unlinkSync(lockPath);
    }
  } catch {
    // Best-effort — ignore errors during cleanup
  }
}
