/**
 * Virtual directory integration tests.
 *
 * Verifies that the CompositeFilesystem correctly reports virtual entries
 * for mount points when listing the root and querying mount paths.
 */

import { type CompositeFilesystem } from '@mastra/core/workspace';
import { describe, it, expect } from 'vitest';

import type { TestContext } from './test-context';

export function createVirtualDirectoryTests(getContext: () => TestContext): void {
  describe('Virtual Directory', () => {
    it(
      'readdir root returns entries for each mount',
      async () => {
        const { workspace } = getContext();
        if (!workspace.filesystem) return;

        const composite = workspace.filesystem as CompositeFilesystem;
        const mountPaths = composite.mountPaths;
        if (mountPaths.length < 2) return;

        const entries = await composite.readdir('/');
        const names = entries.map(e => e.name);

        // Each mount path (e.g. '/mount-a') should appear as entry name 'mount-a'
        for (const mp of mountPaths) {
          const mountName = mp.replace(/^\//, '');
          expect(names).toContain(mountName);
        }

        // All entries should be directories
        for (const entry of entries) {
          expect(entry.type).toBe('directory');
        }
      },
      getContext().testTimeout,
    );

    it(
      'exists returns true for root and mount point paths',
      async () => {
        const { workspace } = getContext();
        if (!workspace.filesystem) return;

        const composite = workspace.filesystem as CompositeFilesystem;
        const mountPaths = composite.mountPaths;
        if (mountPaths.length < 2) return;

        // Root always exists
        expect(await composite.exists('/')).toBe(true);

        // Each mount path exists
        for (const mp of mountPaths) {
          expect(await composite.exists(mp)).toBe(true);
        }
      },
      getContext().testTimeout,
    );

    it(
      'stat on mount path returns directory type',
      async () => {
        const { workspace } = getContext();
        if (!workspace.filesystem) return;

        const composite = workspace.filesystem as CompositeFilesystem;
        const mountPaths = composite.mountPaths;
        if (mountPaths.length < 2) return;

        for (const mp of mountPaths) {
          const stat = await composite.stat(mp);
          expect(stat.type).toBe('directory');
        }
      },
      getContext().testTimeout,
    );

    it(
      'isDirectory and isFile return correct values for mount paths',
      async () => {
        const { workspace } = getContext();
        if (!workspace.filesystem) return;

        const composite = workspace.filesystem as CompositeFilesystem;
        const mountPaths = composite.mountPaths;
        if (mountPaths.length < 2) return;

        for (const mp of mountPaths) {
          expect(await composite.isDirectory(mp)).toBe(true);
          expect(await composite.isFile(mp)).toBe(false);
        }
      },
      getContext().testTimeout,
    );

    it(
      'virtual entries include mount metadata',
      async () => {
        const { workspace } = getContext();
        if (!workspace.filesystem) return;

        const composite = workspace.filesystem as CompositeFilesystem;
        const mountPaths = composite.mountPaths;
        if (mountPaths.length < 2) return;

        const entries = await composite.readdir('/');

        // At least some entries should have mount metadata
        const entriesWithMount = entries.filter(e => e.mount);
        expect(entriesWithMount.length).toBeGreaterThan(0);

        // Mount metadata should include provider
        for (const entry of entriesWithMount) {
          expect(entry.mount!.provider).toBeDefined();
          expect(typeof entry.mount!.provider).toBe('string');
        }
      },
      getContext().testTimeout,
    );
  });
}
