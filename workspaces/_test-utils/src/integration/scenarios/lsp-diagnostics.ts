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
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

import type { TestContext } from './test-context';

export function createLspDiagnosticsTests(getContext: () => TestContext): void {
  describe('LSP Diagnostics', () => {
    it(
      'reports type errors in TypeScript files',
      async () => {
        const { workspace, getTestPath } = getContext();
        const lsp = workspace.lsp;
        if (!lsp) return; // LSP not configured or deps unavailable

        const testDir = getTestPath();
        const filePath = join(testDir, 'error.ts');

        // Create a minimal TypeScript project in the test directory
        mkdirSync(testDir, { recursive: true });
        writeFileSync(join(testDir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true } }));

        const content = 'const x: number = "hello";';
        writeFileSync(filePath, content);

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
      async () => {
        const { workspace, getTestPath } = getContext();
        const lsp = workspace.lsp;
        if (!lsp) return;

        const testDir = getTestPath();
        const filePath = join(testDir, 'valid.ts');

        mkdirSync(testDir, { recursive: true });
        writeFileSync(join(testDir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true } }));

        const content = 'const x: number = 42;';
        writeFileSync(filePath, content);

        const diagnostics = await lsp.getDiagnostics(filePath, content);

        const errors = diagnostics.filter(d => d.severity === 'error');
        expect(errors).toHaveLength(0);
      },
      getContext().testTimeout,
    );

    it(
      'diagnostics include line and character positions',
      async () => {
        const { workspace, getTestPath } = getContext();
        const lsp = workspace.lsp;
        if (!lsp) return;

        const testDir = getTestPath();
        const filePath = join(testDir, 'positions.ts');

        mkdirSync(testDir, { recursive: true });
        writeFileSync(join(testDir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true } }));

        const content = 'const x: number = "hello";';
        writeFileSync(filePath, content);

        const diagnostics = await lsp.getDiagnostics(filePath, content);

        expect(diagnostics.length).toBeGreaterThan(0);
        const error = diagnostics.find(d => d.severity === 'error')!;
        // Positions are 1-indexed
        expect(error.line).toBeGreaterThanOrEqual(1);
        expect(error.character).toBeGreaterThanOrEqual(1);
      },
      getContext().testTimeout,
    );

    it(
      'returns empty array for unsupported file types',
      async () => {
        const { workspace, getTestPath } = getContext();
        const lsp = workspace.lsp;
        if (!lsp) return;

        const testDir = getTestPath();
        const filePath = join(testDir, 'readme.md');

        mkdirSync(testDir, { recursive: true });
        writeFileSync(filePath, '# Hello');

        const diagnostics = await lsp.getDiagnostics(filePath, '# Hello');

        expect(diagnostics).toEqual([]);
      },
      getContext().testTimeout,
    );
  });
}
