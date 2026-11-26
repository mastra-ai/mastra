import { describe, expect, it, vi } from 'vitest';

import type { ProviderStatus } from '../lifecycle';
import { createRecreateSandboxTool } from '../tools/recreate-sandbox';
import { MastraSandbox } from './mastra-sandbox';
import type { MastraSandboxOptions } from './mastra-sandbox';

class VmSandbox extends MastraSandbox {
  readonly id = 'vm';
  readonly name = 'VmSandbox';
  readonly provider = 'test';
  status: ProviderStatus = 'pending';
  vm = 0;
  starts = 0;
  destroyed: number[] = [];
  startGate?: Promise<void>;
  destroyError?: unknown;
  /** Gates for destroy calls, by call number. */
  destroyGates: Record<number, Promise<void>> = {};
  destroyCalls = 0;

  constructor(options?: MastraSandboxOptions) {
    super({ ...options, name: 'VmSandbox' });
  }

  async start(): Promise<void> {
    this.starts++;
    await this.startGate;
    this.vm++;
  }

  async destroy(): Promise<void> {
    const gate = this.destroyGates[this.destroyCalls++];
    if (gate) await gate;
    if (this.destroyError) throw this.destroyError;
    this.destroyed.push(this.vm);
  }
}

describe('MastraSandbox._reset', () => {
  it('releases the environment and leaves the instance ready to start a fresh one', async () => {
    const onStart = vi.fn();
    const sandbox = new VmSandbox({ onStart });
    await sandbox._start();

    await sandbox._reset();

    expect(sandbox.destroyed).toEqual([1]);
    expect(sandbox.status).toBe('stopped');
    await sandbox.ensureRunning();
    expect(sandbox.vm).toBe(2);
    expect(onStart).toHaveBeenCalledTimes(2);
  });

  it('does not wait on a start hung on the dead environment', async () => {
    const sandbox = new VmSandbox();
    let unblock!: () => void;
    sandbox.startGate = new Promise(resolve => (unblock = resolve));
    const hung = sandbox._start();

    // The hung start finishes once the environment is gone, as a real one fails fast.
    const resetting = sandbox._reset({ timeoutMs: 1000 });
    await Promise.resolve();
    expect(sandbox.destroyed).toEqual([0]);
    unblock();
    await resetting;
    await hung;

    expect(sandbox.destroyed).toEqual([0, 1]);
    expect(sandbox.status).toBe('stopped');
  });

  it('fails when a start in flight never settles', async () => {
    const sandbox = new VmSandbox();
    sandbox.startGate = new Promise(() => {});
    void sandbox._start();

    await expect(sandbox._reset({ timeoutMs: 10 })).rejects.toThrow('still starting');
  });

  it('counts an environment that is already gone as released', async () => {
    const sandbox = new VmSandbox();
    await sandbox._start();
    sandbox.destroyError = Object.assign(new Error('gone'), { status: 410 });

    await sandbox._reset();
    expect(sandbox.status).toBe('stopped');

    sandbox.destroyError = Object.assign(new Error('route'), { status: 404, code: 'route_not_found' });
    await expect(sandbox._reset()).rejects.toThrow('route');
  });

  it('refuses a destroyed sandbox', async () => {
    const sandbox = new VmSandbox();
    await sandbox._destroy();
    await expect(sandbox._reset()).rejects.toThrow('destroyed');
  });

  it('stays destroyed when a destroy from outside finishes during the reset', async () => {
    const sandbox = new VmSandbox();
    let unblock!: () => void;
    sandbox.startGate = new Promise(resolve => (unblock = resolve));
    let releaseSecond!: () => void;
    // The reset's second release (after the start settles) waits until the outside destroy is done.
    sandbox.destroyGates[1] = new Promise(resolve => (releaseSecond = resolve));
    const hung = sandbox._start();

    const resetting = sandbox._reset({ timeoutMs: 1000 });
    resetting.catch(() => {});
    // Let the reset release the environment and start waiting on the hung start.
    await new Promise(resolve => setTimeout(resolve, 0));
    unblock();
    await hung;
    await vi.waitFor(() => expect(sandbox.destroyCalls).toBe(2));

    await sandbox._destroy();
    expect(sandbox.status).toBe('destroyed');
    releaseSecond();

    await expect(resetting).rejects.toThrow('destroyed while it was being recreated');
    expect(sandbox.status).toBe('destroyed');
    await expect(sandbox.ensureRunning()).rejects.toThrow();
  });
});

describe('createRecreateSandboxTool', () => {
  it("resets the workspace's sandbox", async () => {
    const sandbox = new VmSandbox();
    await sandbox._start();
    const tool = createRecreateSandboxTool();

    const result = await tool.execute!({ reason: 'echo ok times out' }, { workspace: { sandbox } } as never);

    expect(result).toMatchObject({ recreated: true });
    expect(sandbox.status).toBe('stopped');
  });

  it("uses the host's reset when given", async () => {
    const reset = vi.fn(async () => {});
    const tool = createRecreateSandboxTool({ id: 'factory_recreate_sandbox', reset });

    expect(tool.id).toBe('factory_recreate_sandbox');
    await tool.execute!({ reason: 'hung' }, {} as never);
    expect(reset).toHaveBeenCalledWith(expect.objectContaining({ reason: 'hung' }));
  });
});
