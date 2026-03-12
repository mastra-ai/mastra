/**
 * Write-read consistency integration tests.
 *
 * Verifies that reads immediately after writes return the expected data,
 * testing filesystem and FUSE cache behavior.
 */

import { describe, it, expect, afterEach } from 'vitest';

import { cleanupTestPath, waitFor } from '../../test-helpers';
import type { TestContext } from './test-context';

export function createWriteReadConsistencyTests(getContext: () => TestContext): void {
  describe('Write-Read Consistency', () => {
    afterEach(async () => {
      const { workspace, getTestPath } = getContext();
      if (workspace.filesystem) {
        await cleanupTestPath(workspace.filesystem, getTestPath());
      }
    });

    it(
      'immediate read-after-write',
      async () => {
        const { workspace, getTestPath } = getContext();
        if (!workspace.filesystem) return;

        const filePath = `${getTestPath()}/immediate-raw.txt`;
        const content = `immediate-${Date.now()}`;

        await workspace.filesystem.writeFile(filePath, content);
        const result = await workspace.filesystem.readFile(filePath, { encoding: 'utf-8' });

        expect(result).toBe(content);
      },
      getContext().testTimeout,
    );

    it(
      'overwrite then immediate read',
      async () => {
        const { workspace, getTestPath } = getContext();
        if (!workspace.filesystem) return;

        const filePath = `${getTestPath()}/overwrite-raw.txt`;

        await workspace.filesystem.writeFile(filePath, 'version-1');
        await workspace.filesystem.writeFile(filePath, 'version-2');

        const result = await workspace.filesystem.readFile(filePath, { encoding: 'utf-8' });
        expect(result).toBe('version-2');
      },
      getContext().testTimeout,
    );

    it(
      'delete then immediate exists returns false',
      async () => {
        const { workspace, getTestPath } = getContext();
        if (!workspace.filesystem) return;

        const filePath = `${getTestPath()}/delete-exists.txt`;

        await workspace.filesystem.writeFile(filePath, 'temporary');
        const existsBefore = await workspace.filesystem.exists(filePath);
        expect(existsBefore).toBe(true);

        await workspace.filesystem.deleteFile(filePath);
        const existsAfter = await workspace.filesystem.exists(filePath);
        expect(existsAfter).toBe(false);
      },
      getContext().testTimeout,
    );

    it(
      'rapid write-read cycles (10x)',
      async () => {
        const { workspace, getTestPath } = getContext();
        if (!workspace.filesystem) return;

        const filePath = `${getTestPath()}/rapid-cycle.txt`;

        for (let i = 0; i < 10; i++) {
          const content = `content-${i}`;
          await workspace.filesystem.writeFile(filePath, content);
          const result = await workspace.filesystem.readFile(filePath, { encoding: 'utf-8' });
          expect(result).toBe(content);
        }
      },
      getContext().testTimeout,
    );

    it(
      'API write then sandbox read is consistent',
      async () => {
        const ctx = getContext();
        const { workspace, getTestPath } = ctx;

        if (!ctx.sandboxPathsAligned) return;
        if (!workspace.filesystem || !workspace.sandbox?.executeCommand) return;

        const filePath = `${getTestPath()}/api-to-sandbox-consistency.txt`;
        const content = `api-write-${Date.now()}`;

        await workspace.filesystem.writeFile(filePath, content);

        // Read via sandbox command (same path — mountPath baked into getTestPath)
        const result = await workspace.sandbox.executeCommand('cat', [filePath]);
        expect(result.exitCode).toBe(0);
        expect(result.stdout.trim()).toBe(content);
      },
      getContext().testTimeout,
    );

    it(
      'sandbox write then API read is consistent',
      async () => {
        const ctx = getContext();
        const { workspace, getTestPath } = ctx;

        if (!ctx.sandboxPathsAligned) return;
        if (!workspace.filesystem || !workspace.sandbox?.executeCommand) return;

        const filePath = `${getTestPath()}/sandbox-to-api-consistency.txt`;
        const content = `sandbox-write-${Date.now()}`;

        // Ensure directory exists
        await workspace.sandbox.executeCommand('mkdir', ['-p', getTestPath()]);

        // Write via sandbox (same path — mountPath baked into getTestPath)
        // Use printf instead of echo -n for POSIX portability (macOS sh prints -n literally)
        const writeResult = await workspace.sandbox.executeCommand('sh', [
          '-c',
          `printf '%s' '${content}' > "${filePath}"`,
        ]);
        expect(writeResult.exitCode).toBe(0);

        // Poll via API until consistent (FUSE caching may cause delay)
        let apiContent: string | undefined;
        await waitFor(
          async () => {
            try {
              apiContent = (await workspace.filesystem!.readFile(filePath, { encoding: 'utf-8' })) as string;
              return apiContent === content;
            } catch {
              return false;
            }
          },
          10000,
          200,
        );

        expect(apiContent).toBe(content);
      },
      getContext().testTimeout,
    );
  });
}
