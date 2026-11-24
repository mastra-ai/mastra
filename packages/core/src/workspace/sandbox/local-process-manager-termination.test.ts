import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LocalSandbox } from './local-sandbox';

const node = JSON.stringify(process.execPath);
const script = (source: string) => `${node} -e ${JSON.stringify(source)}`;

const IGNORE_TERM = `process.on('SIGTERM', () => console.log('TERM_IGNORED'));`;
const STAY_ALIVE = `setInterval(() => {}, 1000);`;
// Tests that need the child to install its SIGTERM handler or print before the deadline get a
// timeout that outlasts node startup on a loaded machine; 300ms does not.
const STARTUP_SAFE_TIMEOUT = 2_000;

// `timeout` is GNU coreutils; stock macOS doesn't ship it.
const hasTimeout = spawnSync('timeout', ['--version'], { stdio: 'ignore' }).status === 0;

// A killed orphan stays a zombie until its new parent reaps it, and containers
// whose PID 1 doesn't reap (CI runners) keep it forever. Zombies still answer
// `kill(pid, 0)`, so they have to be ruled out separately.
function isZombie(pid: number): boolean {
  const ps = spawnSync('ps', ['-o', 'stat=', '-p', String(pid)], { encoding: 'utf8' });
  return (ps.stdout ?? '').trim().startsWith('Z');
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
  } catch {
    return false;
  }
  return !isZombie(pid);
}

async function waitForExit(pid: number, ms = 2_000): Promise<boolean> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (!isAlive(pid)) return true;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  return !isAlive(pid);
}

describe.skipIf(process.platform === 'win32')('LocalProcessManager timeout termination', () => {
  let workingDirectory: string;
  let sandbox: LocalSandbox;
  const strayPids: number[] = [];

  beforeEach(async () => {
    workingDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'mastra-termination-'));
    sandbox = new LocalSandbox({ workingDirectory });
  });

  afterEach(async () => {
    for (const pid of strayPids.splice(0)) {
      try {
        process.kill(pid, 'SIGKILL');
      } catch {}
    }
    vi.restoreAllMocks();
    await sandbox.destroy();
    await fs.rm(workingDirectory, { recursive: true, force: true });
  });

  it('stops a cooperative process at the deadline without escalating to SIGKILL', async () => {
    const kill = vi.spyOn(process, 'kill');
    const handle = await sandbox.processes.spawn(`exec ${script(`console.log('READY'); ${STAY_ALIVE}`)}`, {
      timeout: 300,
    });

    const result = await handle.wait();

    expect(result).toMatchObject({ exitCode: 124, timedOut: true });
    expect(result.executionTimeMs).toBeLessThan(1_500);
    // Wait past the SIGKILL grace period: the escalation timer must have been cleared.
    await new Promise(resolve => setTimeout(resolve, 2_500));
    expect(kill).toHaveBeenCalledWith(-Number(handle.pid), 'SIGTERM');
    expect(kill).not.toHaveBeenCalledWith(expect.anything(), 'SIGKILL');
  });

  it('kills a process that ignores SIGTERM', async () => {
    const handle = await sandbox.processes.spawn(
      `exec ${script(`${IGNORE_TERM} console.log('READY'); ${STAY_ALIVE}`)}`,
      { timeout: STARTUP_SAFE_TIMEOUT },
    );

    const result = await handle.wait();

    expect(result.stdout).toContain('TERM_IGNORED');
    expect(result).toMatchObject({ exitCode: 124, timedOut: true, killed: true });
    expect(result.executionTimeMs).toBeLessThan(STARTUP_SAFE_TIMEOUT + 4_000);
    expect(await waitForExit(Number(handle.pid))).toBe(true);
  });

  it('kills a descendant that ignores SIGTERM and holds stdout after the shell exits', async () => {
    // The shell exits on SIGTERM; the background child keeps the stdout pipe open.
    const child = script(`${IGNORE_TERM} console.log('CHILD ' + process.pid); ${STAY_ALIVE}`);
    const handle = await sandbox.processes.spawn(`${child} & wait`, { timeout: STARTUP_SAFE_TIMEOUT });

    const result = await handle.wait();

    const childPid = Number(/CHILD (\d+)/.exec(result.stdout)?.[1]);
    expect(childPid).toBeGreaterThan(0);
    strayPids.push(childPid);
    expect(result).toMatchObject({ exitCode: 124, timedOut: true });
    expect(result.executionTimeMs).toBeLessThan(STARTUP_SAFE_TIMEOUT + 4_000);
    expect(await waitForExit(childPid)).toBe(true);
  });

  it('settles when a descendant outside the process group keeps stdout open', async () => {
    // detached + inherited stdio puts the grandchild in its own session, out of reach
    // of the process-group kill, while it still holds the pipe.
    const grandchild = `${IGNORE_TERM} ${STAY_ALIVE}`;
    const parent = [
      `const { spawn } = require('node:child_process');`,
      `const child = spawn(process.execPath, ['-e', ${JSON.stringify(grandchild)}], { detached: true, stdio: 'inherit' });`,
      `console.log('ESCAPED ' + child.pid);`,
      STAY_ALIVE,
    ].join(' ');
    const handle = await sandbox.processes.spawn(`exec ${script(parent)}`, { timeout: STARTUP_SAFE_TIMEOUT });

    const result = await handle.wait();

    const escapedPid = Number(/ESCAPED (\d+)/.exec(result.stdout)?.[1]);
    expect(escapedPid).toBeGreaterThan(0);
    strayPids.push(escapedPid);
    expect(result).toMatchObject({ exitCode: 124, timedOut: true });
    expect(result.executionTimeMs).toBeLessThan(STARTUP_SAFE_TIMEOUT + 6_000);
  });

  it('does not time out commands when the timeout is 0', async () => {
    const handle = await sandbox.processes.spawn(script(`setTimeout(() => console.log('done'), 200)`), {
      timeout: 0,
    });

    const result = await handle.wait();

    expect(result).toMatchObject({ exitCode: 0, success: true });
    expect(result.timedOut).toBe(false);
  });
});

describe.skipIf(process.platform === 'win32')('LocalProcessManager wait after the process exits', () => {
  let workingDirectory: string;
  let sandbox: LocalSandbox;
  const strayPids: number[] = [];

  beforeEach(async () => {
    workingDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'mastra-exit-wait-'));
    sandbox = new LocalSandbox({ workingDirectory });
  });

  afterEach(async () => {
    for (const pid of strayPids.splice(0)) {
      try {
        process.kill(pid, 'SIGKILL');
      } catch {}
    }
    await sandbox.destroy();
    await fs.rm(workingDirectory, { recursive: true, force: true });
  });

  it('settles when the shell exits while a background child keeps stdout open', async () => {
    const child = script(
      `console.log('CHILD ' + process.pid); setTimeout(() => console.log('LATE'), 300); ${STAY_ALIVE}`,
    );
    const handle = await sandbox.processes.spawn(`${child} & echo started`);

    const result = await handle.wait();

    const childPid = Number(/CHILD (\d+)/.exec(result.stdout)?.[1]);
    expect(childPid).toBeGreaterThan(0);
    strayPids.push(childPid);
    expect(result).toMatchObject({ exitCode: 0, success: true });
    expect(result.executionTimeMs).toBeLessThan(5_000);
    // Output the child wrote while the exit drained is kept.
    expect(result.stdout).toContain('started');
    expect(result.stdout).toContain('LATE');
    // The child still holds the output, so the handle still counts as running.
    expect(isAlive(childPid)).toBe(true);
    expect(handle.exitCode).toBeUndefined();
  });

  async function leaveChildBehind() {
    const handle = await sandbox.processes.spawn('sleep 30 & echo "CHILD $!"; echo started');
    await handle.wait();
    const childPid = Number(/CHILD (\d+)/.exec(handle.stdout)?.[1]);
    strayPids.push(childPid);
    expect(isAlive(childPid)).toBe(true);
    return { handle, childPid };
  }

  it('still kills the child a command left behind after wait() has returned', async () => {
    const { handle, childPid } = await leaveChildBehind();

    expect(await sandbox.processes.kill(handle.pid)).toBe(true);

    expect(await waitForExit(childPid)).toBe(true);
    await vi.waitFor(() => expect(handle.exitCode).toBeDefined());
  });

  it('still stops the child a command left behind when the sandbox stops', async () => {
    const { childPid } = await leaveChildBehind();

    await sandbox.stop();

    expect(await waitForExit(childPid)).toBe(true);
  });

  it('stops the child a foreground command left behind once the command returns', async () => {
    const result = await sandbox.executeCommand!('sleep 300 & echo "CHILD $!"; echo started');

    const childPid = Number(/CHILD (\d+)/.exec(result.stdout)?.[1]);
    expect(childPid).toBeGreaterThan(0);
    strayPids.push(childPid);
    expect(result).toMatchObject({ exitCode: 0, success: true });
    expect(result.executionTimeMs).toBeLessThan(5_000);
    expect(await waitForExit(childPid)).toBe(true);
  });

  it('keeps listing a command whose child still holds its output after its output is read', async () => {
    const { handle } = await leaveChildBehind();

    await sandbox.processes.get(handle.pid);

    expect((await sandbox.processes.list()).map(p => p.pid)).toContain(handle.pid);
  });

  it.skipIf(!hasTimeout)(
    'settles when the shell is killed while a `timeout` child in its own process group holds stdout',
    async () => {
      // `timeout` puts the command it runs in a new process group, so it survives
      // the shell and keeps the pipe open.
      const child = script(`console.log('CHILD ' + process.pid); ${STAY_ALIVE}`);
      const handle = await sandbox.processes.spawn(`for i in 1 2 3; do timeout 60 ${child}; done`);
      await vi.waitFor(() => expect(handle.stdout).toMatch(/CHILD \d+/));
      strayPids.push(Number(/CHILD (\d+)/.exec(handle.stdout)?.[1]));

      process.kill(Number(handle.pid), 'SIGKILL');
      const result = await handle.wait();

      expect(result).toMatchObject({ exitCode: 128, killed: true });
      // Without settling on the exit, wait() lasts until `timeout 60` ends its child.
      expect(result.executionTimeMs).toBeLessThan(5_000);
    },
  );
});
