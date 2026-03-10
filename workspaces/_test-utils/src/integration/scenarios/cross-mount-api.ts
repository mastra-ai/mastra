/**
 * Cross-mount API integration tests.
 *
 * Tests cross-mount copy and move operations through the CompositeFilesystem API.
 * Unlike cross-mount-copy.ts (sandbox-based), these tests work via the filesystem API
 * and don't require a sandbox.
 */

import { type CompositeFilesystem } from '@mastra/core/workspace';
import { describe, it, expect, afterEach } from 'vitest';

import type { TestContext } from './test-context';

export function createCrossMountApiTests(getContext: () => TestContext): void {
  describe('Cross-Mount API', () => {
    const cleanupFiles: Array<{ fs: CompositeFilesystem; path: string }> = [];

    afterEach(async () => {
      for (const { fs, path } of cleanupFiles) {
        try {
          await fs.deleteFile(path, { force: true });
        } catch {
          // Ignore cleanup errors
        }
      }
      cleanupFiles.length = 0;
    });

    it(
      'copyFile across mounts preserves content',
      async () => {
        const { workspace } = getContext();
        if (!workspace.filesystem) return;

        const composite = workspace.filesystem as CompositeFilesystem;
        const mountPaths = composite.mountPaths;
        if (mountPaths.length < 2) return;

        const mountA = mountPaths[0]!;
        const mountB = mountPaths[1]!;
        const content = `cross-copy-api-${Date.now()}`;
        const srcPath = `${mountA}/cross-api-src.txt`;
        const destPath = `${mountB}/cross-api-copied.txt`;

        await composite.writeFile(srcPath, content);
        cleanupFiles.push({ fs: composite, path: srcPath });

        await composite.copyFile(srcPath, destPath);
        cleanupFiles.push({ fs: composite, path: destPath });

        // Both files should exist
        expect(await composite.exists(srcPath)).toBe(true);
        expect(await composite.exists(destPath)).toBe(true);

        // Content should match
        const copiedContent = await composite.readFile(destPath, { encoding: 'utf-8' });
        expect(copiedContent).toBe(content);
      },
      getContext().testTimeout,
    );

    it(
      'moveFile across mounts removes source',
      async () => {
        const { workspace } = getContext();
        if (!workspace.filesystem) return;

        const composite = workspace.filesystem as CompositeFilesystem;
        const mountPaths = composite.mountPaths;
        if (mountPaths.length < 2) return;

        const mountA = mountPaths[0]!;
        const mountB = mountPaths[1]!;
        const content = `cross-move-api-${Date.now()}`;
        const srcPath = `${mountA}/cross-api-move-src.txt`;
        const destPath = `${mountB}/cross-api-moved.txt`;

        await composite.writeFile(srcPath, content);

        await composite.moveFile(srcPath, destPath);
        cleanupFiles.push({ fs: composite, path: destPath });

        // Source should be gone, dest should have correct content
        expect(await composite.exists(srcPath)).toBe(false);
        expect(await composite.exists(destPath)).toBe(true);

        const movedContent = await composite.readFile(destPath, { encoding: 'utf-8' });
        expect(movedContent).toBe(content);
      },
      getContext().testTimeout,
    );

    it(
      'cross-mount copy preserves binary content',
      async () => {
        const { workspace } = getContext();
        if (!workspace.filesystem) return;

        const composite = workspace.filesystem as CompositeFilesystem;
        const mountPaths = composite.mountPaths;
        if (mountPaths.length < 2) return;

        const mountA = mountPaths[0]!;
        const mountB = mountPaths[1]!;

        // Create binary content (random bytes)
        const binaryContent = Buffer.from(Array.from({ length: 256 }, (_, i) => i));
        const srcPath = `${mountA}/cross-binary-src.bin`;
        const destPath = `${mountB}/cross-binary-copied.bin`;

        await composite.writeFile(srcPath, binaryContent);
        cleanupFiles.push({ fs: composite, path: srcPath });

        await composite.copyFile(srcPath, destPath);
        cleanupFiles.push({ fs: composite, path: destPath });

        const copiedContent = await composite.readFile(destPath);
        const copiedBuffer = Buffer.isBuffer(copiedContent) ? copiedContent : Buffer.from(copiedContent as string);
        expect(copiedBuffer.equals(binaryContent)).toBe(true);
      },
      getContext().testTimeout,
    );

    it(
      'copyFile with overwrite: false to existing file throws',
      async () => {
        const { workspace } = getContext();
        if (!workspace.filesystem) return;

        const composite = workspace.filesystem as CompositeFilesystem;
        const mountPaths = composite.mountPaths;
        if (mountPaths.length < 2) return;

        const mountA = mountPaths[0]!;
        const mountB = mountPaths[1]!;
        const srcPath = `${mountA}/no-overwrite-src.txt`;
        const destPath = `${mountB}/no-overwrite-dest.txt`;

        await composite.writeFile(srcPath, 'source content');
        cleanupFiles.push({ fs: composite, path: srcPath });
        await composite.writeFile(destPath, 'existing content');
        cleanupFiles.push({ fs: composite, path: destPath });

        // Copy with overwrite: false should throw
        await expect(composite.copyFile(srcPath, destPath, { overwrite: false })).rejects.toThrow();

        // Existing content should be preserved
        const content = await composite.readFile(destPath, { encoding: 'utf-8' });
        expect(content).toBe('existing content');
      },
      getContext().testTimeout,
    );
  });
}
