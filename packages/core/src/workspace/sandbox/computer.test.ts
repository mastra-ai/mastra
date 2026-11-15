/**
 * Sandbox Computer Capability Tests
 *
 * Tests the optional `computer` (desktop) capability on WorkspaceSandbox /
 * MastraSandbox, plus the `supportsComputer` type guard.
 */

import { describe, it, expect } from 'vitest';

import type { ProviderStatus } from '../lifecycle';

import { MastraSandbox } from './mastra-sandbox';
import { supportsComputer, supportsComputerAccessibility } from './sandbox';
import type { ComputerAccessibility, SandboxComputer, WorkspaceSandbox } from './sandbox';

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

  it.each([
    'screenshot',
    'leftClick',
    'rightClick',
    'doubleClick',
    'moveMouse',
    'drag',
    'scroll',
    'type',
    'press',
    'getScreenSize',
    'getCursorPosition',
  ] satisfies Array<keyof SandboxComputer>)('returns false when computer.%s is not a function', method => {
    const sandbox = new PlainSandbox() as WorkspaceSandbox & { computer?: unknown };
    const computer = { ...createComputer(), [method]: undefined };
    (sandbox as { computer?: unknown }).computer = computer;
    expect(supportsComputer(sandbox as WorkspaceSandbox)).toBe(false);
  });

  it('does not require the optional streamUrl method', () => {
    const sandbox: WorkspaceSandbox = new DesktopSandbox();
    expect(sandbox.computer?.streamUrl).toBeUndefined();
    expect(supportsComputer(sandbox)).toBe(true);
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

describe('supportsComputerAccessibility', () => {
  const accessibility = (): ComputerAccessibility => ({
    getTree: async () => ({ snapshotId: 's1', nodes: [], truncated: false }),
    act: async () => {},
    setText: async () => {},
  });
  const withComputer = (computer: unknown): WorkspaceSandbox => {
    const sandbox: WorkspaceSandbox = new PlainSandbox();
    (sandbox as { computer?: unknown }).computer = computer;
    return sandbox;
  };

  it('is true for a full computer with a full accessibility part', () => {
    const sandbox = withComputer({ ...createComputer(), accessibility: accessibility() });
    expect(supportsComputerAccessibility(sandbox)).toBe(true);
    if (supportsComputerAccessibility(sandbox)) {
      // narrowed: no optional chaining
      expect(typeof sandbox.computer.accessibility.getTree).toBe('function');
    }
  });

  it('is false when accessibility is undefined or the key is missing', () => {
    expect(supportsComputerAccessibility(withComputer({ ...createComputer(), accessibility: undefined }))).toBe(false);
    expect(supportsComputerAccessibility(withComputer(createComputer()))).toBe(false);
    expect(supportsComputerAccessibility(new DesktopSandbox())).toBe(false);
    expect(supportsComputerAccessibility(new PlainSandbox())).toBe(false);
  });

  it.each(['getTree', 'act', 'setText'] as const)('is false when the part lacks %s', method => {
    const part = { ...accessibility(), [method]: undefined };
    expect(supportsComputerAccessibility(withComputer({ ...createComputer(), accessibility: part }))).toBe(false);
  });

  it('is false when the accessibility part sits on an incomplete computer', () => {
    expect(supportsComputerAccessibility(withComputer({ accessibility: accessibility() }))).toBe(false);
    const { drag: _drag, ...partial } = createComputer();
    expect(supportsComputerAccessibility(withComputer({ ...partial, accessibility: accessibility() }))).toBe(false);
  });
});
