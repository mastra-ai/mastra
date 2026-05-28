import { readFileSync, unlinkSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';
import pc from 'picocolors';

const LOCK_FILENAME = 'dev.lock';

interface LockData {
  pid: number;
  host?: string;
  port?: number;
}

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

function parseLockContents(contents: string): LockData | null {
  const trimmed = contents.trim();

  // Try JSON format first
  try {
    const data = JSON.parse(trimmed) as LockData;
    if (typeof data.pid === 'number' && data.pid > 0) {
      return data;
    }
  } catch {
    // Fall back to plain PID (backward compat)
  }

  const pid = Number(trimmed);
  if (!isNaN(pid) && pid > 0) {
    return { pid };
  }

  return null;
}

/**
 * Attempt to acquire the dev lock. If another `mastra dev` instance is
 * already running against the same `.mastra` directory, print a
 * user-friendly error and exit instead of letting resources fail with
 * confusing lock errors.
 */
export async function acquireDevLock(dotMastraPath: string): Promise<void> {
  const lockPath = getLockPath(dotMastraPath);

  try {
    const contents = await readFile(lockPath, 'utf-8');
    const lock = parseLockContents(contents);

    if (lock && isProcessRunning(lock.pid)) {
      console.error('');
      console.error(
        pc.red('  ✗ ') + pc.bold(pc.red('Another instance of `mastra dev` is already running in this directory')),
      );
      console.error('');
      console.error(`  ${pc.red('│')} PID ${pc.bold(String(lock.pid))} is still active.`);
      if (lock.host && lock.port) {
        console.error(`  ${pc.red('│')} Server running at ${pc.cyan(`${lock.host}:${lock.port}`)}`);
      }
      console.error(`  ${pc.red('│')} Only one dev server can run per project at a time.`);
      console.error(`  ${pc.red('│')} Running multiple instances causes resource conflicts`);
      console.error(`  ${pc.red('│')} (e.g. database locks, port collisions).`);
      console.error('');
      console.error(`  ${pc.dim('To fix this:')}`);
      console.error(`  ${pc.dim('•')} Stop the other \`mastra dev\` process (PID ${lock.pid}), or`);
      console.error(`  ${pc.dim('•')} If that process is stuck, run: ${pc.cyan(`kill ${lock.pid}`)}`);
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
  const data: LockData = { pid: process.pid };
  await writeFile(lockPath, JSON.stringify(data), 'utf-8');
}

/**
 * Update the lockfile with server host/port once they are known.
 */
export async function updateDevLock(dotMastraPath: string, host: string, port: number): Promise<void> {
  const lockPath = getLockPath(dotMastraPath);
  const data: LockData = { pid: process.pid, host, port };
  await writeFile(lockPath, JSON.stringify(data), 'utf-8');
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
    const lock = parseLockContents(contents);
    if (lock && lock.pid === process.pid) {
      unlinkSync(lockPath);
    }
  } catch {
    // Best-effort — ignore errors during cleanup
  }
}
