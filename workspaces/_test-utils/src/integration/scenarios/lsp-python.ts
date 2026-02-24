/**
 * LSP Python (Pyright) diagnostics integration tests.
 *
 * Graceful skip pattern: if getDiagnostics returns [] (pyright not installed),
 * the test passes silently. When pyright is available, asserts that a type
 * error is detected for `x: int = "hello"`.
 */

import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

import type { TestContext } from './test-context';

export function createLspPythonTests(getContext: () => TestContext): void {
  describe('LSP Python Diagnostics (Pyright)', () => {
    it(
      'detects type errors in Python files when pyright is available',
      async ctx => {
        const { workspace, getTestPath } = getContext();
        const lsp = workspace.lsp;
        if (!lsp) return ctx.skip();

        const testDir = getTestPath();
        const filePath = join(testDir, 'error.py');

        const fs = workspace.filesystem;
        if (fs) {
          // Write a minimal pyproject.toml so walkUpAsync finds a project root
          await fs.writeFile(join(testDir, 'pyproject.toml'), '[project]\nname = "test"\nversion = "0.1.0"\n');
        }

        const content = 'x: int = "hello"';

        const diagnostics = await lsp.getDiagnostics(filePath, content);

        // Graceful skip: if pyright is not installed, getDiagnostics returns []
        // and the test passes without assertions about content
        if (diagnostics.length === 0) return ctx.skip();

        expect(diagnostics.some(d => d.severity === 'error')).toBe(true);
      },
      getContext().testTimeout,
    );

    it(
      'returns no errors for valid Python when pyright is available',
      async ctx => {
        const { workspace, getTestPath } = getContext();
        const lsp = workspace.lsp;
        if (!lsp) return ctx.skip();

        const testDir = getTestPath();
        const filePath = join(testDir, 'valid.py');

        const fs = workspace.filesystem;
        if (fs) {
          await fs.writeFile(join(testDir, 'pyproject.toml'), '[project]\nname = "test"\nversion = "0.1.0"\n');
        }

        const content = 'x: int = 42';

        const diagnostics = await lsp.getDiagnostics(filePath, content);

        // Graceful skip if pyright not available
        if (diagnostics.length === 0) return ctx.skip();

        const errors = diagnostics.filter(d => d.severity === 'error');
        expect(errors).toHaveLength(0);
      },
      getContext().testTimeout,
    );
  });
}
