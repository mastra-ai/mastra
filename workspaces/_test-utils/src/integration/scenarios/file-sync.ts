/**
 * File sync integration tests.
 *
 * Verifies that files written via filesystem API are accessible
 * via sandbox commands and vice versa.
 */

import { describe, it, expect, afterEach } from 'vitest';

import { cleanupTestPath } from '../../test-helpers';
import type { WorkspaceSetup } from '../types';

interface TestContext {
  setup: WorkspaceSetup;
  getTestPath: () => string;
  testTimeout: number;
  fastOnly: boolean;
}

export function createFileSyncTests(getContext: () => TestContext): void {
  describe('File Sync', () => {
    afterEach(async () => {
      const { setup, getTestPath } = getContext();
      await cleanupTestPath(setup.filesystem, getTestPath());
    });

    it('file written via API is readable via sandbox cat', async () => {
      const { setup, getTestPath } = getContext();
      const path = `${getTestPath()}/api-to-sandbox.txt`;
      const content = 'Hello from API!';

      if (!setup.sandbox.executeCommand) {
        return; // Sandbox doesn't support command execution
      }

      // Write via filesystem API
      await setup.filesystem.writeFile(path, content);

      // Read via sandbox command
      const result = await setup.sandbox.executeCommand('cat', [path]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe(content);
    }, getContext().testTimeout);

    it('file written via sandbox is readable via API', async () => {
      const { setup, getTestPath } = getContext();
      const path = `${getTestPath()}/sandbox-to-api.txt`;
      const content = 'Hello from sandbox!';

      if (!setup.sandbox.executeCommand) {
        return; // Sandbox doesn't support command execution
      }

      // Ensure directory exists
      await setup.filesystem.mkdir(getTestPath(), { recursive: true });

      // Write via sandbox command
      const writeResult = await setup.sandbox.executeCommand('sh', [
        '-c',
        `echo "${content}" > ${path}`,
      ]);
      expect(writeResult.exitCode).toBe(0);

      // Read via filesystem API
      const readContent = await setup.filesystem.readFile(path, { encoding: 'utf-8' });

      expect((readContent as string).trim()).toBe(content);
    }, getContext().testTimeout);

    it('directory created via API is listable via sandbox ls', async () => {
      const { setup, getTestPath } = getContext();
      const dirPath = `${getTestPath()}/test-dir`;
      const filePath = `${dirPath}/file.txt`;

      if (!setup.sandbox.executeCommand) {
        return; // Sandbox doesn't support command execution
      }

      // Create directory and file via API
      await setup.filesystem.mkdir(dirPath, { recursive: true });
      await setup.filesystem.writeFile(filePath, 'content');

      // List via sandbox command
      const result = await setup.sandbox.executeCommand('ls', [dirPath]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('file.txt');
    }, getContext().testTimeout);

    it('file deleted via API is not accessible via sandbox', async () => {
      const { setup, getTestPath } = getContext();
      const path = `${getTestPath()}/delete-me.txt`;

      if (!setup.sandbox.executeCommand) {
        return; // Sandbox doesn't support command execution
      }

      // Create file
      await setup.filesystem.writeFile(path, 'delete me');

      // Verify it exists
      const beforeResult = await setup.sandbox.executeCommand('cat', [path]);
      expect(beforeResult.exitCode).toBe(0);

      // Delete via API
      await setup.filesystem.deleteFile(path);

      // Verify it's gone (cat should fail)
      const afterResult = await setup.sandbox.executeCommand('cat', [path]);
      expect(afterResult.exitCode).not.toBe(0);
    }, getContext().testTimeout);
  });
}
