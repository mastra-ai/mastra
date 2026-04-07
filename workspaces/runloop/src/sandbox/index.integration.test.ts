/**
 * Runloop Sandbox integration tests — require RUNLOOP_API_KEY.
 */

import { createSandboxTestSuite } from '@internal/workspace-test-utils';

import { RunloopSandbox } from './index';

if (process.env.RUNLOOP_API_KEY) {
  createSandboxTestSuite({
    suiteName: 'RunloopSandbox Conformance',
    createSandbox: options =>
      new RunloopSandbox({
        id: `conformance-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        apiKey: process.env.RUNLOOP_API_KEY,
        timeout: 120_000,
        ...(options?.env && { env: options.env }),
      }),
    createInvalidSandbox: () =>
      new RunloopSandbox({
        id: `bad-config-${Date.now()}`,
        apiKey: process.env.RUNLOOP_API_KEY!,
        blueprintId: 'bp_nonexistent_mastra_00000000',
      }),
    cleanupSandbox: async sandbox => {
      try {
        await sandbox._destroy();
      } catch {
        // ignore
      }
    },
    killSandboxExternally: async sb => {
      await (sb as RunloopSandbox).shutdownRunloopDevboxOnly();
    },
    capabilities: {
      supportsMounting: false,
      supportsReconnection: true,
      supportsConcurrency: true,
      supportsEnvVars: true,
      supportsWorkingDirectory: true,
      supportsTimeout: true,
      supportsStreaming: true,
      supportsStdin: true,
      defaultCommandTimeout: 30_000,
    },
    testTimeout: 120_000,
  });
}
