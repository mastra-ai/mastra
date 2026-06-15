/**
 * Upstash Box Sandbox Integration Tests
 *
 * These tests require a valid Upstash Box API key and run against the real Box
 * API. They are separated from unit tests to avoid mock conflicts.
 *
 * Required environment variables:
 * - UPSTASH_BOX_API_KEY: Box API key
 * - UPSTASH_BOX_BASE_URL: (optional) Box API base URL
 */

import { createSandboxTestSuite } from '@internal/workspace-test-utils';
import { describe, expect, it } from 'vitest';

import { UpstashBoxSandbox } from './index';

const hasCredentials = !!process.env.UPSTASH_BOX_API_KEY;

/**
 * Placeholder suite so the file always registers at least one suite. Without it,
 * vitest fails the file when credentials are missing and the conformance suite
 * is skipped.
 */
describe.skipIf(hasCredentials)('UpstashBoxSandbox Integration (skipped without credentials)', () => {
  it('requires UPSTASH_BOX_API_KEY', () => {});
});

/**
 * Shared Sandbox Conformance Tests
 *
 * Verify UpstashBoxSandbox conforms to the WorkspaceSandbox interface using the
 * shared suite from @internal/workspace-test-utils.
 */
if (hasCredentials) {
  createSandboxTestSuite({
    suiteName: 'UpstashBoxSandbox Conformance',
    createSandbox: options => {
      return new UpstashBoxSandbox({
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
      // Delete the box out-of-band so the next operation hits a 404 and the
      // provider's retry-on-dead path has to recreate it.
      await (sb as UpstashBoxSandbox).box.delete();
    },
    capabilities: {
      supportsMounting: false,
      supportsReconnection: true,
      supportsConcurrency: true,
      supportsEnvVars: true,
      supportsWorkingDirectory: true,
      supportsTimeout: true,
      supportsStreaming: true,
      supportsStdin: false, // Box exec does not expose stdin
      defaultCommandTimeout: 30000,
    },
    testTimeout: 120000,
  });
}

/**
 * Box-specific behaviors not covered by the shared conformance suite.
 */
describe.skipIf(!hasCredentials)('UpstashBoxSandbox box-specific', () => {
  it('fails the command when cwd does not exist (no silent fallback)', async () => {
    const sandbox = new UpstashBoxSandbox({ id: `cwd-test-${Date.now().toString(36)}`, runtime: 'node' });
    try {
      await sandbox._start();
      const handle = await sandbox.processes.spawn('pwd', { cwd: '/no/such/dir' });
      const result = await handle.wait();

      expect(result.success).toBe(false);
      expect(result.exitCode).not.toBe(0);
      // The cd error is surfaced on stderr rather than running in the default dir.
      expect(result.stderr.toLowerCase()).toMatch(/no such|can't cd|cannot/);
    } finally {
      await sandbox._destroy().catch(() => {});
    }
  }, 120000);
});
