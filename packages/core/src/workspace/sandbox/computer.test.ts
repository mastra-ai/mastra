/**
 * Sandbox Computer Capability Tests
 *
 * Tests the optional `computer` (desktop) capability on WorkspaceSandbox /
 * MastraSandbox, plus the `supportsComputer` type guard.
 */

import { describe, it, expect } from 'vitest';

import type { ProviderStatus } from '../lifecycle';

import { MastraSandbox } from './mastra-sandbox';
import { supportsComputer } from './sandbox';
import type { SandboxComputer, WorkspaceSandbox } from './sandbox';

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

function createComputer(): SandboxComputer {
  return {
    screenshot: async () => ({ data: PNG_BYTES, mediaType: 'image/png' }),
    leftClick: async () => {},
    rightClick: async () => {},
    doubleClick: async () => {},
    moveMouse: async () => {},
    drag: async () => {},
    scroll: async () => {},
    type: async () => {},
    press: async () => {},
    getScreenSize: async () => ({ width: 1024, height: 768 }),
    getCursorPosition: async () => ({ x: 0, y: 0 }),
  };
}

class DesktopSandbox extends MastraSandbox {
  readonly id = 'test-desktop-sandbox';
  readonly name = 'DesktopSandbox';
  readonly provider = 'test';
  status: ProviderStatus = 'pending';

  readonly computer: SandboxComputer = createComputer();

  constructor() {
    super({ name: 'DesktopSandbox' });
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

describe('supportsComputer', () => {
  it('returns true for a sandbox implementing the computer capability', () => {
    const sandbox: WorkspaceSandbox = new DesktopSandbox();
    expect(supportsComputer(sandbox)).toBe(true);
  });

  it('returns false for a sandbox without computer', () => {
    const sandbox: WorkspaceSandbox = new PlainSandbox();
    expect(supportsComputer(sandbox)).toBe(false);
  });

  it('returns false when computer is present but screenshot is not a function', () => {
    const sandbox = new PlainSandbox() as WorkspaceSandbox & { computer?: unknown };
    (sandbox as { computer?: unknown }).computer = {};
    expect(supportsComputer(sandbox as WorkspaceSandbox)).toBe(false);
  });

  it('narrows the type so computer is non-optional', async () => {
    const sandbox: WorkspaceSandbox = new DesktopSandbox();
    if (supportsComputer(sandbox)) {
      // No optional chaining needed after the guard
      const shot = await sandbox.computer.screenshot();
      expect(shot.mediaType).toBe('image/png');
      expect(shot.data).toEqual(PNG_BYTES);
    } else {
      expect.unreachable('guard should have passed');
    }
  });
});
