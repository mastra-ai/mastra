import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  MaintenanceLockError,
  acquireMaintenanceLock,
  getMaintenanceLockPath,
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
