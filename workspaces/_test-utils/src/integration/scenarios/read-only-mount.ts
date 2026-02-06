/**
 * Read-only mount integration tests.
 *
 * Verifies that readOnly is enforced end-to-end.
 */

import { describe, it, expect } from 'vitest';

import type { WorkspaceSetup } from '../types';

interface TestContext {
  setup: WorkspaceSetup;
  getTestPath: () => string;
  mountPath: string;
  testTimeout: number;
  fastOnly: boolean;
}

export function createReadOnlyMountTests(getContext: () => TestContext): void {
  describe('Read-Only Mount', () => {
    it(
      'sandbox cannot write to read-only mounted filesystem',
      async () => {
        const { setup } = getContext();

        if (!setup.sandbox.executeCommand) return;

        // Find a read-only mount
        let readOnlyPath: string | undefined;
        if (setup.mounts) {
          for (const [path, fs] of Object.entries(setup.mounts)) {
            if (fs.readOnly) {
              readOnlyPath = path;
              break;
            }
          }
        } else if (setup.filesystem.readOnly) {
          readOnlyPath = '/';
        }

        if (!readOnlyPath) {
          // No read-only filesystem to test
          return;
        }

        // Attempt to write via sandbox - should fail
        const result = await setup.sandbox.executeCommand('sh', [
          '-c',
          `echo "test" > ${readOnlyPath}/readonly-test.txt`,
        ]);

        // Write should fail (non-zero exit code or permission denied in stderr)
        const writeFailed =
          result.exitCode !== 0 ||
          result.stderr.toLowerCase().includes('read-only') ||
          result.stderr.toLowerCase().includes('permission denied');

        expect(writeFailed).toBe(true);
      },
      getContext().testTimeout,
    );

    it(
      'sandbox can read from read-only mounted filesystem',
      async () => {
        const { setup } = getContext();

        if (!setup.sandbox.executeCommand) return;

        // This test requires pre-existing files in the read-only mount
        // Skip if no read-only mounts
        let readOnlyFs: { path: string; fs: typeof setup.filesystem } | undefined;
        if (setup.mounts) {
          for (const [path, fs] of Object.entries(setup.mounts)) {
            if (fs.readOnly) {
              readOnlyFs = { path, fs };
              break;
            }
          }
        } else if (setup.filesystem.readOnly) {
          readOnlyFs = { path: '/', fs: setup.filesystem };
        }

        if (!readOnlyFs) return;

        // Try to list the directory - this should work
        const result = await setup.sandbox.executeCommand('ls', [readOnlyFs.path]);

        // ls should succeed even on read-only filesystem
        expect(result.exitCode).toBe(0);
      },
      getContext().testTimeout,
    );
  });
}
