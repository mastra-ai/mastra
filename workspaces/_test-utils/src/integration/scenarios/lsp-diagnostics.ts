/**
 * LSP diagnostics integration tests.
 *
 * Verifies that the LSP subsystem produces real diagnostics when a workspace
 * has `lsp: true` and a sandbox with a process manager.
 *
 * Requires:
 * - typescript and typescript-language-server installed (resolved via node_modules)
 * - vscode-jsonrpc available (optional dep of @mastra/core)
 * - A sandbox that can spawn processes (LocalSandbox or compatible)
 *
 * Tests are skipped gracefully when LSP is not available.
 *
 * Uses the workspace filesystem API to write test files so that walkUpAsync
 * can find project markers (tsconfig.json) on any provider (local, S3, GCS).
 * The TS language server receives file content via LSP protocol and doesn't
 * need files on disk.
 */

import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

import type { TestContext } from './test-context';

export function createLspDiagnosticsTests(getContext: () => TestContext): void {
  describe('LSP Diagnostics', () => {
    it(
      'reports type errors in TypeScript files',
      async ctx => {
        const { workspace, getTestPath } = getContext();
        const lsp = workspace.lsp;
        if (!lsp) return ctx.skip(); // LSP not configured or deps unavailable

        const testDir = getTestPath();
        const filePath = join(testDir, 'error.ts');

        // Write tsconfig.json via the workspace filesystem so walkUpAsync
        // can find the project root on any provider (local, S3, GCS).
        const fs = workspace.filesystem;
        if (fs) {
          await fs.writeFile(join(testDir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true } }));
        }

        const content = 'const x: number = "hello";';

        const diagnostics = await lsp.getDiagnostics(filePath, content);

        // Should detect the type error
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics.some(d => d.severity === 'error')).toBe(true);
        expect(diagnostics.some(d => d.message.includes('not assignable'))).toBe(true);
      },
      getContext().testTimeout,
    );

    it(
      'returns empty diagnostics for valid TypeScript',
      async ctx => {
        const { workspace, getTestPath } = getContext();
        const lsp = workspace.lsp;
        if (!lsp) return ctx.skip();

        const testDir = getTestPath();
        const filePath = join(testDir, 'valid.ts');

        const fs = workspace.filesystem;
        if (fs) {
          await fs.writeFile(join(testDir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true } }));
        }

        const content = 'const x: number = 42;';

        const diagnostics = await lsp.getDiagnostics(filePath, content);

        const errors = diagnostics.filter(d => d.severity === 'error');
        expect(errors).toHaveLength(0);
      },
      getContext().testTimeout,
    );

    it(
      'diagnostics include line and character positions',
      async ctx => {
        const { workspace, getTestPath } = getContext();
        const lsp = workspace.lsp;
        if (!lsp) return ctx.skip();

        const testDir = getTestPath();
        const filePath = join(testDir, 'positions.ts');

        const fs = workspace.filesystem;
        if (fs) {
          await fs.writeFile(join(testDir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true } }));
        }

        const content = 'const x: number = "hello";';

        const diagnostics = await lsp.getDiagnostics(filePath, content);

        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.severity === 'error');
        expect(error).toBeDefined();
        // Positions are 1-indexed
        expect(error!.line).toBeGreaterThanOrEqual(1);
        expect(error!.character).toBeGreaterThanOrEqual(1);
      },
      getContext().testTimeout,
    );

    it(
      'returns empty array for unsupported file types',
      async ctx => {
        const { workspace, getTestPath } = getContext();
        const lsp = workspace.lsp;
        if (!lsp) return ctx.skip();

        const testDir = getTestPath();
        const filePath = join(testDir, 'readme.md');

        const fs = workspace.filesystem;
        if (fs) {
          await fs.writeFile(filePath, '# Hello');
        }

        const diagnostics = await lsp.getDiagnostics(filePath, '# Hello');

        expect(diagnostics).toEqual([]);
      },
      getContext().testTimeout,
    );
  });
}
