/**
 * Write-read consistency integration tests.
 *
 * Verifies that reads immediately after writes return the expected data,
 * testing filesystem and FUSE cache behavior.
 */

import { describe, it, expect, afterEach } from 'vitest';

import { cleanupTestPath, waitFor } from '../../test-helpers';
import type { WorkspaceSetup } from '../types';

interface TestContext {
  setup: WorkspaceSetup;
  getTestPath: () => string;
  /** Mount path prefix for sandbox commands (e.g. '/data/s3'). Empty string if paths match. */
  mountPath: string;
  testTimeout: number;
  fastOnly: boolean;
}

export function createWriteReadConsistencyTests(getContext: () => TestContext): void {
  describe('Write-Read Consistency', () => {
    afterEach(async () => {
      const { setup, getTestPath } = getContext();
      await cleanupTestPath(setup.filesystem, getTestPath());
    });

    it(
      'immediate read-after-write',
      async () => {
        const { setup, getTestPath } = getContext();
        const filePath = `${getTestPath()}/immediate-raw.txt`;
        const content = `immediate-${Date.now()}`;

        await setup.filesystem.writeFile(filePath, content);
        const result = await setup.filesystem.readFile(filePath, { encoding: 'utf-8' });

        expect(result).toBe(content);
      },
      getContext().testTimeout,
    );

    it(
      'overwrite then immediate read',
      async () => {
        const { setup, getTestPath } = getContext();
        const filePath = `${getTestPath()}/overwrite-raw.txt`;

        await setup.filesystem.writeFile(filePath, 'version-1');
        await setup.filesystem.writeFile(filePath, 'version-2');

        const result = await setup.filesystem.readFile(filePath, { encoding: 'utf-8' });
        expect(result).toBe('version-2');
      },
      getContext().testTimeout,
    );

    it(
      'delete then immediate exists returns false',
      async () => {
        const { setup, getTestPath } = getContext();
        const filePath = `${getTestPath()}/delete-exists.txt`;

        await setup.filesystem.writeFile(filePath, 'temporary');
        const existsBefore = await setup.filesystem.exists(filePath);
        expect(existsBefore).toBe(true);

        await setup.filesystem.deleteFile(filePath);
        const existsAfter = await setup.filesystem.exists(filePath);
        expect(existsAfter).toBe(false);
      },
      getContext().testTimeout,
    );

    it(
      'rapid write-read cycles (10x)',
      async () => {
        const { setup, getTestPath } = getContext();
        const filePath = `${getTestPath()}/rapid-cycle.txt`;

        for (let i = 0; i < 10; i++) {
          const content = `content-${i}`;
          await setup.filesystem.writeFile(filePath, content);
          const result = await setup.filesystem.readFile(filePath, { encoding: 'utf-8' });
          expect(result).toBe(content);
        }
      },
      getContext().testTimeout,
    );

    it(
      'API write then sandbox read is consistent',
      async () => {
        const { setup, getTestPath, mountPath } = getContext();

        if (!setup.sandbox.executeCommand) return;

        const fsPath = `${getTestPath()}/api-to-sandbox-consistency.txt`;
        const sandboxPath = `${mountPath}${fsPath}`;
        const content = `api-write-${Date.now()}`;

        await setup.filesystem.writeFile(fsPath, content);

        const result = await setup.sandbox.executeCommand('cat', [sandboxPath]);
        expect(result.exitCode).toBe(0);
        expect(result.stdout.trim()).toBe(content);
      },
      getContext().testTimeout,
    );

    it(
      'sandbox write then API read is consistent',
      async () => {
        const { setup, getTestPath, mountPath } = getContext();

        if (!setup.sandbox.executeCommand) return;

        const fsPath = `${getTestPath()}/sandbox-to-api-consistency.txt`;
        const sandboxPath = `${mountPath}${fsPath}`;
        const content = `sandbox-write-${Date.now()}`;

        // Ensure directory exists
        await setup.sandbox.executeCommand('mkdir', ['-p', `${mountPath}${getTestPath()}`]);

        // Write via sandbox
        const writeResult = await setup.sandbox.executeCommand('sh', ['-c', `echo -n "${content}" > ${sandboxPath}`]);
        expect(writeResult.exitCode).toBe(0);

        // Poll via API until consistent (FUSE caching may cause delay)
        let apiContent: string | undefined;
        await waitFor(
          async () => {
            try {
              apiContent = (await setup.filesystem.readFile(fsPath, { encoding: 'utf-8' })) as string;
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
