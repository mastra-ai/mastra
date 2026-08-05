/**
 * Railway Sandbox Integration Tests
 *
 * These tests require real Railway API access and run against actual Railway sandboxes.
 * They are separated from unit tests to avoid mock conflicts.
 *
 * Required environment variables:
 * - RAILWAY_API_TOKEN: Railway API token
 * - RAILWAY_ENVIRONMENT_ID: Railway environment ID
 */

import { createSandboxTestSuite } from '@internal/workspace-test-utils';
import { describe, it } from 'vitest';

import { RailwaySandbox } from './index';

const hasRailwayCredentials = !!(process.env.RAILWAY_API_TOKEN && process.env.RAILWAY_ENVIRONMENT_ID);

/**
 * Placeholder suite so the file always registers at least one suite. Without it,
 * vitest fails the file when credentials are missing and every other suite is skipped.
 */
describe.skipIf(hasRailwayCredentials)('RailwaySandbox Integration (skipped without credentials)', () => {
  it('requires RAILWAY_API_TOKEN and RAILWAY_ENVIRONMENT_ID', () => {});
});

/**
 * Shared Sandbox Conformance Tests
 *
 * These tests verify RailwaySandbox conforms to the WorkspaceSandbox interface.
 * They use the shared test suite from @internal/workspace-test-utils.
 */
if (hasRailwayCredentials) {
  createSandboxTestSuite({
    suiteName: 'RailwaySandbox Conformance',
    createSandbox: options => {
      return new RailwaySandbox({
        id: `conformance-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timeout: 120000,
        ...(options?.env && { env: options.env }),
      });
    },
    cleanupSandbox: async sandbox => {
      try {
        await sandbox._destroy();
      } catch {
        // Ignore cleanup errors
      }
    },
    killSandboxExternally: async sb => {
      await (sb as RailwaySandbox).railway.destroy();
    },
    capabilities: {
      supportsMounting: false,
      supportsReconnection: true,
      supportsConcurrency: true,
      supportsEnvVars: true,
      supportsWorkingDirectory: true,
      supportsTimeout: true,
      supportsStdin: false, // Railway SDK does not support stdin
      defaultCommandTimeout: 30000,
    },
    testTimeout: 120000,
  });
}
