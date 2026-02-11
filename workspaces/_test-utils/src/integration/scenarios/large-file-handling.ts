/**
 * Large file handling integration tests.
 *
 * Verifies that the filesystem and sandbox handle large files (5MB+)
 * correctly without corruption or truncation.
 */

import { createHash } from 'node:crypto';

import { describe, it, expect, afterEach } from 'vitest';

import { generateTextContent, generateBinaryContent, cleanupTestPath } from '../../test-helpers';
import type { WorkspaceSetup } from '../types';

interface TestContext {
  setup: WorkspaceSetup;
  getTestPath: () => string;
  /** Mount path prefix for sandbox commands (e.g. '/data/s3'). Empty string if paths match. */
  mountPath: string;
  testTimeout: number;
  fastOnly: boolean;
}

const FIVE_MB = 5 * 1024 * 1024;
const ONE_MB = 1 * 1024 * 1024;

export function createLargeFileHandlingTests(getContext: () => TestContext): void {
  describe('Large File Handling', () => {
    afterEach(async () => {
      const { setup, getTestPath } = getContext();
      await cleanupTestPath(setup.filesystem, getTestPath());
    });

    it(
      'write and read large text file (5MB) via API',
      async () => {
        const ctx = getContext();
        if (ctx.fastOnly) return;

        const filePath = `${ctx.getTestPath()}/large-text-5mb.txt`;
        const content = generateTextContent(FIVE_MB);

        await ctx.setup.filesystem.writeFile(filePath, content);
        const result = await ctx.setup.filesystem.readFile(filePath, { encoding: 'utf-8' });

        expect(result).toBe(content);
      },
      getContext().testTimeout,
    );

    it(
      'write and read large binary file (5MB) via API',
      async () => {
        const ctx = getContext();
        if (ctx.fastOnly) return;

        const filePath = `${ctx.getTestPath()}/large-binary-5mb.bin`;
        const content = generateBinaryContent(FIVE_MB);
        const expectedHash = createHash('sha256').update(content).digest('hex');

        await ctx.setup.filesystem.writeFile(filePath, content);
        const result = await ctx.setup.filesystem.readFile(filePath);

        const resultBuffer = Buffer.isBuffer(result) ? result : Buffer.from(result as string);
        const actualHash = createHash('sha256').update(resultBuffer).digest('hex');

        expect(actualHash).toBe(expectedHash);
      },
      getContext().testTimeout,
    );

    it(
      'large file via API readable via sandbox',
      async () => {
        const ctx = getContext();
        if (ctx.fastOnly) return;
        if (!ctx.setup.sandbox.executeCommand) return;

        const fsPath = `${ctx.getTestPath()}/large-sandbox-1mb.txt`;
        const sandboxPath = `${ctx.mountPath}${fsPath}`;
        const content = generateTextContent(ONE_MB);

        await ctx.setup.filesystem.writeFile(fsPath, content);

        // Verify size via wc -c in sandbox
        const result = await ctx.setup.sandbox.executeCommand('wc', ['-c', sandboxPath]);
        expect(result.exitCode).toBe(0);

        // wc -c output is like "1048576 /path/to/file" or just "1048576"
        const sizeStr = result.stdout.trim().split(/\s+/)[0];
        const reportedSize = parseInt(sizeStr!, 10);
        expect(reportedSize).toBe(ONE_MB);
      },
      getContext().testTimeout,
    );

    it(
      'stat reports correct size for large file',
      async () => {
        const ctx = getContext();
        if (ctx.fastOnly) return;

        const filePath = `${ctx.getTestPath()}/large-stat-5mb.bin`;
        const content = generateBinaryContent(FIVE_MB);

        await ctx.setup.filesystem.writeFile(filePath, content);

        const statResult = await ctx.setup.filesystem.stat(filePath);
        expect(statResult.size).toBe(FIVE_MB);
      },
      getContext().testTimeout,
    );
  });
}
