/**
 * Boat Sandbox Integration Tests
 *
 * These run against real Boat sandboxes and are separated from the unit tests
 * so mocks never leak into them.
 *
 * Required environment variables:
 * - BOAT_API_KEY: Boat API key (dashboard → API keys)
 * - BOAT_BASE_URL: optional, defaults to https://boat.dev/api/v1
 */

import { createSandboxTestSuite } from '@internal/workspace-test-utils';
import { describe, expect, it } from 'vitest';

import { BoatSandbox } from './index';

const hasBoatCredentials = !!process.env.BOAT_API_KEY;

/**
 * Placeholder suite so the file always registers at least one suite. Without it,
 * vitest fails the file when credentials are missing and every other suite is skipped.
 */
describe.skipIf(hasBoatCredentials)('BoatSandbox Integration (skipped without credentials)', () => {
  it('requires BOAT_API_KEY', () => {});
});

/**
 * Shared Sandbox Conformance Tests
 *
 * These verify BoatSandbox conforms to the WorkspaceSandbox interface, using
 * the shared suite from @internal/workspace-test-utils.
 */
if (hasBoatCredentials) {
  createSandboxTestSuite({
    suiteName: 'BoatSandbox Conformance',
    createSandbox: options =>
      new BoatSandbox({
        id: `conformance-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        // Small machines are half price and ample for the suite; a short TTL
        // means an abandoned sandbox costs minutes, not an hour.
        machineType: 'small',
        ttlSeconds: 1800,
        ...(options?.env && { env: options.env }),
      }),
    createInvalidSandbox: () => new BoatSandbox({ apiKey: 'sandbox_definitely_invalid', ttlSeconds: 1800 }),
    cleanupSandbox: async sandbox => {
      try {
        await sandbox._destroy();
      } catch {
        // Ignore cleanup errors
      }
    },
    // Boat archives rather than destroys, which is exactly the state a TTL
    // expiry leaves behind — so this exercises the recovery path that matters.
    killSandboxExternally: async sandbox => {
      const boatSandbox = sandbox as BoatSandbox;
      await boatSandbox.boat.stop({ sandboxId: boatSandbox.boatSandboxId });
    },
    capabilities: {
      supportsMounting: false, // No FUSE helper is provisioned on Boat machines
      supportsReconnection: true,
      supportsConcurrency: true,
      supportsEnvVars: true,
      supportsWorkingDirectory: true,
      supportsTimeout: true,
      supportsStreaming: true, // Polled from the detached command's log tail
      supportsStdin: false, // Boat's command API has no stdin transport
      supportsCloseStdin: false,
    },
    testTimeout: 60_000,
  });

  describe('BoatSandbox Boat-specific integration', () => {
    it('exposes a service on a public HTTPS URL', async () => {
      const sandbox = new BoatSandbox({ machineType: 'small', ttlSeconds: 900, publicPorts: true });
      try {
        await sandbox._start();
        // Must bind 0.0.0.0: Boat's route reaches the sandbox from outside the
        // application process, so a localhost listener is unreachable.
        await sandbox.processes.spawn('python3 -m http.server 8080 --bind 0.0.0.0');

        const url = await sandbox.networking.getPortUrl(8080);

        expect(url).toMatch(/^https:\/\/.+-8080\.on\.boat\.dev/);
        expect(url).not.toContain('_token');
      } finally {
        await sandbox._destroy().catch(() => {});
      }
    }, 120_000);

    it('saves a named snapshot and boots a new sandbox from it', async () => {
      const checkpointName = `mastra-conformance-${Date.now().toString(36)}`;
      const first = new BoatSandbox({ machineType: 'small', ttlSeconds: 900, checkpointName });
      try {
        await first._start();
        await first.writeFiles([{ path: '/home/user/checkpoint-marker.txt', content: 'persisted' }]);
        await first.snapshot();
      } finally {
        await first._destroy().catch(() => {});
      }

      const second = new BoatSandbox({ machineType: 'small', ttlSeconds: 900, checkpointName });
      try {
        await second._start();
        const result = await second.executeCommand!('cat', ['/home/user/checkpoint-marker.txt']);

        expect(result.stdout).toContain('persisted');
      } finally {
        await second._destroy().catch(() => {});
      }
    }, 300_000);

    it('forks a sandbox without touching the source', async () => {
      const source = new BoatSandbox({ machineType: 'small', ttlSeconds: 900 });
      let forked: BoatSandbox | undefined;
      try {
        await source._start();
        await source.writeFiles([{ path: '/home/user/fork-marker.txt', content: 'from source' }]);

        forked = await source.fork();
        const result = await forked.executeCommand!('cat', ['/home/user/fork-marker.txt']);

        expect(result.stdout).toContain('from source');
        expect(forked.boatSandboxId).not.toBe(source.boatSandboxId);
      } finally {
        await forked?._destroy().catch(() => {});
        await source._destroy().catch(() => {});
      }
    }, 300_000);
  });
}
