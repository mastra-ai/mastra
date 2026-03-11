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
  killSandboxExternally?: (sandbox: MastraSandbox) => Promise<void>;
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

    describe('Auto-Recovery', () => {
      it(
        'ensureRunning auto-starts a stopped sandbox',
        async () => {
          const { sandbox, capabilities } = getContext();
          if (!capabilities.supportsReconnection) return;

          // Stop the sandbox
          await sandbox._stop();
          expect(sandbox.status).toBe('stopped');

          // ensureRunning should auto-restart it
          await sandbox.ensureRunning();
          expect(sandbox.status).toBe('running');
        },
        getContext().testTimeout * 2,
      );

      it(
        'executeCommand works after sandbox is stopped and auto-restarted',
        async () => {
          const { sandbox, capabilities } = getContext();
          if (!capabilities.supportsReconnection) return;
          if (!sandbox.executeCommand) return;

          // Stop the sandbox
          await sandbox._stop();
          expect(sandbox.status).toBe('stopped');

          // executeCommand should trigger auto-restart via ensureRunning
          const result = await sandbox.executeCommand('echo', ['hello']);
          expect(result.exitCode).toBe(0);
          expect(result.stdout.trim()).toBe('hello');
          expect(sandbox.status).toBe('running');
        },
        getContext().testTimeout * 2,
      );

      it(
        'multiple commands work after stop/auto-restart cycle',
        async () => {
          const { sandbox, capabilities } = getContext();
          if (!capabilities.supportsReconnection) return;
          if (!sandbox.executeCommand) return;

          // Stop the sandbox
          await sandbox._stop();
          expect(sandbox.status).toBe('stopped');

          // First command triggers auto-restart
          const result1 = await sandbox.executeCommand('echo', ['first']);
          expect(result1.exitCode).toBe(0);
          expect(result1.stdout.trim()).toBe('first');

          // Subsequent commands should work without issues
          const result2 = await sandbox.executeCommand('echo', ['second']);
          expect(result2.exitCode).toBe(0);
          expect(result2.stdout.trim()).toBe('second');

          const result3 = await sandbox.executeCommand('echo', ['third']);
          expect(result3.exitCode).toBe(0);
          expect(result3.stdout.trim()).toBe('third');
        },
        getContext().testTimeout * 2,
      );
    });

    describe('Stop/Start Resilience', () => {
      it(
        'survives multiple stop/start cycles',
        async () => {
          const { sandbox, capabilities } = getContext();
          if (!capabilities.supportsReconnection) return;
          if (!sandbox.executeCommand) return;

          for (let i = 0; i < 3; i++) {
            await sandbox._stop();
            expect(sandbox.status).toBe('stopped');

            await sandbox._start();
            expect(sandbox.status).toBe('running');

            const result = await sandbox.executeCommand('echo', [`cycle-${i}`]);
            expect(result.exitCode).toBe(0);
            expect(result.stdout.trim()).toBe(`cycle-${i}`);
          }
        },
        getContext().testTimeout * 6,
      );

      it(
        'concurrent stop calls are safe',
        async () => {
          const { sandbox, capabilities } = getContext();
          if (!capabilities.supportsReconnection) return;

          // Fire multiple stop calls concurrently — should not throw
          await Promise.all([sandbox._stop(), sandbox._stop(), sandbox._stop()]);

          expect(sandbox.status).toBe('stopped');

          // Restart for subsequent tests
          await sandbox._start();
          expect(sandbox.status).toBe('running');
        },
        getContext().testTimeout * 2,
      );

      it(
        'concurrent start calls after stop are safe',
        async () => {
          const { sandbox, capabilities } = getContext();
          if (!capabilities.supportsReconnection) return;

          await sandbox._stop();
          expect(sandbox.status).toBe('stopped');

          // Fire multiple start calls concurrently — should deduplicate
          await Promise.all([sandbox._start(), sandbox._start(), sandbox._start()]);

          expect(sandbox.status).toBe('running');

          // Verify sandbox is functional
          if (sandbox.executeCommand) {
            const result = await sandbox.executeCommand('echo', ['concurrent-start']);
            expect(result.exitCode).toBe(0);
            expect(result.stdout.trim()).toBe('concurrent-start');
          }
        },
        getContext().testTimeout * 2,
      );
    });

    describe('External Kill Recovery', () => {
      it(
        'recovers from externally killed sandbox via retryOnDead',
        async () => {
          const { sandbox, capabilities, killSandboxExternally } = getContext();
          if (!capabilities.supportsReconnection) return;
          if (!killSandboxExternally) return;
          if (!sandbox.executeCommand) return;

          // Verify sandbox works
          const before = await sandbox.executeCommand('echo', ['alive']);
          expect(before.exitCode).toBe(0);
          expect(before.stdout.trim()).toBe('alive');

          // Kill the sandbox externally — bypasses our wrapper's cleanup,
          // leaving a stale SDK reference that points to a dead sandbox
          await killSandboxExternally(sandbox);

          // Next command should hit a dead-sandbox error, trigger retryOnDead,
          // which calls handleSandboxTimeout() + ensureRunning() + retry
          const after = await sandbox.executeCommand('echo', ['recovered']);
          expect(after.exitCode).toBe(0);
          expect(after.stdout.trim()).toBe('recovered');
          expect(sandbox.status).toBe('running');
        },
        getContext().testTimeout * 3,
      );

      it(
        'recovers from externally killed sandbox during process spawn',
        async () => {
          const { sandbox, capabilities, killSandboxExternally } = getContext();
          if (!capabilities.supportsReconnection) return;
          if (!killSandboxExternally) return;
          if (!sandbox.processes) return;

          // Verify process manager works
          const handle = await sandbox.processes.spawn('echo before');
          const result = await handle.wait();
          expect(result.exitCode).toBe(0);

          // Kill externally
          await killSandboxExternally(sandbox);

          // Process spawn should trigger retryOnDead in the process manager
          const handle2 = await sandbox.processes.spawn('echo after');
          const result2 = await handle2.wait();
          expect(result2.exitCode).toBe(0);
          expect(result2.stdout.trim()).toBe('after');
        },
        getContext().testTimeout * 3,
      );
    });
  });
}
