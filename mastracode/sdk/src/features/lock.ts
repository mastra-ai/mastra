import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * A cross-process directory lock. `mkdir` is atomic, so exactly one process creates the lock directory.
 * The owner writes `owner.json` (pid, host, token) and touches it every few seconds while it works. A lock
 * whose owner is gone, or that has not been touched for a minute, is stale and may be taken over.
 */

const OWNER_FILE = 'owner.json';
const POLL_MS = 250;

export interface LockTiming {
  /** How often the owner touches the lock. */
  heartbeatMs: number;
  /** A lock untouched for this long is stale, even if its pid looks alive (hung, or another host). */
  staleMs: number;
}

const DEFAULT_TIMING: LockTiming = { heartbeatMs: 5_000, staleMs: 60_000 };

interface LockOwner {
  pid: number;
  host: string;
  token: string;
}

export interface HeldLock {
  /** Whether this process still owns the lock. Check before any step that must not run twice at once. */
  isHeld(): boolean;
  release(): void;
}

function readOwner(lockDir: string): LockOwner | undefined {
  try {
    return JSON.parse(fs.readFileSync(path.join(lockDir, OWNER_FILE), 'utf8')) as LockOwner;
  } catch {
    return undefined;
  }
}

export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // Only ESRCH proves the process is gone; EPERM and anything unexpected count as alive.
    return (error as NodeJS.ErrnoException).code !== 'ESRCH';
  }
}

function lastTouched(lockDir: string): number | undefined {
  // Before the owner has written owner.json, the directory's own mtime stands in.
  const stat =
    fs.statSync(path.join(lockDir, OWNER_FILE), { throwIfNoEntry: false }) ??
    fs.statSync(lockDir, { throwIfNoEntry: false });
  return stat?.mtimeMs;
}

function isStale(lockDir: string, owner: LockOwner | undefined, timing: LockTiming): boolean {
  if (owner && owner.host === os.hostname() && !isProcessAlive(owner.pid)) return true;
  const touched = lastTouched(lockDir);
  return touched !== undefined && Date.now() - touched > timing.staleMs;
}

/**
 * Removes the lock at `lockDir` only if it is still the one owned by `token` (`undefined`: a lock whose
 * owner never wrote owner.json). It is first renamed aside,
 * which only one process can do; if what moved turns out to be a newer lock, it is put back.
 */
function removeIfOwnedBy(lockDir: string, token: string | undefined): void {
  const aside = `${lockDir}.removing-${randomUUID()}`;
  try {
    fs.renameSync(lockDir, aside);
  } catch {
    // Gone already, or another process is moving it.
    return;
  }
  if (readOwner(aside)?.token !== token) {
    try {
      fs.renameSync(aside, lockDir);
      return;
    } catch {
      // A third process locked in the meantime. The lock just moved aside is lost; its owner sees that
      // through `isHeld()` before it commits anything.
    }
  }
  fs.rmSync(aside, { recursive: true, force: true });
}

/** A takeover that crashed between taking and releasing its guard (a few milliseconds) leaves it behind. */
const RECLAIM_GUARD_STALE_MS = 10_000;

/**
 * Removes a stale lock. Takeovers go one at a time through a guard directory, and staleness is checked
 * again inside it, so a waiter that saw the old lock never removes the fresh one another waiter just made.
 */
/** Returns false when another process is taking over right now. */
function reclaimStale(lockDir: string, timing: LockTiming): boolean {
  const guard = `${lockDir}.reclaim`;
  try {
    fs.mkdirSync(guard);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    reapStaleGuard(guard);
    return false;
  }
  try {
    const owner = readOwner(lockDir);
    if (fs.existsSync(lockDir) && isStale(lockDir, owner, timing)) removeIfOwnedBy(lockDir, owner?.token);
  } finally {
    fs.rmSync(guard, { recursive: true, force: true });
  }
  return true;
}

/** Removes a guard left by a crashed takeover. Moved aside first, and put back if it turns out to be fresh. */
function reapStaleGuard(guard: string): void {
  const isOld = (dir: string) => {
    const stat = fs.statSync(dir, { throwIfNoEntry: false });
    return stat !== undefined && Date.now() - stat.mtimeMs > RECLAIM_GUARD_STALE_MS;
  };
  if (!isOld(guard)) return;
  const aside = `${guard}.stale-${randomUUID()}`;
  try {
    fs.renameSync(guard, aside);
  } catch {
    return;
  }
  if (isOld(aside)) {
    fs.rmSync(aside, { recursive: true, force: true });
    return;
  }
  try {
    fs.renameSync(aside, guard);
  } catch {
    // Another takeover holds a newer guard; this one's owner finished or will find the lock re-checked.
    fs.rmSync(aside, { recursive: true, force: true });
  }
}

export async function acquireLock(
  lockDir: string,
  signal?: AbortSignal,
  timing: LockTiming = DEFAULT_TIMING,
): Promise<HeldLock> {
  while (true) {
    signal?.throwIfAborted();
    const token = randomUUID();
    let created = false;
    try {
      fs.mkdirSync(lockDir);
      created = true;
      // Written whole, then renamed: owner.json is either absent or complete, never half written.
      const tmp = path.join(lockDir, `${OWNER_FILE}.${token}`);
      fs.writeFileSync(tmp, JSON.stringify({ pid: process.pid, host: os.hostname(), token } satisfies LockOwner));
      fs.renameSync(tmp, path.join(lockDir, OWNER_FILE));
      return holdLock(lockDir, token, timing);
    } catch (error) {
      if (created) {
        fs.rmSync(lockDir, { recursive: true, force: true });
        throw error;
      }
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
    if (isStale(lockDir, readOwner(lockDir), timing) && reclaimStale(lockDir, timing)) continue;
    await new Promise(resolve => setTimeout(resolve, POLL_MS));
  }
}

function holdLock(lockDir: string, token: string, timing: LockTiming): HeldLock {
  const ownerFile = path.join(lockDir, OWNER_FILE);
  const isHeld = () => readOwner(lockDir)?.token === token;
  // Keeps beating until release. A tick can miss (the lock may be moved aside for a moment by a process
  // checking whether it owns it), so a failure never stops the heartbeat.
  const heartbeat = setInterval(() => {
    try {
      if (isHeld()) {
        const now = new Date();
        fs.utimesSync(ownerFile, now, now);
      }
    } catch {
      // Try again next tick.
    }
  }, timing.heartbeatMs);
  heartbeat.unref();
  return {
    isHeld,
    release: () => {
      clearInterval(heartbeat);
      // A process that lost the lock leaves it alone instead of moving the new owner's lock around.
      if (isHeld()) removeIfOwnedBy(lockDir, token);
    },
  };
}
