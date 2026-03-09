/**
 * Mount routing integration tests.
 *
 * Verifies that operations are routed to the correct mount based on path.
 * These tests operate through the CompositeFilesystem API — no sandbox needed.
 */

import { type CompositeFilesystem } from '@mastra/core/workspace';
import { describe, it, expect, afterEach } from 'vitest';

import type { TestContext } from './test-context';

export function createMountRoutingTests(getContext: () => TestContext): void {
  describe('Mount Routing', () => {
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
      'write to first mount and read back correct content',
      async () => {
        const { workspace } = getContext();
        if (!workspace.filesystem) return;

        const composite = workspace.filesystem as CompositeFilesystem;
        const mountPaths = composite.mountPaths;
        if (mountPaths.length < 2) return;

        const mountA = mountPaths[0]!;
        const content = `mount-a-content-${Date.now()}`;
        const filePath = `${mountA}/routing-test-a.txt`;

        await composite.writeFile(filePath, content);
        cleanupFiles.push({ fs: composite, path: filePath });

        const result = await composite.readFile(filePath, { encoding: 'utf-8' });
        expect(result).toBe(content);
      },
      getContext().testTimeout,
    );

    it(
      'write to second mount and read back correct content',
      async () => {
        const { workspace } = getContext();
        if (!workspace.filesystem) return;

        const composite = workspace.filesystem as CompositeFilesystem;
        const mountPaths = composite.mountPaths;
        if (mountPaths.length < 2) return;

        const mountB = mountPaths[1]!;
        const content = `mount-b-content-${Date.now()}`;
        const filePath = `${mountB}/routing-test-b.txt`;

        await composite.writeFile(filePath, content);
        cleanupFiles.push({ fs: composite, path: filePath });

        const result = await composite.readFile(filePath, { encoding: 'utf-8' });
        expect(result).toBe(content);
      },
      getContext().testTimeout,
    );

    it(
      'stat returns correct metadata for files in each mount',
      async () => {
        const { workspace } = getContext();
        if (!workspace.filesystem) return;

        const composite = workspace.filesystem as CompositeFilesystem;
        const mountPaths = composite.mountPaths;
        if (mountPaths.length < 2) return;

        const mountA = mountPaths[0]!;
        const content = 'stat-routing-test';
        const filePath = `${mountA}/stat-routing.txt`;

        await composite.writeFile(filePath, content);
        cleanupFiles.push({ fs: composite, path: filePath });

        const stat = await composite.stat(filePath);
        expect(stat.type).toBe('file');
        expect(stat.size).toBeGreaterThan(0);
      },
      getContext().testTimeout,
    );

    it(
      'exists returns correct value for files in each mount',
      async () => {
        const { workspace } = getContext();
        if (!workspace.filesystem) return;

        const composite = workspace.filesystem as CompositeFilesystem;
        const mountPaths = composite.mountPaths;
        if (mountPaths.length < 2) return;

        const mountA = mountPaths[0]!;
        const mountB = mountPaths[1]!;
        const content = 'exists-routing-test';

        // Write to mount-a
        const filePath = `${mountA}/exists-routing.txt`;
        await composite.writeFile(filePath, content);
        cleanupFiles.push({ fs: composite, path: filePath });

        // Should exist in mount-a
        expect(await composite.exists(filePath)).toBe(true);

        // Should NOT exist at same relative path in mount-b
        expect(await composite.exists(`${mountB}/exists-routing.txt`)).toBe(false);
      },
      getContext().testTimeout,
    );

    it(
      'readdir within a mount lists only that mount files',
      async () => {
        const { workspace } = getContext();
        if (!workspace.filesystem) return;

        const composite = workspace.filesystem as CompositeFilesystem;
        const mountPaths = composite.mountPaths;
        if (mountPaths.length < 2) return;

        const mountA = mountPaths[0]!;
        const mountB = mountPaths[1]!;

        // Write files to both mounts
        await composite.writeFile(`${mountA}/readdir-a.txt`, 'a');
        cleanupFiles.push({ fs: composite, path: `${mountA}/readdir-a.txt` });
        await composite.writeFile(`${mountB}/readdir-b.txt`, 'b');
        cleanupFiles.push({ fs: composite, path: `${mountB}/readdir-b.txt` });

        // readdir mount-a should include readdir-a.txt but not readdir-b.txt
        const entriesA = await composite.readdir(mountA);
        const namesA = entriesA.map(e => e.name);
        expect(namesA).toContain('readdir-a.txt');
        expect(namesA).not.toContain('readdir-b.txt');

        // readdir mount-b should include readdir-b.txt but not readdir-a.txt
        const entriesB = await composite.readdir(mountB);
        const namesB = entriesB.map(e => e.name);
        expect(namesB).toContain('readdir-b.txt');
        expect(namesB).not.toContain('readdir-a.txt');
      },
      getContext().testTimeout,
    );
  });
}
