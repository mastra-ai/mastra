import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LocalSandbox } from './local-sandbox';

const node = JSON.stringify(process.execPath);
const script = (source: string) => `${node} -e ${JSON.stringify(source)}`;

const IGNORE_TERM = `process.on('SIGTERM', () => console.log('TERM_IGNORED'));`;
const STAY_ALIVE = `setInterval(() => {}, 1000);`;

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
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
      { timeout: 300 },
    );

    const result = await handle.wait();

    expect(result.stdout).toContain('TERM_IGNORED');
    expect(result).toMatchObject({ exitCode: 124, timedOut: true, killed: true });
    expect(result.executionTimeMs).toBeLessThan(4_000);
    expect(await waitForExit(Number(handle.pid))).toBe(true);
  });

  it('kills a descendant that ignores SIGTERM and holds stdout after the shell exits', async () => {
    // The shell exits on SIGTERM; the background child keeps the stdout pipe open.
    const child = script(`${IGNORE_TERM} console.log('CHILD ' + process.pid); ${STAY_ALIVE}`);
    const handle = await sandbox.processes.spawn(`${child} & wait`, { timeout: 300 });

    const result = await handle.wait();

    const childPid = Number(/CHILD (\d+)/.exec(result.stdout)?.[1]);
    expect(childPid).toBeGreaterThan(0);
    strayPids.push(childPid);
    expect(result).toMatchObject({ exitCode: 124, timedOut: true });
    expect(result.executionTimeMs).toBeLessThan(4_000);
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
    const handle = await sandbox.processes.spawn(`exec ${script(parent)}`, { timeout: 300 });

    const result = await handle.wait();

    const escapedPid = Number(/ESCAPED (\d+)/.exec(result.stdout)?.[1]);
    expect(escapedPid).toBeGreaterThan(0);
    strayPids.push(escapedPid);
    expect(result).toMatchObject({ exitCode: 124, timedOut: true });
    expect(result.executionTimeMs).toBeLessThan(6_000);
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
