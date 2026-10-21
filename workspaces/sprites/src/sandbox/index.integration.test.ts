/**
 * Sprites Sandbox Integration Tests
 *
 * These tests create and delete real Sprites. They are opt-in and skipped
 * unless a token is available.
 *
 * Required environment variables:
 * - SPRITES_TOKEN: Sprites API token
 */

import { createSandboxTestSuite } from '@internal/workspace-test-utils';
import { afterAll, describe, expect, it } from 'vitest';

import { SpritesSandbox } from './index';

const hasSpritesCredentials = !!process.env.SPRITES_TOKEN;

const uniqueName = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * Placeholder suite so the file always registers at least one suite. Without it,
 * vitest fails the file when credentials are missing and every other suite is skipped.
 */
describe.skipIf(hasSpritesCredentials)('SpritesSandbox Integration (skipped without credentials)', () => {
  it('requires SPRITES_TOKEN', () => {});
});

if (hasSpritesCredentials) {
  createSandboxTestSuite({
    suiteName: 'SpritesSandbox Conformance',
    createSandbox: options => {
      return new SpritesSandbox({
        id: uniqueName('mastra-conformance'),
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
    capabilities: {
      supportsMounting: false,
      supportsReconnection: true,
      supportsConcurrency: true,
      supportsEnvVars: true,
      supportsWorkingDirectory: true,
      supportsTimeout: true,
      supportsStdin: true,
      defaultCommandTimeout: 30000,
    },
    testTimeout: 180000,
  });

  describe('SpritesSandbox filesystem reuse', () => {
    const id = uniqueName('mastra-reuse');
    const cleanup = new SpritesSandbox({ id });

    afterAll(async () => {
      await cleanup.destroy();
    }, 180000);

    it('keeps files when a new instance reconnects to the same Sprite', async () => {
      const first = new SpritesSandbox({ id });
      await expect(first._start()).resolves.toEqual({ outcome: 'created' });
      const write = await first.executeCommand!('sh', ['-c', 'echo persisted > /tmp/mastra-reuse.txt']);
      expect(write.success).toBe(true);
      await first._stop();

      const second = new SpritesSandbox({ id });
      await expect(second._start()).resolves.toEqual({ outcome: 'connected' });
      const read = await second.executeCommand!('cat', ['/tmp/mastra-reuse.txt']);
      expect(read.stdout.trim()).toBe('persisted');
      await second._stop();
    }, 180000);
  });
}
