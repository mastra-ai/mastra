/**
 * Sandbox lifecycle test domain.
 * Tests: start, stop, destroy, status transitions, getInfo
 */

import type { MastraSandbox } from '@mastra/core/workspace';
import { describe, it, expect } from 'vitest';

import type { CreateSandboxOptions, SandboxCapabilities } from '../types';

interface TestContext {
  sandbox: MastraSandbox;
  capabilities: Required<SandboxCapabilities>;
  testTimeout: number;
  fastOnly: boolean;
  /** Factory to create additional sandbox instances for uniqueness/lifecycle tests */
  createSandbox: (options?: CreateSandboxOptions) => Promise<MastraSandbox> | MastraSandbox;
}

export function createSandboxLifecycleTests(getContext: () => TestContext): void {
  describe('Lifecycle', () => {
    describe('Identification', () => {
      it('has required identification properties', () => {
        const { sandbox } = getContext();

        expect(sandbox.id).toBeDefined();
        expect(typeof sandbox.id).toBe('string');
        expect(sandbox.name).toBeDefined();
        expect(typeof sandbox.name).toBe('string');
        expect(sandbox.provider).toBeDefined();
        expect(typeof sandbox.provider).toBe('string');
        expect(sandbox.status).toBeDefined();
        expect(typeof sandbox.status).toBe('string');
      });

      it(
        'id is unique per instance',
        async () => {
          const { sandbox, createSandbox, fastOnly } = getContext();

          // Skip in fast mode - creating additional sandbox is slow
          if (fastOnly) return;

          const sandbox2 = await createSandbox();
          try {
            expect(sandbox.id).not.toBe(sandbox2.id);
          } finally {
            // Clean up the second sandbox
            await sandbox2._destroy();
          }
        },
        getContext().testTimeout * 2,
      );
    });

    describe('Status Transitions', () => {
      it(
        'status starts as pending or stopped before start()',
        async () => {
          const { createSandbox, fastOnly } = getContext();

          // Skip in fast mode - creating additional sandbox is slow
          if (fastOnly) return;

          const freshSandbox = await createSandbox();
          try {
            // Before start(), status should be pending or stopped
            expect(['pending', 'stopped']).toContain(freshSandbox.status);
          } finally {
            await freshSandbox._destroy();
          }
        },
        getContext().testTimeout * 2,
      );

      it('status is running after start', () => {
        const { sandbox } = getContext();

        // The factory calls start() in beforeAll
        expect(sandbox.status).toBe('running');
      });

      it(
        'start() is idempotent - calling twice does not error',
        async () => {
          const { sandbox } = getContext();

          // Sandbox is already running from beforeAll
          // Calling start() again should not throw
          await expect(sandbox._start()).resolves.not.toThrow();

          // Status should still be running
          expect(sandbox.status).toBe('running');
        },
        getContext().testTimeout,
      );

      it(
        'stop() changes status to stopped',
        async () => {
          const { createSandbox, fastOnly } = getContext();

          // Skip in fast mode - creating additional sandbox is slow
          if (fastOnly) return;

          const freshSandbox = await createSandbox();
          try {
            // Start the sandbox
            await freshSandbox._start();
            expect(freshSandbox.status).toBe('running');

            // Stop it
            await freshSandbox._stop();
            expect(freshSandbox.status).toBe('stopped');
          } finally {
            await freshSandbox._destroy();
          }
        },
        getContext().testTimeout * 3,
      );
    });

    describe('Readiness', () => {
      it(
        'isReady returns true when running',
        async () => {
          const { sandbox } = getContext();

          if (!sandbox.isReady) return;

          const ready = await sandbox.isReady();
          expect(ready).toBe(true);
        },
        getContext().testTimeout,
      );

      it(
        'isReady returns false when stopped',
        async () => {
          const { createSandbox, fastOnly } = getContext();

          // Skip in fast mode - creating additional sandbox is slow
          if (fastOnly) return;

          const freshSandbox = await createSandbox();
          try {
            // Before start, should not be ready
            if (freshSandbox.isReady) {
              const ready = await freshSandbox.isReady();
              expect(ready).toBe(false);
            }
          } finally {
            await freshSandbox._destroy();
          }
        },
        getContext().testTimeout * 2,
      );
    });

    describe('getInfo', () => {
      it(
        'returns sandbox information',
        async () => {
          const { sandbox } = getContext();

          if (!sandbox.getInfo) return;

          const info = await sandbox.getInfo();

          expect(info).toBeDefined();
          expect(info.id).toBe(sandbox.id);
          expect(info.name).toBe(sandbox.name);
          expect(info.provider).toBe(sandbox.provider);
          expect(info.status).toBe('running');
        },
        getContext().testTimeout,
      );

      it(
        'getInfo status matches sandbox status',
        async () => {
          const { sandbox } = getContext();

          if (!sandbox.getInfo) return;

          const info = await sandbox.getInfo();
          expect(info.status).toBe(sandbox.status);
        },
        getContext().testTimeout,
      );
    });
  });
}
