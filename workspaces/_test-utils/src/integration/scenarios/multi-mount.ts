/**
 * Multi-mount integration tests.
 *
 * Tests multiple filesystems mounted at different paths.
 */

import { type CompositeFilesystem } from '@mastra/core/workspace';
import { describe, it, expect } from 'vitest';

import type { TestContext } from './test-context';

export function createMultiMountTests(getContext: () => TestContext): void {
  describe('Multi-Mount', () => {
    it(
      'files in different mounts are isolated',
      async () => {
        const { workspace } = getContext();
        if (!workspace.filesystem) return;

        const composite = workspace.filesystem as CompositeFilesystem;
        const mountPaths = composite.mountPaths;
        if (mountPaths.length < 2) return;

        const mount1 = mountPaths[0]!;
        const mount2 = mountPaths[1]!;
        const fs1 = composite.mounts.get(mount1)!;
        const fs2 = composite.mounts.get(mount2)!;

        // Write to first mount
        await fs1.writeFile('/test-file.txt', 'mount1 content');

        // Should not exist in second mount
        const existsInMount2 = await fs2.exists('/test-file.txt');
        expect(existsInMount2).toBe(false);

        // Cleanup
        await fs1.deleteFile('/test-file.txt', { force: true });
      },
      getContext().testTimeout,
    );

    it(
      'sandbox can access files from multiple mounts',
      async () => {
        const ctx = getContext();
        const { workspace } = ctx;
        if (!ctx.sandboxPathsAligned) return;
        if (!workspace.filesystem) return;
        if (!workspace.sandbox?.executeCommand) return;

        const composite = workspace.filesystem as CompositeFilesystem;
        const mountPaths = composite.mountPaths;
        if (mountPaths.length < 2) return;

        const mount1Path = mountPaths[0]!;
        const mount2Path = mountPaths[1]!;
        const fs1 = composite.mounts.get(mount1Path)!;
        const fs2 = composite.mounts.get(mount2Path)!;

        // Write to both mounts
        await fs1.writeFile('/multi-test1.txt', 'content from mount1');
        await fs2.writeFile('/multi-test2.txt', 'content from mount2');

        // Read both via sandbox
        const result1 = await workspace.sandbox.executeCommand('cat', [`${mount1Path}/multi-test1.txt`]);
        const result2 = await workspace.sandbox.executeCommand('cat', [`${mount2Path}/multi-test2.txt`]);

        expect(result1.exitCode).toBe(0);
        expect(result1.stdout.trim()).toBe('content from mount1');
        expect(result2.exitCode).toBe(0);
        expect(result2.stdout.trim()).toBe('content from mount2');

        // Cleanup
        await fs1.deleteFile('/multi-test1.txt', { force: true });
        await fs2.deleteFile('/multi-test2.txt', { force: true });
      },
      getContext().testTimeout,
    );
  });
}
