/**
 * Mount isolation integration tests.
 *
 * Verifies that operations on one mount do not affect another mount.
 * These tests operate through the CompositeFilesystem API — no sandbox needed.
 */

import { type CompositeFilesystem } from '@mastra/core/workspace';
import { describe, it, expect, afterEach } from 'vitest';

import type { TestContext } from './test-context';

export function createMountIsolationTests(getContext: () => TestContext): void {
  describe('Mount Isolation', () => {
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
      'write to mount-a is not visible via exists on mount-b',
      async () => {
        const { workspace } = getContext();
        if (!workspace.filesystem) return;

        const composite = workspace.filesystem as CompositeFilesystem;
        const mountPaths = composite.mountPaths;
        if (mountPaths.length < 2) return;

        const mountA = mountPaths[0]!;
        const mountB = mountPaths[1]!;
        const fileName = `isolation-exists-${Date.now()}.txt`;

        await composite.writeFile(`${mountA}/${fileName}`, 'mount-a content');
        cleanupFiles.push({ fs: composite, path: `${mountA}/${fileName}` });

        // File should exist in mount-a
        expect(await composite.exists(`${mountA}/${fileName}`)).toBe(true);

        // File should NOT exist in mount-b at the same relative path
        expect(await composite.exists(`${mountB}/${fileName}`)).toBe(false);
      },
      getContext().testTimeout,
    );

    it(
      'delete from mount-a does not affect mount-b',
      async () => {
        const { workspace } = getContext();
        if (!workspace.filesystem) return;

        const composite = workspace.filesystem as CompositeFilesystem;
        const mountPaths = composite.mountPaths;
        if (mountPaths.length < 2) return;

        const mountA = mountPaths[0]!;
        const mountB = mountPaths[1]!;
        const fileName = `isolation-delete-${Date.now()}.txt`;

        // Write same-named file to both mounts
        await composite.writeFile(`${mountA}/${fileName}`, 'mount-a content');
        await composite.writeFile(`${mountB}/${fileName}`, 'mount-b content');
        cleanupFiles.push({ fs: composite, path: `${mountB}/${fileName}` });

        // Delete from mount-a
        await composite.deleteFile(`${mountA}/${fileName}`);

        // mount-a file should be gone
        expect(await composite.exists(`${mountA}/${fileName}`)).toBe(false);

        // mount-b file should still exist with correct content
        expect(await composite.exists(`${mountB}/${fileName}`)).toBe(true);
        const content = await composite.readFile(`${mountB}/${fileName}`, { encoding: 'utf-8' });
        expect(content).toBe('mount-b content');
      },
      getContext().testTimeout,
    );

    it(
      'readdir on mount-a does not include mount-b files',
      async () => {
        const { workspace } = getContext();
        if (!workspace.filesystem) return;

        const composite = workspace.filesystem as CompositeFilesystem;
        const mountPaths = composite.mountPaths;
        if (mountPaths.length < 2) return;

        const mountA = mountPaths[0]!;
        const mountB = mountPaths[1]!;
        const fileNameA = `isolation-readdir-a-${Date.now()}.txt`;
        const fileNameB = `isolation-readdir-b-${Date.now()}.txt`;

        await composite.writeFile(`${mountA}/${fileNameA}`, 'a');
        cleanupFiles.push({ fs: composite, path: `${mountA}/${fileNameA}` });
        await composite.writeFile(`${mountB}/${fileNameB}`, 'b');
        cleanupFiles.push({ fs: composite, path: `${mountB}/${fileNameB}` });

        // readdir mount-a should include fileNameA but not fileNameB
        const entriesA = await composite.readdir(mountA);
        const namesA = entriesA.map(e => e.name);
        expect(namesA).toContain(fileNameA);
        expect(namesA).not.toContain(fileNameB);

        // readdir mount-b should include fileNameB but not fileNameA
        const entriesB = await composite.readdir(mountB);
        const namesB = entriesB.map(e => e.name);
        expect(namesB).toContain(fileNameB);
        expect(namesB).not.toContain(fileNameA);
      },
      getContext().testTimeout,
    );
  });
}
