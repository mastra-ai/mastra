/**
 * Sandbox Networking Capability Tests
 *
 * Tests the optional `networking` capability and `writeFiles` fast path on
 * WorkspaceSandbox / MastraSandbox, plus the `supportsNetworking` type guard.
 */

import { describe, it, expect, vi } from 'vitest';

import type { ProviderStatus } from '../lifecycle';

import { MastraSandbox } from './mastra-sandbox';
import { supportsNetworking } from './sandbox';
import type { SandboxFileInput, SandboxNetworking, WorkspaceSandbox } from './sandbox';

class NetworkedSandbox extends MastraSandbox {
  readonly id = 'test-networked-sandbox';
  readonly name = 'NetworkedSandbox';
  readonly provider = 'test';
  status: ProviderStatus = 'pending';

  readonly networking: SandboxNetworking = {
    getPortUrl: async (port: number) => (port === 4111 ? 'https://sandbox.example.com' : null),
  };

  readonly written: SandboxFileInput[] = [];

  constructor() {
    super({ name: 'NetworkedSandbox' });
  }

  async writeFiles(files: SandboxFileInput[]): Promise<void> {
    this.written.push(...files);
  }

  async start(): Promise<void> {}
  async stop(): Promise<void> {}
  async destroy(): Promise<void> {}
}

class PlainSandbox extends MastraSandbox {
  readonly id = 'test-plain-sandbox';
  readonly name = 'PlainSandbox';
  readonly provider = 'test';
  status: ProviderStatus = 'pending';

  constructor() {
    super({ name: 'PlainSandbox' });
  }

  async start(): Promise<void> {}
  async stop(): Promise<void> {}
  async destroy(): Promise<void> {}
}

describe('supportsNetworking', () => {
  it('returns true for a sandbox implementing the networking capability', () => {
    const sandbox: WorkspaceSandbox = new NetworkedSandbox();
    expect(supportsNetworking(sandbox)).toBe(true);
  });

  it('returns false for a sandbox without networking', () => {
    const sandbox: WorkspaceSandbox = new PlainSandbox();
    expect(supportsNetworking(sandbox)).toBe(false);
  });

  it('returns false when networking is present but getPortUrl is not a function', () => {
    const sandbox = new PlainSandbox() as WorkspaceSandbox & { networking?: unknown };
    (sandbox as { networking?: unknown }).networking = {};
    expect(supportsNetworking(sandbox as WorkspaceSandbox)).toBe(false);
  });

  it('narrows the type so networking is non-optional', async () => {
    const sandbox: WorkspaceSandbox = new NetworkedSandbox();
    if (supportsNetworking(sandbox)) {
      // No optional chaining needed after the guard
      const url = await sandbox.networking.getPortUrl(4111);
      expect(url).toBe('https://sandbox.example.com');
    } else {
      expect.unreachable('guard should have passed');
    }
  });
});

describe('SandboxNetworking.getPortUrl', () => {
  it('returns the public URL for an exposed port', async () => {
    const sandbox = new NetworkedSandbox();
    await expect(sandbox.networking.getPortUrl(4111)).resolves.toBe('https://sandbox.example.com');
  });

  it('returns null for a port that is not exposed', async () => {
    const sandbox = new NetworkedSandbox();
    await expect(sandbox.networking.getPortUrl(9999)).resolves.toBeNull();
  });
});

describe('writeFiles', () => {
  it('is callable through the WorkspaceSandbox interface when implemented', async () => {
    const sandbox = new NetworkedSandbox();
    const asInterface: WorkspaceSandbox = sandbox;

    await asInterface.writeFiles?.([
      { path: '/app/index.mjs', content: 'export {}' },
      { path: '/app/data.bin', content: Buffer.from([1, 2, 3]) },
    ]);

    expect(sandbox.written).toHaveLength(2);
    expect(sandbox.written[0]).toEqual({ path: '/app/index.mjs', content: 'export {}' });
  });

  it('is undefined on sandboxes that do not implement it', () => {
    const sandbox: WorkspaceSandbox = new PlainSandbox();
    expect(sandbox.writeFiles).toBeUndefined();
  });

  it('subclass prototype methods are not shadowed by class field initialization', () => {
    // Guards against useDefineForClassFields emitting `this.writeFiles = undefined`
    const sandbox = new NetworkedSandbox();
    expect(typeof sandbox.writeFiles).toBe('function');
    const spy = vi.spyOn(sandbox, 'writeFiles');
    void sandbox.writeFiles([]);
    expect(spy).toHaveBeenCalled();
  });
});
