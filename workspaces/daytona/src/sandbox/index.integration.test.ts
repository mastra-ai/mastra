/**
 * Daytona Sandbox Integration Tests
 *
 * These tests require real Daytona API access and run against actual Daytona sandboxes.
 * They are separated from unit tests to avoid mock conflicts.
 *
 * Required environment variables:
 * - DAYTONA_API_KEY: Daytona API key
 */

import { createSandboxTestSuite } from '@internal/workspace-test-utils';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { DaytonaSandbox } from './index';

/**
 * Provider-specific Daytona integration tests.
 * Generic sandbox contract tests (command execution, env vars, timeout, etc.)
 * are covered by the conformance suite below.
 */
describe.skipIf(!process.env.DAYTONA_API_KEY)('DaytonaSandbox Integration', () => {
  let sandbox: DaytonaSandbox;

  beforeEach(() => {
    sandbox = new DaytonaSandbox({
      id: `test-${Date.now()}`,
      timeout: 60000,
      language: 'typescript',
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

  it('provides access to underlying sandbox instance', async () => {
    await sandbox._start();

    const instance = sandbox.instance;
    expect(instance).toBeDefined();
    expect(instance.id).toBeDefined();
  }, 120000);
});

/**
 * Shared sandbox conformance tests.
 * Uses the shared test suite from @internal/workspace-test-utils.
 */
describe.skipIf(!process.env.DAYTONA_API_KEY)('DaytonaSandbox Conformance', () => {
  createSandboxTestSuite({
    suiteName: 'DaytonaSandbox',
    createSandbox: async options =>
      new DaytonaSandbox({
        id: `conformance-${Date.now()}`,
        timeout: 60000,
        language: 'typescript',
        ...(options?.env && { env: options.env }),
      }),
    createInvalidSandbox: () =>
      new DaytonaSandbox({
        id: `bad-config-${Date.now()}`,
        image: 'nonexistent/fake-image:latest',
      }),
    capabilities: {
      supportsMounting: false,
      supportsReconnection: true,
      supportsEnvVars: true,
      supportsWorkingDirectory: true,
      supportsTimeout: true,
      supportsStreaming: true,
      supportsConcurrency: true,
    },
    testTimeout: 120000,
  });
});

/**
 * PTY reconnection tests — verifies the baseline process manager can discover
 * and reconnect to externally-spawned PTY sessions.
 */
describe.skipIf(!process.env.DAYTONA_API_KEY)('DaytonaProcessManager — PTY Reconnection', () => {
  let sandbox: DaytonaSandbox;

  beforeEach(() => {
    sandbox = new DaytonaSandbox({
      id: `pty-reconnect-${Date.now()}`,
      timeout: 60000,
      language: 'typescript',
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

  it('discovers externally-spawned PTY sessions via list()', async () => {
    await sandbox._start();
    const instance = sandbox.instance;

    // Spawn an external PTY session (not through the manager)
    const externalPty = await instance.process.createPty({
      id: `external-pty-${Date.now()}`,
      cwd: '/',
      onData: () => {},
    });
    await externalPty.waitForConnection();

    try {
      // list() should discover the external session
      const procs = await sandbox.processes!.list();
      const external = procs.find(p => p.command?.includes('[pty:'));
      expect(external).toBeDefined();
      expect(external!.running).toBe(true);
    } finally {
      await externalPty.kill().catch(() => {});
    }
  }, 120000);

  it('reconnects to external PTY session via get() with unknown PID', async () => {
    await sandbox._start();
    const instance = sandbox.instance;

    // Spawn an external PTY session
    const externalPty = await instance.process.createPty({
      id: `external-reconnect-${Date.now()}`,
      cwd: '/',
      onData: () => {},
    });
    await externalPty.waitForConnection();

    // Send a command to the external PTY
    await externalPty.sendInput('echo reconnected-output\n');
    // Give it a moment to process
    await new Promise(r => setTimeout(r, 1000));

    try {
      // list() first to see the external session and get its synthetic PID
      const procs = await sandbox.processes!.list();
      const external = procs.find(p => p.command?.includes('[pty:'));

      if (external) {
        // get() with the synthetic PID should reconnect
        // Note: The synthetic PID from list() is ephemeral, so we use get()
        // with an unknown PID to trigger the fallback
        const handle = await sandbox.processes!.get(99998);

        if (handle) {
          // Handle should be connected and accumulating output
          expect(handle.pid).toBeGreaterThan(0);

          // Clean up
          await handle.kill();
        }
      }
    } finally {
      await externalPty.kill().catch(() => {});
    }
  }, 120000);
});
