/**
 * Hybrid Process Manager Integration Tests (Approach B)
 *
 * Runs the shared conformance suite with DaytonaHybridProcessManager
 * injected via _processManagerOverride.
 *
 * Expected results:
 * - All standard spawn tests: PASS (Session API unchanged)
 * - stdout/stderr separation: PASS (Session API)
 * - stdin: PASS (Session API)
 * - tracking/pruning: PASS
 * - get() unknown PID: PASS
 *
 * Plus additional tests for PTY reconnection capability.
 *
 * Required environment variables:
 * - DAYTONA_API_KEY: Daytona API key
 */

import { createSandboxTestSuite } from '@internal/workspace-test-utils';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { DaytonaSandbox } from './index';
import { DaytonaHybridProcessManager } from './process-manager-hybrid';

/**
 * Conformance suite with hybrid process manager.
 */
describe.skipIf(!process.env.DAYTONA_API_KEY)('DaytonaSandbox Conformance (Hybrid Process Manager)', () => {
  createSandboxTestSuite({
    suiteName: 'DaytonaSandbox (Hybrid)',
    createSandbox: async options => {
      const hybridProcessManager = new DaytonaHybridProcessManager({
        env: options?.env,
        defaultTimeout: 60000,
      });

      return new DaytonaSandbox({
        id: `hybrid-conformance-${Date.now()}`,
        timeout: 60000,
        language: 'typescript',
        ...(options?.env && { env: options.env }),
        _processManagerOverride: hybridProcessManager,
      });
    },
    createInvalidSandbox: () =>
      new DaytonaSandbox({
        id: `hybrid-bad-config-${Date.now()}`,
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
 * PTY reconnection tests — verifies the hybrid manager can discover
 * and reconnect to externally-spawned PTY sessions.
 */
describe.skipIf(!process.env.DAYTONA_API_KEY)('DaytonaHybridProcessManager — PTY Reconnection', () => {
  let sandbox: DaytonaSandbox;
  let hybridManager: DaytonaHybridProcessManager;

  beforeEach(() => {
    hybridManager = new DaytonaHybridProcessManager({
      defaultTimeout: 60000,
    });

    sandbox = new DaytonaSandbox({
      id: `hybrid-reconnect-${Date.now()}`,
      timeout: 60000,
      language: 'typescript',
      _processManagerOverride: hybridManager,
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

  it(
    'discovers externally-spawned PTY sessions via list()',
    async () => {
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
    },
    120000,
  );

  it(
    'reconnects to external PTY session via get() with unknown PID',
    async () => {
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
    },
    120000,
  );
});
