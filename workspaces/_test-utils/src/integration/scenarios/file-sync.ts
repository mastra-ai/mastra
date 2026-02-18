/**
 * File sync integration tests.
 *
 * Verifies that files written via filesystem API are accessible
 * via sandbox commands and vice versa.
 */

import { describe, it, expect, afterEach } from 'vitest';

import { cleanupTestPath } from '../../test-helpers';
import type { TestContext } from './test-context';

export function createFileSyncTests(getContext: () => TestContext): void {
  describe('File Sync', () => {
    afterEach(async () => {
      const { workspace, getTestPath } = getContext();
      if (workspace.filesystem) {
        await cleanupTestPath(workspace.filesystem, getTestPath());
      }
    });

    it(
      'file written via API is readable via sandbox cat',
      async () => {
        const { workspace, getTestPath } = getContext();
        const filePath = `${getTestPath()}/api-to-sandbox.txt`;
        const content = 'Hello from API!';

        if (!workspace.filesystem || !workspace.sandbox?.executeCommand) {
          return; // Sandbox doesn't support command execution
        }

        // Write via filesystem API
        await workspace.filesystem.writeFile(filePath, content);

        // Read via sandbox command (same path — mountPath baked into getTestPath)
        const result = await workspace.sandbox.executeCommand('cat', [filePath]);

        expect(result.exitCode).toBe(0);
        expect(result.stdout.trim()).toBe(content);
      },
      getContext().testTimeout,
    );

    it(
      'file written via sandbox is readable via API',
      async () => {
        const { workspace, getTestPath } = getContext();
        const filePath = `${getTestPath()}/sandbox-to-api.txt`;
        const content = 'Hello from sandbox!';

        if (!workspace.filesystem || !workspace.sandbox?.executeCommand) {
          return; // Sandbox doesn't support command execution
        }

        // Ensure directory exists via sandbox
        const mkdirResult = await workspace.sandbox.executeCommand('mkdir', ['-p', getTestPath()]);
        expect(mkdirResult.exitCode).toBe(0);

        // Write via sandbox command
        const writeResult = await workspace.sandbox.executeCommand('sh', ['-c', `echo "${content}" > ${filePath}`]);
        expect(writeResult.exitCode).toBe(0);

        // Read via filesystem API (same path — mountPath baked into getTestPath)
        const readContent = await workspace.filesystem.readFile(filePath, { encoding: 'utf-8' });

        expect((readContent as string).trim()).toBe(content);
      },
      getContext().testTimeout,
    );

    it(
      'directory created via API is listable via sandbox ls',
      async () => {
        const { workspace, getTestPath } = getContext();
        const dirPath = `${getTestPath()}/test-dir`;
        const filePath = `${dirPath}/file.txt`;

        if (!workspace.filesystem || !workspace.sandbox?.executeCommand) {
          return; // Sandbox doesn't support command execution
        }

        // Create directory and file via API
        await workspace.filesystem.mkdir(dirPath, { recursive: true });
        await workspace.filesystem.writeFile(filePath, 'content');

        // List via sandbox command (same path)
        const result = await workspace.sandbox.executeCommand('ls', [dirPath]);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('file.txt');
      },
      getContext().testTimeout,
    );

    it(
      'file deleted via API is not accessible via sandbox',
      async () => {
        const { workspace, getTestPath } = getContext();
        const filePath = `${getTestPath()}/delete-me.txt`;

        if (!workspace.filesystem || !workspace.sandbox?.executeCommand) {
          return; // Sandbox doesn't support command execution
        }

        // Create file via API
        await workspace.filesystem.writeFile(filePath, 'delete me');

        // Verify it exists via sandbox
        const beforeResult = await workspace.sandbox.executeCommand('cat', [filePath]);
        expect(beforeResult.exitCode).toBe(0);

        // Delete via API
        await workspace.filesystem.deleteFile(filePath);

        // Verify it's gone (cat should fail)
        const afterResult = await workspace.sandbox.executeCommand('cat', [filePath]);
        expect(afterResult.exitCode).not.toBe(0);
      },
      getContext().testTimeout,
    );
  });
}
