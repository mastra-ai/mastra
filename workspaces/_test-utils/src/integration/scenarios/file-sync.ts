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
  /** Mount path prefix for sandbox commands (e.g. '/data/s3'). Empty string if paths match. */
  mountPath: string;
  testTimeout: number;
  fastOnly: boolean;
}

export function createFileSyncTests(getContext: () => TestContext): void {
  describe('File Sync', () => {
    afterEach(async () => {
      const { setup, getTestPath } = getContext();
      await cleanupTestPath(setup.filesystem, getTestPath());
    });

    it(
      'file written via API is readable via sandbox cat',
      async () => {
        const { setup, getTestPath, mountPath } = getContext();
        const fsPath = `${getTestPath()}/api-to-sandbox.txt`;
        const sandboxPath = `${mountPath}${fsPath}`;
        const content = 'Hello from API!';

        if (!setup.sandbox.executeCommand) {
          return; // Sandbox doesn't support command execution
        }

        // Write via filesystem API
        await setup.filesystem.writeFile(fsPath, content);

        // Read via sandbox command (uses sandbox path which includes mount prefix)
        const result = await setup.sandbox.executeCommand('cat', [sandboxPath]);

        expect(result.exitCode).toBe(0);
        expect(result.stdout.trim()).toBe(content);
      },
      getContext().testTimeout,
    );

    it(
      'file written via sandbox is readable via API',
      async () => {
        const { setup, getTestPath, mountPath } = getContext();
        const fsPath = `${getTestPath()}/sandbox-to-api.txt`;
        const sandboxPath = `${mountPath}${fsPath}`;
        const content = 'Hello from sandbox!';

        if (!setup.sandbox.executeCommand) {
          return; // Sandbox doesn't support command execution
        }

        // Ensure directory exists via sandbox (uses sandbox path)
        const mkdirResult = await setup.sandbox.executeCommand('mkdir', ['-p', `${mountPath}${getTestPath()}`]);
        expect(mkdirResult.exitCode).toBe(0);

        // Write via sandbox command (uses sandbox path)
        const writeResult = await setup.sandbox.executeCommand('sh', ['-c', `echo "${content}" > ${sandboxPath}`]);
        expect(writeResult.exitCode).toBe(0);

        // Read via filesystem API (uses filesystem path)
        const readContent = await setup.filesystem.readFile(fsPath, { encoding: 'utf-8' });

        expect((readContent as string).trim()).toBe(content);
      },
      getContext().testTimeout,
    );

    it(
      'directory created via API is listable via sandbox ls',
      async () => {
        const { setup, getTestPath, mountPath } = getContext();
        const fsDirPath = `${getTestPath()}/test-dir`;
        const fsFilePath = `${fsDirPath}/file.txt`;
        const sandboxDirPath = `${mountPath}${fsDirPath}`;

        if (!setup.sandbox.executeCommand) {
          return; // Sandbox doesn't support command execution
        }

        // Create directory and file via API
        await setup.filesystem.mkdir(fsDirPath, { recursive: true });
        await setup.filesystem.writeFile(fsFilePath, 'content');

        // List via sandbox command (uses sandbox path)
        const result = await setup.sandbox.executeCommand('ls', [sandboxDirPath]);

        expect(result.exitCode).toBe(0);
        expect(result.stdout).toContain('file.txt');
      },
      getContext().testTimeout,
    );

    it(
      'file deleted via API is not accessible via sandbox',
      async () => {
        const { setup, getTestPath, mountPath } = getContext();
        const fsPath = `${getTestPath()}/delete-me.txt`;
        const sandboxPath = `${mountPath}${fsPath}`;

        if (!setup.sandbox.executeCommand) {
          return; // Sandbox doesn't support command execution
        }

        // Create file via API
        await setup.filesystem.writeFile(fsPath, 'delete me');

        // Verify it exists via sandbox
        const beforeResult = await setup.sandbox.executeCommand('cat', [sandboxPath]);
        expect(beforeResult.exitCode).toBe(0);

        // Delete via API
        await setup.filesystem.deleteFile(fsPath);

        // Verify it's gone (cat should fail)
        const afterResult = await setup.sandbox.executeCommand('cat', [sandboxPath]);
        expect(afterResult.exitCode).not.toBe(0);
      },
      getContext().testTimeout,
    );
  });
}
