/**
 * Mount operations test domain.
 * Tests: mount(), unmount(), mount state management
 */

import type { MastraSandbox, WorkspaceFilesystem } from '@mastra/core/workspace';
import { describe, it, expect } from 'vitest';

import type { SandboxCapabilities } from '../types';

interface TestContext {
  sandbox: MastraSandbox;
  capabilities: Required<SandboxCapabilities>;
  testTimeout: number;
  fastOnly: boolean;
  /** Optional: filesystem with getMountConfig() for mount tests */
  createMountableFilesystem?: () => Promise<WorkspaceFilesystem> | WorkspaceFilesystem;
}

export function createMountOperationsTests(getContext: () => TestContext): void {
  describe('Mount Operations', () => {
    describe('Mounts Property', () => {
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

      it(
        'getInfo includes mounts array when mounting is supported',
        async () => {
          const { sandbox, capabilities } = getContext();
          if (!capabilities.supportsMounting) return;
          if (!sandbox.getInfo) return;

          const info = await sandbox.getInfo();

          expect(info.mounts).toBeDefined();
          expect(Array.isArray(info.mounts)).toBe(true);
        },
        getContext().testTimeout,
      );
    });

    describe('mount()', () => {
      it(
        'mounts filesystem at specified path',
        async () => {
          const { sandbox, capabilities, createMountableFilesystem } = getContext();
          if (!capabilities.supportsMounting) return;
          if (!sandbox.mount) return;
          if (!createMountableFilesystem) return;

          const filesystem = await createMountableFilesystem();

          // Skip if filesystem doesn't support mounting
          if (!filesystem.getMountConfig) return;

          const mountPath = '/test-mount-' + Date.now();
          const result = await sandbox.mount(filesystem, mountPath);

          expect(result.success).toBe(true);
          expect(result.mountPath).toBe(mountPath);

          // Clean up
          if (sandbox.unmount) {
            await sandbox.unmount(mountPath);
          }
        },
        getContext().testTimeout,
      );

      it(
        'mount returns MountResult with success and mountPath',
        async () => {
          const { sandbox, capabilities, createMountableFilesystem } = getContext();
          if (!capabilities.supportsMounting) return;
          if (!sandbox.mount) return;
          if (!createMountableFilesystem) return;

          const filesystem = await createMountableFilesystem();
          if (!filesystem.getMountConfig) return;

          const mountPath = '/test-mount-result-' + Date.now();
          const result = await sandbox.mount(filesystem, mountPath);

          // MountResult should have required fields
          expect(result).toHaveProperty('success');
          expect(result).toHaveProperty('mountPath');
          expect(typeof result.success).toBe('boolean');
          expect(typeof result.mountPath).toBe('string');

          // Clean up
          if (sandbox.unmount) {
            await sandbox.unmount(mountPath);
          }
        },
        getContext().testTimeout,
      );
    });

    describe('unmount()', () => {
      it(
        'unmounts previously mounted filesystem',
        async () => {
          const { sandbox, capabilities, createMountableFilesystem } = getContext();
          if (!capabilities.supportsMounting) return;
          if (!sandbox.mount || !sandbox.unmount) return;
          if (!createMountableFilesystem) return;

          const filesystem = await createMountableFilesystem();
          if (!filesystem.getMountConfig) return;

          const mountPath = '/test-unmount-' + Date.now();

          // Mount first
          await sandbox.mount(filesystem, mountPath);

          // Then unmount - should not throw
          await expect(sandbox.unmount(mountPath)).resolves.not.toThrow();

          // Verify mount was actually removed from tracking
          if (sandbox.mounts) {
            expect(sandbox.mounts.has(mountPath)).toBe(false);
          }
        },
        getContext().testTimeout,
      );
    });

    describe('Mount State Tracking', () => {
      it(
        'mounts.has() returns true after mounting',
        async () => {
          const { sandbox, capabilities, createMountableFilesystem } = getContext();
          if (!capabilities.supportsMounting) return;
          if (!sandbox.mount || !sandbox.mounts) return;
          if (!createMountableFilesystem) return;

          const filesystem = await createMountableFilesystem();
          if (!filesystem.getMountConfig) return;

          const mountPath = '/test-has-' + Date.now();

          await sandbox.mount(filesystem, mountPath);

          expect(sandbox.mounts.has(mountPath)).toBe(true);

          // Clean up
          if (sandbox.unmount) {
            await sandbox.unmount(mountPath);
          }
        },
        getContext().testTimeout,
      );

      it(
        'mounts.has() returns false after unmounting',
        async () => {
          const { sandbox, capabilities, createMountableFilesystem } = getContext();
          if (!capabilities.supportsMounting) return;
          if (!sandbox.mount || !sandbox.unmount || !sandbox.mounts) return;
          if (!createMountableFilesystem) return;

          const filesystem = await createMountableFilesystem();
          if (!filesystem.getMountConfig) return;

          const mountPath = '/test-has-unmount-' + Date.now();

          await sandbox.mount(filesystem, mountPath);
          await sandbox.unmount(mountPath);

          expect(sandbox.mounts.has(mountPath)).toBe(false);
        },
        getContext().testTimeout,
      );

      it(
        'mounts.get() returns entry with mounted state',
        async () => {
          const { sandbox, capabilities, createMountableFilesystem } = getContext();
          if (!capabilities.supportsMounting) return;
          if (!sandbox.mount || !sandbox.mounts) return;
          if (!createMountableFilesystem) return;

          const filesystem = await createMountableFilesystem();
          if (!filesystem.getMountConfig) return;

          const mountPath = '/test-get-' + Date.now();

          await sandbox.mount(filesystem, mountPath);

          const entry = sandbox.mounts.get(mountPath);
          expect(entry).toBeDefined();
          expect(entry?.state).toBe('mounted');

          // Clean up
          if (sandbox.unmount) {
            await sandbox.unmount(mountPath);
          }
        },
        getContext().testTimeout,
      );
    });

    // Note: More comprehensive mount tests (S3, GCS, error cases) are better
    // done in provider-specific tests or integration tests with real filesystems
  });
}
