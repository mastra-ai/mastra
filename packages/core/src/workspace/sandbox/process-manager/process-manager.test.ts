import { describe, expect, it } from 'vitest';

import type { ProviderStatus } from '../../lifecycle';
import { MastraSandbox } from '../mastra-sandbox';
import type { CommandResult } from '../types';
import { ProcessHandle } from './process-handle';
import { SandboxProcessManager } from './process-manager';
import type { ProcessInfo, SpawnProcessOptions } from './types';

class ExitingHandle extends ProcessHandle {
  exitCode: number | undefined;

  constructor(
    readonly pid: string,
    options?: SpawnProcessOptions,
  ) {
    super(options);
  }

  finish(output: string, exitCode = 0) {
    this.emitStdout(output);
    this.exitCode = exitCode;
  }

  async wait(): Promise<CommandResult> {
    return {
      success: this.exitCode === 0,
      exitCode: this.exitCode ?? 0,
      stdout: this.stdout,
      stderr: this.stderr,
      executionTimeMs: 0,
    };
  }

  async kill(): Promise<boolean> {
    this.exitCode = 137;
    return true;
  }

  async sendStdin(): Promise<void> {}

  async closeStdin(): Promise<void> {}
}

class TrackingProcessManager extends SandboxProcessManager {
  private next = 0;

  async spawn(_command: string, options?: SpawnProcessOptions): Promise<ProcessHandle> {
    const handle = new ExitingHandle(`p${this.next++}`, options);
    this._tracked.set(handle.pid, handle);
    return handle;
  }

  async list(): Promise<ProcessInfo[]> {
    return [...this._tracked.values()].map(handle => ({ pid: handle.pid, running: handle.exitCode === undefined }));
  }
}

class TestSandbox extends MastraSandbox {
  readonly id = 'process-manager-test';
  readonly name = 'TestSandbox';
  readonly provider = 'test';
  status: ProviderStatus = 'pending';

  constructor(processes: SandboxProcessManager) {
    super({ name: 'TestSandbox', processes });
  }

  async start(): Promise<void> {}
}

async function exitedProcess() {
  const processes = new TrackingProcessManager();
  new TestSandbox(processes);
  const handle = (await processes.spawn('echo done')) as ExitingHandle;
  handle.finish('done\n');
  return { processes, pid: handle.pid };
}

describe('SandboxProcessManager.get', () => {
  it('releases an exited process once it has been read', async () => {
    const { processes, pid } = await exitedProcess();

    expect((await processes.get(pid))?.stdout).toBe('done\n');
    expect(await processes.get(pid)).toBeUndefined();
    expect(await processes.list()).toEqual([]);
  });

  it('leaves an exited process in place when read with release: false', async () => {
    const { processes, pid } = await exitedProcess();

    expect((await processes.get(pid, { release: false }))?.stdout).toBe('done\n');
    expect((await processes.get(pid, { release: false }))?.stdout).toBe('done\n');
    expect(await processes.list()).toEqual([{ pid, running: false }]);

    // The next default read still gets the output, then releases it.
    expect((await processes.get(pid))?.stdout).toBe('done\n');
    expect(await processes.get(pid)).toBeUndefined();
  });

  it('does not bring back a released process when read with release: false', async () => {
    const { processes, pid } = await exitedProcess();
    await processes.get(pid);

    expect(await processes.get(pid, { release: false })).toBeUndefined();
  });

  it('keeps a running process available either way', async () => {
    const processes = new TrackingProcessManager();
    new TestSandbox(processes);
    const handle = await processes.spawn('sleep 10');

    expect(await processes.get(handle.pid)).toBe(handle);
    expect(await processes.get(handle.pid, { release: false })).toBe(handle);
    expect(await processes.get(handle.pid)).toBe(handle);
  });
});
