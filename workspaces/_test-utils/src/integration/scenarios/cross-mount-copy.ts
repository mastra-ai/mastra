/**
 * Cross-mount copy integration tests.
 *
 * Tests copying files between different mounts via sandbox commands.
 */

import { type CompositeFilesystem } from '@mastra/core/workspace';
import { describe, it, expect } from 'vitest';

import type { TestContext } from './test-context';

export function createCrossMountCopyTests(getContext: () => TestContext): void {
  describe('Cross-Mount Copy', () => {
    it(
      'copy file from one mount to another via sandbox',
      async () => {
        const ctx = getContext();
        const { workspace } = ctx;
        if (!ctx.sandboxPathsAligned) return;
        if (!workspace.filesystem) return;
        if (!workspace.sandbox?.executeCommand) return;

        const composite = workspace.filesystem as CompositeFilesystem;
        const mountPaths = composite.mountPaths;
        if (mountPaths.length < 2) return;

        const srcMount = mountPaths[0]!;
        const destMount = mountPaths[1]!;
        const srcFs = composite.mounts.get(srcMount)!;
        const destFs = composite.mounts.get(destMount)!;

        // Skip if either mount is read-only
        if (srcFs.readOnly || destFs.readOnly) return;

        const content = 'cross-mount content';

        // Write source file
        await srcFs.writeFile('/cross-copy-src.txt', content);

        // Copy via sandbox
        const result = await workspace.sandbox.executeCommand('cp', [
          `${srcMount}/cross-copy-src.txt`,
          `${destMount}/cross-copy-dest.txt`,
        ]);

        expect(result.exitCode).toBe(0);

        // Verify copy in destination
        const destContent = await destFs.readFile('/cross-copy-dest.txt', { encoding: 'utf-8' });
        expect(destContent).toBe(content);

        // Cleanup
        await srcFs.deleteFile('/cross-copy-src.txt', { force: true });
        await destFs.deleteFile('/cross-copy-dest.txt', { force: true });
      },
      getContext().testTimeout,
    );

    it(
      'move file from one mount to another via sandbox',
      async () => {
        const ctx = getContext();
        const { workspace } = ctx;
        if (!ctx.sandboxPathsAligned) return;
        if (!workspace.filesystem) return;
        if (!workspace.sandbox?.executeCommand) return;

        const composite = workspace.filesystem as CompositeFilesystem;
        const mountPaths = composite.mountPaths;
        if (mountPaths.length < 2) return;

        const srcMount = mountPaths[0]!;
        const destMount = mountPaths[1]!;
        const srcFs = composite.mounts.get(srcMount)!;
        const destFs = composite.mounts.get(destMount)!;

        // Skip if either mount is read-only
        if (srcFs.readOnly || destFs.readOnly) return;

        const content = 'move-me content';

        // Write source file
        await srcFs.writeFile('/cross-move-src.txt', content);

        // Move via sandbox
        const result = await workspace.sandbox.executeCommand('mv', [
          `${srcMount}/cross-move-src.txt`,
          `${destMount}/cross-move-dest.txt`,
        ]);

        expect(result.exitCode).toBe(0);

        // Verify file moved
        const srcExists = await srcFs.exists('/cross-move-src.txt');
        const destContent = await destFs.readFile('/cross-move-dest.txt', { encoding: 'utf-8' });

        expect(srcExists).toBe(false);
        expect(destContent).toBe(content);

        // Cleanup
        await destFs.deleteFile('/cross-move-dest.txt', { force: true });
      },
      getContext().testTimeout,
    );
  });
}
