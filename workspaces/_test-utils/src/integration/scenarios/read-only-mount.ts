/**
 * Read-only mount integration tests.
 *
 * Verifies that readOnly is enforced end-to-end.
 */

import { type CompositeFilesystem } from '@mastra/core/workspace';
import { describe, it, expect } from 'vitest';

import type { TestContext } from './test-context';

export function createReadOnlyMountTests(getContext: () => TestContext): void {
  describe('Read-Only Mount', () => {
    it(
      'sandbox cannot write to read-only mounted filesystem',
      async () => {
        const { workspace } = getContext();

        if (!workspace.sandbox?.executeCommand) return;

        // Find a read-only mount
        let readOnlyPath: string | undefined;
        const composite = workspace.filesystem as CompositeFilesystem | undefined;
        if (composite?.mounts) {
          for (const [path, fs] of composite.mounts) {
            if (fs.readOnly) {
              readOnlyPath = path;
              break;
            }
          }
        } else if (workspace.filesystem?.readOnly) {
          readOnlyPath = '/';
        }

        if (!readOnlyPath) {
          // No read-only filesystem to test
          return;
        }

        // Attempt to write via sandbox - should fail
        const result = await workspace.sandbox.executeCommand('sh', [
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
        const { workspace } = getContext();

        if (!workspace.sandbox?.executeCommand) return;

        // This test requires pre-existing files in the read-only mount
        // Skip if no read-only mounts
        let readOnlyFs: { path: string; fs: NonNullable<typeof workspace.filesystem> } | undefined;
        const composite = workspace.filesystem as CompositeFilesystem | undefined;
        if (composite?.mounts) {
          for (const [path, fs] of composite.mounts) {
            if (fs.readOnly) {
              readOnlyFs = { path, fs };
              break;
            }
          }
        } else if (workspace.filesystem?.readOnly) {
          readOnlyFs = { path: '/', fs: workspace.filesystem };
        }

        if (!readOnlyFs) return;

        // Try to list the directory - this should work
        const result = await workspace.sandbox.executeCommand('ls', [readOnlyFs.path]);

        // ls should succeed even on read-only filesystem
        expect(result.exitCode).toBe(0);
      },
      getContext().testTimeout,
    );
  });
}
