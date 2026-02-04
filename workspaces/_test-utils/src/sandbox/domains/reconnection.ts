/**
 * Reconnection test domain.
 * Tests: sandbox reconnection capabilities
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

export function createReconnectionTests(getContext: () => TestContext): void {
  describe('Reconnection', () => {
    it('getInfo returns sandbox id for reconnection', async () => {
      const { sandbox, capabilities } = getContext();
      if (!capabilities.supportsReconnection) return;
      if (!sandbox.getInfo) return;

      const info = await sandbox.getInfo();

      // For providers that support reconnection, they should expose a sandbox ID
      expect(info.id).toBeDefined();
    }, getContext().testTimeout);

    // Note: Full reconnection tests require creating a new sandbox instance
    // with the same ID and verifying state is preserved. These are better
    // done as provider-specific tests or integration tests.
  });
}
