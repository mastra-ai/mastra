/**
 * Mutual exclusion between storage maintenance (`mastracode prune`) and running
 * mastracode sessions, using the same pid-file / stale-PID pattern as
 * thread-lock.ts.
 *
 * - Every process that opens storage registers a session pid file.
 * - `prune` holds `maintenance.lock` for its whole run.
 *
 * The checks are ordered so the race is closed both ways: `prune` acquires the
 * lock and THEN looks for live sessions; a starter registers and THEN looks for
 * the lock. Whichever acts second always sees the other.
 */
import fs from 'node:fs';
import path from 'node:path';

import { getAppDataDir } from './project.js';

export class MaintenanceLockError extends Error {
  constructor(
    message: string,
    public readonly ownerPids: number[],
  ) {
    super(message);
    this.name = 'MaintenanceLockError';
  }
}

function getLocksDir(): string {
  const dir = path.join(getAppDataDir(), 'locks');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getSessionsDir(): string {
  const dir = path.join(getLocksDir(), 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function getMaintenanceLockPath(): string {
  return path.join(getLocksDir(), 'maintenance.lock');
}

/** Owner of a lock whose pid file is still being written (PID not known yet). */
export const UNKNOWN_OWNER = -1;

/**
 * Creating a pid file (open, then write) is not atomic, so an empty or
 * unparseable file may belong to a process that is mid-write. Only treat it as
 * stale once it is older than this.
 */
export const MALFORMED_PID_FILE_GRACE_MS = 5_000;

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    // Only ESRCH proves the process is gone; EPERM etc. mean it exists.
    return (error as NodeJS.ErrnoException).code !== 'ESRCH';
  }
}

/** Whether a pid file with no readable PID is old enough to reap. Missing files count as reapable. */
function isMalformedPidFileStale(file: string): boolean {
  try {
    return Date.now() - fs.statSync(file).mtimeMs > MALFORMED_PID_FILE_GRACE_MS;
  } catch {
    return true;
  }
}

function describeOwners(pids: number[]): string {
  const known = pids.filter(pid => pid !== UNKNOWN_OWNER);
  return known.length > 0 ? ` (PID ${known.join(', ')})` : '';
}

function readPid(file: string): number | null {
  try {
    const pid = parseInt(fs.readFileSync(file, 'utf-8').trim(), 10);
    return isNaN(pid) ? null : pid;
  } catch {
    return null;
  }
}

/**
 * PID holding the maintenance lock, `UNKNOWN_OWNER` while its pid file is still
 * being written, or null. Stale locks are removed.
 */
export function getMaintenanceLockOwner(): number | null {
  const lockPath = getMaintenanceLockPath();
  if (!fs.existsSync(lockPath)) return null;
  const pid = readPid(lockPath);
  if (pid === process.pid) return null;
  if (pid !== null && isProcessAlive(pid)) return pid;
  if (pid === null && !isMalformedPidFileStale(lockPath)) return UNKNOWN_OWNER;
  try {
    fs.unlinkSync(lockPath);
  } catch {}
  return null;
}

/** PIDs of other live registered sessions. Stale registrations are removed. */
export function getLiveSessionPids(): number[] {
  const dir = getSessionsDir();
  const live: number[] = [];
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.pid')) continue;
    const filePath = path.join(dir, file);
    const pid = readPid(filePath);
    if (pid === process.pid) continue;
    if (pid !== null && isProcessAlive(pid)) {
      live.push(pid);
    } else if (pid === null && !isMalformedPidFileStale(filePath)) {
      live.push(UNKNOWN_OWNER);
    } else {
      try {
        fs.unlinkSync(filePath);
      } catch {}
    }
  }
  return live;
}

let sessionRegistered = false;

/** Register this process as a running session. Released on process exit. */
export function registerSession(): void {
  if (sessionRegistered) return;
  fs.writeFileSync(path.join(getSessionsDir(), `${process.pid}.pid`), String(process.pid), { mode: 0o644 });
  sessionRegistered = true;
  process.once('exit', unregisterSession);
}

export function unregisterSession(): void {
  if (!sessionRegistered) return;
  sessionRegistered = false;
  try {
    fs.unlinkSync(path.join(getSessionsDir(), `${process.pid}.pid`));
  } catch {}
}

/**
 * Register this session, then wait for any running maintenance to finish.
 * Throws after `timeoutMs` naming the maintenance holder.
 */
export async function registerSessionAndWaitForMaintenance({
  timeoutMs = 60_000,
  pollMs = 250,
  onWait,
}: { timeoutMs?: number; pollMs?: number; onWait?: (ownerPid: number) => void } = {}): Promise<void> {
  registerSession();
  const deadline = Date.now() + timeoutMs;
  let notified = false;
  for (;;) {
    const owner = getMaintenanceLockOwner();
    if (owner === null) return;
    if (!notified) {
      notified = true;
      onWait?.(owner);
    }
    if (Date.now() >= deadline) {
      unregisterSession();
      throw new MaintenanceLockError(
        `Storage maintenance (mastracode prune${describeOwners([owner])}) is still running after ${Math.round(timeoutMs / 1000)}s. ` +
          `Wait for it to finish, or stop it, then start mastracode again.`,
        [owner],
      );
    }
    await new Promise(resolve => setTimeout(resolve, pollMs));
  }
}

/**
 * Acquire the maintenance lock, then refuse if any mastracode session is live.
 * Returns a release function.
 */
export function acquireMaintenanceLock(): () => void {
  const lockPath = getMaintenanceLockPath();
  for (let attempt = 0; ; attempt++) {
    try {
      // 'wx' makes creation atomic, so two prunes cannot both win.
      fs.writeFileSync(lockPath, String(process.pid), { flag: 'wx', mode: 0o644 });
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      // getMaintenanceLockOwner() removes a stale lock, so the retry can win.
      const owner = getMaintenanceLockOwner();
      if (owner !== null || attempt > 0) {
        throw new MaintenanceLockError(
          `Another mastracode prune is already running${owner === null ? '' : describeOwners([owner])}.`,
          owner === null ? [] : [owner],
        );
      }
    }
  }

  const release = () => {
    if (readPid(lockPath) === process.pid) {
      try {
        fs.unlinkSync(lockPath);
      } catch {}
    }
  };

  const sessions = getLiveSessionPids();
  if (sessions.length > 0) {
    release();
    throw new MaintenanceLockError(
      `mastracode is running${describeOwners(sessions)}. Exit every mastracode session before running prune.`,
      sessions,
    );
  }
  return release;
}
