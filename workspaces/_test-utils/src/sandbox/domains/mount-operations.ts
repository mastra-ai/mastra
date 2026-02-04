/**
 * Mount operations test domain.
 * Tests: mount(), unmount(), mount state management
 */

import type { WorkspaceSandbox } from '@mastra/core/workspace';
import { describe, it, expect } from 'vitest';

import type { SandboxCapabilities } from '../types';

interface TestContext {
  sandbox: WorkspaceSandbox;
  capabilities: Required<SandboxCapabilities>;
  testTimeout: number;
  fastOnly: boolean;
}

export function createMountOperationsTests(getContext: () => TestContext): void {
  describe('Mount Operations', () => {
    it('has mounts property when mounting is supported', () => {
      const { sandbox, capabilities } = getContext();
      if (!capabilities.supportsMounting) return;

      expect(sandbox.mounts).toBeDefined();
    });

    it('mounts.entries returns a Map', () => {
      const { sandbox, capabilities } = getContext();
      if (!capabilities.supportsMounting) return;
      if (!sandbox.mounts) return;

      expect(sandbox.mounts.entries).toBeInstanceOf(Map);
    });

    it('getInfo includes mounts array when mounting is supported', async () => {
      const { sandbox, capabilities } = getContext();
      if (!capabilities.supportsMounting) return;
      if (!sandbox.getInfo) return;

      const info = await sandbox.getInfo();

      expect(info.mounts).toBeDefined();
      expect(Array.isArray(info.mounts)).toBe(true);
    }, getContext().testTimeout);

    // Note: Actual mounting tests require filesystem providers with getMountConfig()
    // Those are better tested in integration tests with real providers
  });
}
