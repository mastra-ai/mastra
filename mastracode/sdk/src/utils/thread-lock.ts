/**
 * Thread lock — ensures only one process writes to a thread at a time.
 *
 * Lock files live at <appDataDir>/locks/<threadId>.<generation>.lock and contain
 * the owning PID. The owner is the highest generation present, and claiming is an
 * exclusive create one generation above it, so a stale lock is superseded rather
 * than deleted: no process ever removes a file a live process may have created.
 * Invariant this relies on — a lock file is only removed by its own owner or by a
 * claimant that already holds a higher generation.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { getAppDataDir } from './project.js';

const LOCK_SUFFIX = '.lock';
const FIRST_GENERATION = 1;
// pre-generation lock file written by older mastracode versions
const LEGACY_GENERATION = 0;

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
  return threadId.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function parseGeneration(fileName: string, safeThreadId: string): number | undefined {
  if (!fileName.startsWith(`${safeThreadId}.`) || !fileName.endsWith(LOCK_SUFFIX)) return undefined;
  const generation = fileName.slice(safeThreadId.length + 1, -LOCK_SUFFIX.length);
  if (generation === '') return LEGACY_GENERATION;
  return /^\d+$/.test(generation) ? Number(generation) : undefined;
}

type LockFile = { generation: number; filePath: string };

/** Newest generation first. */
function listLockFiles(threadId: string): { locksDir: string; safeThreadId: string; files: LockFile[] } {
  const locksDir = getLocksDir();
  const safeThreadId = getSafeThreadId(threadId);
  const files: LockFile[] = [];

  for (const fileName of fs.readdirSync(locksDir)) {
    const generation = parseGeneration(fileName, safeThreadId);
    if (generation === undefined) continue;
    files.push({ generation, filePath: path.join(locksDir, fileName) });
  }

  files.sort((a, b) => b.generation - a.generation);
  return { locksDir, safeThreadId, files };
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

/** Throws on read failures other than a lock file that vanished. */
function readOwnerPid(filePath: string): number | undefined {
  const ownerPid = parseInt(fs.readFileSync(filePath, 'utf-8').trim(), 10);
  return isNaN(ownerPid) ? undefined : ownerPid;
}

function readOwnerPidIfPresent(filePath: string): number | undefined {
  try {
    return readOwnerPid(filePath);
  } catch {
    return undefined;
  }
}

function findLiveOwner(files: LockFile[], myPid: number): number | undefined {
  for (const file of files) {
    const ownerPid = readOwnerPidIfPresent(file.filePath);
    if (ownerPid !== undefined && ownerPid !== myPid && isProcessAlive(ownerPid)) return ownerPid;
  }
  return undefined;
}

function removeLockFile(filePath: string): void {
  try {
    fs.unlinkSync(filePath);
  } catch {
    // Best-effort — a superseded lock left behind is reclaimed by the next generation
  }
}

function writeNewLock(lockPath: string, pid: number): void {
  const file = fs.openSync(lockPath, 'wx', 0o644);
  try {
    fs.writeFileSync(file, String(pid), 'utf-8');
  } finally {
    fs.closeSync(file);
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
    const { locksDir, safeThreadId, files } = listLockFiles(threadId);
    const current = files[0];
    let ownerPid: number | undefined;

    if (current) {
      try {
        ownerPid = readOwnerPid(current.filePath);
      } catch (error) {
        if (getErrorCode(error) === 'ENOENT') continue;
        throw error;
      }
      if (ownerPid === myPid) return;
      // a dead owner stays dead, so this observation cannot go stale under us
      if (ownerPid !== undefined && isProcessAlive(ownerPid)) throw new ThreadLockError(threadId, ownerPid);
    }

    const generation = current ? current.generation + 1 : FIRST_GENERATION;
    const lockPath = path.join(locksDir, `${safeThreadId}.${generation}${LOCK_SUFFIX}`);
    try {
      writeNewLock(lockPath, myPid);
    } catch (error) {
      if (getErrorCode(error) === 'EEXIST') continue;
      throw error;
    }

    const superseded = listLockFiles(threadId).files.filter(file => file.generation < generation);
    // a live owner below us means the generation counter was reset behind our snapshot
    const liveOwner = findLiveOwner(superseded, myPid);
    if (liveOwner !== undefined) {
      removeLockFile(lockPath);
      throw new ThreadLockError(threadId, liveOwner);
    }

    for (const file of superseded) removeLockFile(file.filePath);
    return;
  }
}

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
    for (const file of listLockFiles(threadId).files) {
      if (readOwnerPidIfPresent(file.filePath) === myPid) removeLockFile(file.filePath);
    }
  } catch {
    // Best-effort cleanup — ignore errors
  }
}

/**
 * Check if a thread is locked by another process.
 * Returns the PID of the owner if locked, null otherwise.
 */
export function getThreadLockOwner(threadId: string): number | null {
  try {
    const current = listLockFiles(threadId).files[0];
    if (!current) return null;

    const ownerPid = readOwnerPidIfPresent(current.filePath);
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
      if (readOwnerPidIfPresent(lockPath) === myPid) removeLockFile(lockPath);
    }
  } catch {
    // Best-effort
  }
}
