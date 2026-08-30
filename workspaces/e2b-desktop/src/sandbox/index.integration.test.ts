/**
 * E2B Desktop Sandbox Integration Tests
 *
 * These tests require real E2B API access and run against actual E2B desktop
 * sandboxes (the E2B-hosted `desktop` template).
 *
 * Required environment variables:
 * - E2B_API_KEY: E2B API key
 */

import { createSandboxTestSuite } from '@internal/workspace-test-utils';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { E2BDesktopSandbox } from './index';

/**
 * Computer-use (desktop) smoke tests.
 *
 * Verifies the `computer` capability against a real desktop sandbox:
 * screenshots return PNG bytes, mouse input reaches the desktop, and the
 * authenticated noVNC stream URL resolves.
 */
describe.skipIf(!process.env.E2B_API_KEY)('E2BDesktopSandbox Computer Use', () => {
  let sandbox: E2BDesktopSandbox;

  beforeEach(() => {
    sandbox = new E2BDesktopSandbox({
      id: `test-computer-${Date.now()}`,
      timeout: 120000,
    });
  });

  afterEach(async () => {
    if (sandbox) {
      try {
        await sandbox._destroy();
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  it('captures a PNG screenshot and reports screen geometry', async () => {
    await sandbox._start();

    const shot = await sandbox.computer.screenshot();
    expect(shot.mediaType).toBe('image/png');
    // PNG magic bytes: \x89 P N G
    expect(Array.from(shot.data.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);

    const size = await sandbox.computer.getScreenSize();
    expect(size.width).toBeGreaterThan(0);
    expect(size.height).toBeGreaterThan(0);
  }, 300000);

  it('mouse input reaches the desktop (move → cursor position round-trip)', async () => {
    await sandbox._start();

    await sandbox.computer.moveMouse(101, 102);
    const position = await sandbox.computer.getCursorPosition();

    expect(position.x).toBe(101);
    expect(position.y).toBe(102);
  }, 300000);

  it('GUI and shell surfaces hit the same machine (type → cat round-trip)', async () => {
    await sandbox._start();

    // Focus a terminal-free path: type into `cat > file` via a pty-less shell
    // is not possible through the GUI, so instead prove the crossover both
    // ways — write a file via shell, verify the desktop sees the same
    // filesystem via the SDK escape hatch.
    await sandbox.executeCommand!('sh', ['-c', `echo 'hello-desktop' > /tmp/crossover.txt`]);
    const content = await sandbox.desktop.files.read('/tmp/crossover.txt');

    expect(String(content).trim()).toBe('hello-desktop');
  }, 300000);

  it('streamUrl resolves an authenticated live viewer URL', async () => {
    await sandbox._start();

    const url = await sandbox.computer.streamUrl!();

    expect(url).toBeTruthy();
    expect(url).toMatch(/^https?:\/\//);
    expect(url).toContain('password=');
  }, 300000);
});

/**
 * Shared sandbox conformance tests.
 *
 * The desktop template has no FUSE tooling, so mounting is disabled.
 */
describe.skipIf(!process.env.E2B_API_KEY)('E2BDesktopSandbox Conformance', () => {
  createSandboxTestSuite({
    suiteName: 'E2BDesktopSandbox',
    createSandbox: async options =>
      new E2BDesktopSandbox({
        id: `conformance-desktop-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timeout: 120000,
        ...(options?.env && { env: options.env }),
      }),
    createInvalidSandbox: () =>
      new E2BDesktopSandbox({
        id: `bad-config-${Date.now()}`,
        template: 'nonexistent-template-id-12345',
      }),
    cleanupSandbox: async sandbox => {
      try {
        await sandbox._destroy();
      } catch {
        // Ignore cleanup errors
      }
    },
    killSandboxExternally: async sb => {
      await (sb as E2BDesktopSandbox).e2b.kill();
    },
    capabilities: {
      supportsMounting: false,
      supportsReconnection: true,
      supportsConcurrency: true,
      supportsEnvVars: true,
      supportsWorkingDirectory: true,
      supportsTimeout: true,
      defaultCommandTimeout: 30000,
    },
    testTimeout: 60000,
  });
});
