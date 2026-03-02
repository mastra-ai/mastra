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
