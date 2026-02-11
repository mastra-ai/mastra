/**
 * Concurrent operations integration tests.
 *
 * Verifies that parallel file reads and writes do not corrupt data
 * or produce unexpected errors.
 */

import { describe, it, expect, afterEach } from 'vitest';

import { cleanupTestPath } from '../../test-helpers';
import type { WorkspaceSetup } from '../types';

interface TestContext {
  setup: WorkspaceSetup;
  getTestPath: () => string;
  /** Mount path prefix for sandbox commands (e.g. '/data/s3'). Empty string if paths match. */
  mountPath: string;
  testTimeout: number;
  fastOnly: boolean;
}

export function createConcurrentOperationsTests(getContext: () => TestContext): void {
  describe('Concurrent Operations', () => {
    afterEach(async () => {
      const { setup, getTestPath } = getContext();
      await cleanupTestPath(setup.filesystem, getTestPath());
    });

    it(
      'concurrent writes via API do not corrupt',
      async () => {
        const { setup, getTestPath } = getContext();
        const basePath = getTestPath();
        const files = Array.from({ length: 5 }, (_, i) => ({
          path: `${basePath}/concurrent-write-${i}.txt`,
          content: `content-for-file-${i}-${Date.now()}`,
        }));

        // Write all 5 files concurrently
        await Promise.all(files.map(f => setup.filesystem.writeFile(f.path, f.content)));

        // Read each back and verify
        for (const f of files) {
          const data = await setup.filesystem.readFile(f.path, { encoding: 'utf-8' });
          expect(data).toBe(f.content);
        }
      },
      getContext().testTimeout,
    );

    it(
      'concurrent reads via API return correct content',
      async () => {
        const { setup, getTestPath } = getContext();
        const basePath = getTestPath();
        const files = Array.from({ length: 5 }, (_, i) => ({
          path: `${basePath}/concurrent-read-${i}.txt`,
          content: `read-content-${i}-${Date.now()}`,
        }));

        // Write sequentially first
        for (const f of files) {
          await setup.filesystem.writeFile(f.path, f.content);
        }

        // Read all 5 concurrently
        const results = await Promise.all(files.map(f => setup.filesystem.readFile(f.path, { encoding: 'utf-8' })));

        for (let i = 0; i < files.length; i++) {
          expect(results[i]).toBe(files[i]!.content);
        }
      },
      getContext().testTimeout,
    );

    it(
      'interleaved API write and sandbox read',
      async () => {
        const { setup, getTestPath, mountPath } = getContext();

        if (!setup.sandbox.executeCommand) return;

        const basePath = getTestPath();
        const files = Array.from({ length: 5 }, (_, i) => ({
          fsPath: `${basePath}/interleaved-${i}.txt`,
          sandboxPath: `${mountPath}${basePath}/interleaved-${i}.txt`,
          content: `interleaved-${i}-${Date.now()}`,
        }));

        // Write all via API
        await Promise.all(files.map(f => setup.filesystem.writeFile(f.fsPath, f.content)));

        // Read all via sandbox concurrently
        const results = await Promise.all(files.map(f => setup.sandbox.executeCommand!('cat', [f.sandboxPath])));

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
        const { setup, getTestPath } = getContext();
        const filePath = `${getTestPath()}/same-file-concurrent.txt`;
        const contents = Array.from({ length: 5 }, (_, i) => `version-${i}-${Date.now()}`);

        // Write all 5 versions concurrently to the same path
        await Promise.all(contents.map(c => setup.filesystem.writeFile(filePath, c)));

        // Read back — result should be one of the 5 versions (last-write-wins)
        const result = await setup.filesystem.readFile(filePath, { encoding: 'utf-8' });
        expect(contents).toContain(result);
      },
      getContext().testTimeout,
    );
  });
}
