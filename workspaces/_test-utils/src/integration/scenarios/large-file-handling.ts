/**
 * Large file handling integration tests.
 *
 * Verifies that the filesystem and sandbox handle large files (5MB+)
 * correctly without corruption or truncation.
 */

import { createHash } from 'node:crypto';

import { describe, it, expect, afterEach } from 'vitest';

import { generateTextContent, generateBinaryContent, cleanupTestPath } from '../../test-helpers';
import type { TestContext } from './test-context';

const FIVE_MB = 5 * 1024 * 1024;
const ONE_MB = 1 * 1024 * 1024;

export function createLargeFileHandlingTests(getContext: () => TestContext): void {
  describe('Large File Handling', () => {
    afterEach(async () => {
      const { workspace, getTestPath } = getContext();
      if (workspace.filesystem) {
        await cleanupTestPath(workspace.filesystem, getTestPath());
      }
    });

    it(
      'write and read large text file (5MB) via API',
      async () => {
        const ctx = getContext();
        if (ctx.fastOnly) return;
        if (!ctx.workspace.filesystem) return;

        const filePath = `${ctx.getTestPath()}/large-text-5mb.txt`;
        const content = generateTextContent(FIVE_MB);

        await ctx.workspace.filesystem.writeFile(filePath, content);
        const result = await ctx.workspace.filesystem.readFile(filePath, { encoding: 'utf-8' });

        expect(result).toBe(content);
      },
      getContext().testTimeout,
    );

    it(
      'write and read large binary file (5MB) via API',
      async () => {
        const ctx = getContext();
        if (ctx.fastOnly) return;
        if (!ctx.workspace.filesystem) return;

        const filePath = `${ctx.getTestPath()}/large-binary-5mb.bin`;
        const content = generateBinaryContent(FIVE_MB);
        const expectedHash = createHash('sha256').update(content).digest('hex');

        await ctx.workspace.filesystem.writeFile(filePath, content);
        const result = await ctx.workspace.filesystem.readFile(filePath);

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
        if (!ctx.workspace.filesystem || !ctx.workspace.sandbox?.executeCommand) return;

        const filePath = `${ctx.getTestPath()}/large-sandbox-1mb.txt`;
        const content = generateTextContent(ONE_MB);

        await ctx.workspace.filesystem.writeFile(filePath, content);

        // Verify size via wc -c in sandbox (same path — mountPath baked into getTestPath)
        const result = await ctx.workspace.sandbox.executeCommand('wc', ['-c', filePath]);
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
        if (!ctx.workspace.filesystem) return;

        const filePath = `${ctx.getTestPath()}/large-stat-5mb.bin`;
        const content = generateBinaryContent(FIVE_MB);

        await ctx.workspace.filesystem.writeFile(filePath, content);

        const statResult = await ctx.workspace.filesystem.stat(filePath);
        expect(statResult.size).toBe(FIVE_MB);
      },
      getContext().testTimeout,
    );
  });
}
