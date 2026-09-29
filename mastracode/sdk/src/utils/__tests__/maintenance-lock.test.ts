import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  MALFORMED_PID_FILE_GRACE_MS,
  MaintenanceLockError,
  UNKNOWN_OWNER,
  acquireMaintenanceLock,
  getMaintenanceLockOwner,
  getMaintenanceLockPath,
  registerSession,
  registerSessionAndWaitForMaintenance,
  unregisterSession,
} from '../maintenance-lock.js';

// A real, live foreign process stands in for "another mastracode process".
function spawnLiveProcess(): ChildProcess {
  return spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' });
}

function sessionsDir(): string {
  return path.join(path.dirname(getMaintenanceLockPath()), 'sessions');
}

let dataDir: string;
let prevDataDir: string | undefined;
const children: ChildProcess[] = [];

beforeEach(() => {
  prevDataDir = process.env.MASTRA_APP_DATA_DIR;
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mc-maint-lock-'));
  process.env.MASTRA_APP_DATA_DIR = dataDir;
});

afterEach(() => {
  unregisterSession();
  for (const child of children.splice(0)) child.kill();
  if (prevDataDir === undefined) delete process.env.MASTRA_APP_DATA_DIR;
  else process.env.MASTRA_APP_DATA_DIR = prevDataDir;
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe('maintenance lock', () => {
  it('blocks a starting session while prune holds the lock, then lets it through', async () => {
    const pruner = spawnLiveProcess();
    children.push(pruner);
    fs.writeFileSync(getMaintenanceLockPath(), String(pruner.pid));

    const waitedOn: number[] = [];
    let started = false;
    const starting = registerSessionAndWaitForMaintenance({
      pollMs: 10,
      timeoutMs: 10_000,
      onWait: pid => waitedOn.push(pid),
    }).then(() => {
      started = true;
    });

    await new Promise(resolve => setTimeout(resolve, 100));
    expect(started).toBe(false);
    expect(waitedOn).toEqual([pruner.pid]);
    // The session registers before waiting, so a later prune would see it.
    expect(fs.existsSync(path.join(sessionsDir(), `${process.pid}.pid`))).toBe(true);

    fs.unlinkSync(getMaintenanceLockPath());
    await starting;
    expect(started).toBe(true);
  });

  it('times out a starting session with an error naming the prune PID', async () => {
    const pruner = spawnLiveProcess();
    children.push(pruner);
    fs.writeFileSync(getMaintenanceLockPath(), String(pruner.pid));

    await expect(registerSessionAndWaitForMaintenance({ pollMs: 10, timeoutMs: 50 })).rejects.toThrow(
      `PID ${pruner.pid}`,
    );
    expect(fs.existsSync(path.join(sessionsDir(), `${process.pid}.pid`))).toBe(false);
  });

  it('refuses prune while a session is live and leaves no lock behind', () => {
    const session = spawnLiveProcess();
    children.push(session);
    fs.mkdirSync(sessionsDir(), { recursive: true });
    fs.writeFileSync(path.join(sessionsDir(), `${session.pid}.pid`), String(session.pid));

    let error: unknown;
    try {
      acquireMaintenanceLock();
    } catch (err) {
      error = err;
    }
    expect(error).toBeInstanceOf(MaintenanceLockError);
    expect((error as MaintenanceLockError).ownerPids).toEqual([session.pid]);
    expect(fs.existsSync(getMaintenanceLockPath())).toBe(false);
  });

  it('refuses a second prune while another prune holds the lock', () => {
    const pruner = spawnLiveProcess();
    children.push(pruner);
    fs.writeFileSync(getMaintenanceLockPath(), String(pruner.pid));

    expect(() => acquireMaintenanceLock()).toThrow(`Another mastracode prune is already running (PID ${pruner.pid})`);
  });

  it('reclaims stale lock and session files from dead processes', async () => {
    const dead = spawnLiveProcess();
    await new Promise(resolve => {
      dead.once('exit', resolve);
      dead.kill();
    });
    fs.writeFileSync(getMaintenanceLockPath(), String(dead.pid));
    fs.mkdirSync(sessionsDir(), { recursive: true });
    fs.writeFileSync(path.join(sessionsDir(), `${dead.pid}.pid`), String(dead.pid));

    const release = acquireMaintenanceLock();
    expect(fs.readFileSync(getMaintenanceLockPath(), 'utf-8')).toBe(String(process.pid));
    expect(fs.existsSync(path.join(sessionsDir(), `${dead.pid}.pid`))).toBe(false);

    release();
    expect(fs.existsSync(getMaintenanceLockPath())).toBe(false);
  });
});

describe('pid files that are still being written', () => {
  function backdate(file: string): void {
    const past = new Date(Date.now() - MALFORMED_PID_FILE_GRACE_MS - 1_000);
    fs.utimesSync(file, past, past);
  }

  it('treats a fresh empty maintenance lock as held, not stale', () => {
    fs.writeFileSync(getMaintenanceLockPath(), '');

    expect(getMaintenanceLockOwner()).toBe(UNKNOWN_OWNER);
    expect(() => acquireMaintenanceLock()).toThrow(MaintenanceLockError);
    expect(() => acquireMaintenanceLock()).toThrow('Another mastracode prune is already running.');
    expect(fs.existsSync(getMaintenanceLockPath())).toBe(true);
  });

  it('keeps a starting session waiting on a fresh empty maintenance lock', async () => {
    fs.writeFileSync(getMaintenanceLockPath(), '');

    await expect(registerSessionAndWaitForMaintenance({ timeoutMs: 50, pollMs: 10 })).rejects.toThrow(
      'Storage maintenance (mastracode prune) is still running',
    );
  });

  it('reaps an empty maintenance lock once it is past the grace period', () => {
    fs.writeFileSync(getMaintenanceLockPath(), '');
    backdate(getMaintenanceLockPath());

    const release = acquireMaintenanceLock();
    expect(fs.readFileSync(getMaintenanceLockPath(), 'utf-8')).toBe(String(process.pid));
    release();
  });

  it('refuses prune on a fresh empty session registration and keeps it', () => {
    const sessionFile = path.join(sessionsDir(), '999999.pid');
    fs.mkdirSync(sessionsDir(), { recursive: true });
    fs.writeFileSync(sessionFile, '');

    expect(() => acquireMaintenanceLock()).toThrow('mastracode is running. Exit every mastracode session');
    expect(fs.existsSync(sessionFile)).toBe(true);
    expect(fs.existsSync(getMaintenanceLockPath())).toBe(false);
  });

  it('reaps an empty session registration once it is past the grace period', () => {
    const sessionFile = path.join(sessionsDir(), '999999.pid');
    fs.mkdirSync(sessionsDir(), { recursive: true });
    fs.writeFileSync(sessionFile, '');
    backdate(sessionFile);

    const release = acquireMaintenanceLock();
    expect(fs.existsSync(sessionFile)).toBe(false);
    release();
  });
});

describe('multiple sessions in one process', () => {
  const ownPidFile = () => path.join(sessionsDir(), `${process.pid}.pid`);

  it('keeps the registration while another session in this process is still open', () => {
    registerSession(); // session A starts
    registerSession(); // session B registers...
    unregisterSession(); // ...then fails in createStorage and releases its own registration

    // What another process (prune) reads when it scans the sessions dir.
    expect(fs.readFileSync(ownPidFile(), 'utf8')).toBe(String(process.pid));

    unregisterSession(); // A closes
    expect(fs.existsSync(ownPidFile())).toBe(false);
  });

  it('keeps the registration when a second session times out waiting for maintenance', async () => {
    registerSession(); // session A
    const pruner = spawnLiveProcess();
    children.push(pruner);
    fs.writeFileSync(getMaintenanceLockPath(), String(pruner.pid));

    await expect(registerSessionAndWaitForMaintenance({ timeoutMs: 50, pollMs: 10 })).rejects.toThrow(
      MaintenanceLockError,
    );
    expect(fs.readFileSync(ownPidFile(), 'utf8')).toBe(String(process.pid));
    // afterEach releases A.
  });
});

describe('stale maintenance lock naming our own PID', () => {
  it('reaps it instead of reporting an ownerless running prune', () => {
    fs.writeFileSync(getMaintenanceLockPath(), String(process.pid));
    expect(getMaintenanceLockOwner()).toBeNull();
    expect(fs.existsSync(getMaintenanceLockPath())).toBe(false);

    fs.writeFileSync(getMaintenanceLockPath(), String(process.pid));
    const release = acquireMaintenanceLock();
    expect(fs.readFileSync(getMaintenanceLockPath(), 'utf8')).toBe(String(process.pid));
    release();
  });
});
