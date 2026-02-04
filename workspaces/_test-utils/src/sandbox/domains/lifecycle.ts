/**
 * Sandbox lifecycle test domain.
 * Tests: start, stop, destroy, status transitions
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

export function createSandboxLifecycleTests(getContext: () => TestContext): void {
  describe('Lifecycle', () => {
    it('has required identification properties', () => {
      const { sandbox } = getContext();

      expect(sandbox.id).toBeDefined();
      expect(typeof sandbox.id).toBe('string');
      expect(sandbox.name).toBeDefined();
      expect(typeof sandbox.name).toBe('string');
      expect(sandbox.provider).toBeDefined();
      expect(typeof sandbox.provider).toBe('string');
    });

    it('status is running after start', () => {
      const { sandbox } = getContext();

      // The factory calls start() in beforeAll
      expect(sandbox.status).toBe('running');
    });

    it('isReady returns true when running', async () => {
      const { sandbox } = getContext();

      if (!sandbox.isReady) return;

      const ready = await sandbox.isReady();
      expect(ready).toBe(true);
    }, getContext().testTimeout);

    it('getInfo returns sandbox information', async () => {
      const { sandbox } = getContext();

      if (!sandbox.getInfo) return;

      const info = await sandbox.getInfo();

      expect(info).toBeDefined();
      expect(info.id).toBe(sandbox.id);
      expect(info.status).toBe('running');
    }, getContext().testTimeout);
  });
}
