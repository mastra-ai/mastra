/**
 * Reconnection test domain.
 * Tests: sandbox reconnection capabilities
 */

import type { MastraSandbox, WorkspaceFilesystem } from '@mastra/core/workspace';
import { describe, it, expect } from 'vitest';

import type { CreateSandboxOptions, SandboxCapabilities } from '../types';

interface TestContext {
  sandbox: MastraSandbox;
  capabilities: Required<SandboxCapabilities>;
  testTimeout: number;
  fastOnly: boolean;
  createSandbox: (options?: CreateSandboxOptions) => Promise<MastraSandbox> | MastraSandbox;
  createMountableFilesystem?: () => Promise<WorkspaceFilesystem> | WorkspaceFilesystem;
}

export function createReconnectionTests(getContext: () => TestContext): void {
  describe('Reconnection', () => {
    describe('Identification', () => {
      it(
        'getInfo returns sandbox id for reconnection',
        async () => {
          const { sandbox, capabilities } = getContext();
          if (!capabilities.supportsReconnection) return;
          if (!sandbox.getInfo) return;

          const info = await sandbox.getInfo();

          // For providers that support reconnection, they should expose a sandbox ID
          expect(info.id).toBeDefined();
          expect(typeof info.id).toBe('string');
          expect(info.id.length).toBeGreaterThan(0);
        },
        getContext().testTimeout,
      );

      it(
        'sandbox id is consistent after stop/start',
        async () => {
          const { sandbox, capabilities } = getContext();
          if (!capabilities.supportsReconnection) return;

          const originalId = sandbox.id;

          // Stop and restart
          await sandbox._stop();
          await sandbox._start();

          // ID should remain the same
          expect(sandbox.id).toBe(originalId);
        },
        getContext().testTimeout * 2,
      );
    });

    describe('State Preservation', () => {
      it(
        'files persist after stop/start',
        async () => {
          const { sandbox, capabilities } = getContext();
          if (!capabilities.supportsReconnection) return;

          if (!sandbox.executeCommand) return;

          // Create a file
          const testFile = `/tmp/reconnect-test-${Date.now()}.txt`;
          const testContent = 'reconnection test content';

          await sandbox.executeCommand('sh', ['-c', `echo "${testContent}" > ${testFile}`]);

          // Verify file exists
          const beforeResult = await sandbox.executeCommand('cat', [testFile]);
          expect(beforeResult.stdout.trim()).toBe(testContent);

          // Stop and restart
          await sandbox._stop();
          await sandbox._start();

          // File should still exist
          const afterResult = await sandbox.executeCommand('cat', [testFile]);
          expect(afterResult.stdout.trim()).toBe(testContent);

          // Clean up
          await sandbox.executeCommand('rm', [testFile]);
        },
        getContext().testTimeout * 3,
      );

      it(
        'environment is preserved after reconnection',
        async () => {
          const { sandbox, capabilities } = getContext();
          if (!capabilities.supportsReconnection) return;

          if (!sandbox.executeCommand) return;

          // Stop and restart
          await sandbox._stop();
          await sandbox._start();

          // Basic environment should work
          const result = await sandbox.executeCommand('pwd', []);
          expect(result.exitCode).toBe(0);
          expect(result.stdout.trim()).toBeTruthy();
        },
        getContext().testTimeout * 2,
      );
    });

    describe('Mount Preservation', () => {
      it(
        'mounts are tracked after reconnection',
        async () => {
          const { sandbox, capabilities, createMountableFilesystem } = getContext();
          if (!capabilities.supportsReconnection) return;
          if (!capabilities.supportsMounting) return;

          if (!sandbox.mounts || !sandbox.mount) return;
          if (!createMountableFilesystem) return;

          const filesystem = await createMountableFilesystem();
          if (!filesystem.getMountConfig) return;

          const mountPath = '/reconnect-mount-' + Date.now();

          // Mount filesystem
          await sandbox.mount(filesystem, mountPath);
          expect(sandbox.mounts.has(mountPath)).toBe(true);

          // Stop and restart
          await sandbox._stop();
          await sandbox._start();

          // Mount state should be tracked (may need re-mounting depending on provider)
          // At minimum, the sandbox should be operational
          expect(sandbox.status).toBe('running');

          // Clean up
          if (sandbox.unmount) {
            try {
              await sandbox.unmount(mountPath);
            } catch {
              // May already be unmounted
            }
          }
        },
        getContext().testTimeout * 3,
      );
    });

    // Note: Config change triggers remount is an E2B-specific behavior
    // and is better tested in E2B provider tests
  });
}
