/**
 * Concurrent operations integration tests.
 *
 * Verifies that parallel file reads and writes do not corrupt data
 * or produce unexpected errors.
 */

import { describe, it, expect, afterEach } from 'vitest';

import { cleanupTestPath } from '../../test-helpers';
import type { TestContext } from './test-context';

export function createConcurrentOperationsTests(getContext: () => TestContext): void {
  describe('Concurrent Operations', () => {
    afterEach(async () => {
      const { workspace, getTestPath } = getContext();
      if (workspace.filesystem) {
        await cleanupTestPath(workspace.filesystem, getTestPath());
      }
    });

    it(
      'concurrent writes via API do not corrupt',
      async () => {
        const { workspace, getTestPath } = getContext();
        if (!workspace.filesystem) return;

        const basePath = getTestPath();
        const files = Array.from({ length: 5 }, (_, i) => ({
          path: `${basePath}/concurrent-write-${i}.txt`,
          content: `content-for-file-${i}-${Date.now()}`,
        }));

        // Write all 5 files concurrently
        await Promise.all(files.map(f => workspace.filesystem!.writeFile(f.path, f.content)));

        // Read each back and verify
        for (const f of files) {
          const data = await workspace.filesystem.readFile(f.path, { encoding: 'utf-8' });
          expect(data).toBe(f.content);
        }
      },
      getContext().testTimeout,
    );

    it(
      'concurrent reads via API return correct content',
      async () => {
        const { workspace, getTestPath } = getContext();
        if (!workspace.filesystem) return;

        const basePath = getTestPath();
        const files = Array.from({ length: 5 }, (_, i) => ({
          path: `${basePath}/concurrent-read-${i}.txt`,
          content: `read-content-${i}-${Date.now()}`,
        }));

        // Write sequentially first
        for (const f of files) {
          await workspace.filesystem.writeFile(f.path, f.content);
        }

        // Read all 5 concurrently
        const results = await Promise.all(
          files.map(f => workspace.filesystem!.readFile(f.path, { encoding: 'utf-8' })),
        );

        for (let i = 0; i < files.length; i++) {
          expect(results[i]).toBe(files[i]!.content);
        }
      },
      getContext().testTimeout,
    );

    it(
      'interleaved API write and sandbox read',
      async () => {
        const ctx = getContext();
        const { workspace, getTestPath } = ctx;

        if (!ctx.sandboxPathsAligned) return;
        if (!workspace.filesystem || !workspace.sandbox?.executeCommand) return;

        const basePath = getTestPath();
        const files = Array.from({ length: 5 }, (_, i) => ({
          path: `${basePath}/interleaved-${i}.txt`,
          content: `interleaved-${i}-${Date.now()}`,
        }));

        // Write all via API
        await Promise.all(files.map(f => workspace.filesystem!.writeFile(f.path, f.content)));

        // Read all via sandbox concurrently (same path — mountPath baked into getTestPath)
        const results = await Promise.all(files.map(f => workspace.sandbox!.executeCommand!('cat', [f.path])));

        for (let i = 0; i < files.length; i++) {
          expect(results[i]!.exitCode).toBe(0);
          expect(results[i]!.stdout.trim()).toBe(files[i]!.content);
        }
      },
      getContext().testTimeout,
    );

    it(
      'concurrent writes to same file are last-write-wins',
      async () => {
        const { workspace, getTestPath } = getContext();
        if (!workspace.filesystem) return;

        const filePath = `${getTestPath()}/same-file-concurrent.txt`;
        const contents = Array.from({ length: 5 }, (_, i) => `version-${i}-${Date.now()}`);

        // Write all 5 versions concurrently to the same path
        await Promise.all(contents.map(c => workspace.filesystem!.writeFile(filePath, c)));

        // Read back — result should be one of the 5 versions (last-write-wins)
        const result = await workspace.filesystem.readFile(filePath, { encoding: 'utf-8' });
        expect(contents).toContain(result);
      },
      getContext().testTimeout,
    );
  });
}
