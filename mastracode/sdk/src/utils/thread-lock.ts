/**
 * Thread lock — ensures only one process writes to a thread at a time.
 *
 * Lock files live at <appDataDir>/locks/<threadId>.<generation>.lock and each
 * contains the PID of the owning process. The current owner is the highest
 * generation present, and claiming is an exclusive ('wx') create one
 * generation above it, so a stale lock is superseded rather than overwritten.
 * Superseded files are left in place as inert garbage — a lock file is only
 * ever removed by its own owner (release paths), because a liveness check on
 * a lower generation can go stale under a legacy writer that reuses the same
 * path. Lock files without a generation suffix, written by older versions,
 * count as generation 0.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getAppDataDir } from './project.js';

const LOCK_SUFFIX = '.lock';

export class ThreadLockError extends Error {
  constructor(
    public readonly threadId: string,
    public readonly ownerPid: number,
  ) {
    super(`Thread ${threadId} is locked by another process (PID ${ownerPid})`);
    this.name = 'ThreadLockError';
  }
}

function getLocksDir(): string {
  const dir = path.join(getAppDataDir(), 'locks');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getSafeThreadId(threadId: string): string {
  // Sanitize thread ID for filesystem safety
  return threadId.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/** `<safeId>.lock` (pre-generation layout) parses as generation 0. */
function parseGeneration(fileName: string, safeThreadId: string): number | undefined {
  const prefix = `${safeThreadId}.`;
  if (!fileName.startsWith(prefix) || !fileName.endsWith(LOCK_SUFFIX)) return undefined;
  const generation = fileName.slice(prefix.length, -LOCK_SUFFIX.length);
  if (generation === '') return 0;
  return /^\d+$/.test(generation) ? Number(generation) : undefined;
}

type LockFile = { generation: number; filePath: string };

/** Lock files for a thread, highest generation first. */
function listLockFiles(threadId: string): LockFile[] {
  const locksDir = getLocksDir();
  const safeThreadId = getSafeThreadId(threadId);
  const files: LockFile[] = [];

  for (const fileName of fs.readdirSync(locksDir)) {
    const generation = parseGeneration(fileName, safeThreadId);
    if (generation === undefined) continue;
    files.push({ generation, filePath: path.join(locksDir, fileName) });
  }

  files.sort((a, b) => b.generation - a.generation);
  return files;
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function getErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  return typeof error.code === 'string' ? error.code : undefined;
}

/** PID stored in a lock file; undefined for unreadable or malformed content. */
function readOwnerPid(filePath: string): number | undefined {
  try {
    const ownerPid = parseInt(fs.readFileSync(filePath, 'utf-8').trim(), 10);
    return isNaN(ownerPid) ? undefined : ownerPid;
  } catch {
    return undefined;
  }
}

function removeLockFile(filePath: string): void {
  try {
    fs.unlinkSync(filePath);
  } catch {
    // Best-effort — a superseded lock left behind is ignored by every reader
  }
}

/** Exclusively create a lock file; throws EEXIST if the path is taken. */
function claimLockFile(filePath: string, pid: number): void {
  const fd = fs.openSync(filePath, 'wx', 0o644);
  try {
    fs.writeSync(fd, String(pid));
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Attempt to acquire a lock for the given thread.
 * Throws ThreadLockError if another live process holds the lock.
 * Supersedes stale locks from dead processes.
 */
export function acquireThreadLock(threadId: string): void {
  const myPid = process.pid;

  while (true) {
    const current = listLockFiles(threadId)[0];

    if (current) {
      const ownerPid = readOwnerPid(current.filePath);
      if (ownerPid === myPid) return; // already ours
      // A dead owner stays dead, so this observation cannot go stale under us.
      if (ownerPid !== undefined && isProcessAlive(ownerPid)) {
        throw new ThreadLockError(threadId, ownerPid);
      }
    }

    const generation = (current?.generation ?? 0) + 1;
    const lockPath = path.join(getLocksDir(), `${getSafeThreadId(threadId)}.${generation}${LOCK_SUFFIX}`);
    try {
      claimLockFile(lockPath, myPid);
    } catch (error) {
      // Someone claimed this generation first — rescan and reconsider.
      if (getErrorCode(error) === 'EEXIST') continue;
      throw error;
    }

    // We hold `generation`. A live owner below us means the lock directory
    // changed behind our snapshot (e.g. recreated from legacy files): back off
    // and let them keep the thread. Superseded files are otherwise left in
    // place — deleting them after a non-atomic liveness check could destroy a
    // lock that a legacy writer just reclaimed.
    const superseded = listLockFiles(threadId).filter(file => file.generation < generation);
    for (const file of superseded) {
      const ownerPid = readOwnerPid(file.filePath);
      if (ownerPid !== undefined && ownerPid !== myPid && isProcessAlive(ownerPid)) {
        removeLockFile(lockPath);
        throw new ThreadLockError(threadId, ownerPid);
      }
    }
    return;
  }
}

/**
 * Try to acquire a lock without treating contention as an error.
 * Returns false when another live process holds the lock.
 */
export function tryAcquireThreadLock(threadId: string): boolean {
  try {
    acquireThreadLock(threadId);
    return true;
  } catch (error) {
    if (error instanceof ThreadLockError) return false;
    throw error;
  }
}

/**
 * Release the lock for the given thread (only if we own it).
 */
export function releaseThreadLock(threadId: string): void {
  const myPid = process.pid;

  try {
    for (const file of listLockFiles(threadId)) {
      if (readOwnerPid(file.filePath) === myPid) removeLockFile(file.filePath);
    }
  } catch {
    // Best-effort cleanup — ignore errors
  }
}

/**
 * Check if a thread is locked by another process.
 * Returns the PID of the owner if locked, null otherwise. Stale locks are
 * reported as unlocked and left for the next claimant to supersede.
 */
export function getThreadLockOwner(threadId: string): number | null {
  try {
    const current = listLockFiles(threadId)[0];
    if (!current) return null;

    const ownerPid = readOwnerPid(current.filePath);
    if (ownerPid === undefined || ownerPid === process.pid) return null;

    return isProcessAlive(ownerPid) ? ownerPid : null;
  } catch {
    return null;
  }
}

/**
 * Release all thread locks owned by this process.
 * Call this on process exit.
 */
export function releaseAllThreadLocks(): void {
  try {
    const locksDir = getLocksDir();
    const files = fs.readdirSync(locksDir);
    const myPid = process.pid;

    for (const file of files) {
      if (!file.endsWith(LOCK_SUFFIX)) continue;
      const lockPath = path.join(locksDir, file);
      if (readOwnerPid(lockPath) === myPid) removeLockFile(lockPath);
    }
  } catch {
    // Best-effort
  }
}
