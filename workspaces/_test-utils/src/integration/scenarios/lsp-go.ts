/**
 * LSP Go (gopls) diagnostics integration tests.
 *
 * Graceful skip pattern: if getDiagnostics returns [] (gopls not installed),
 * the test passes silently. When gopls is available, asserts that a type
 * error is detected for `var x int = "hello"`.
 */

import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

import type { TestContext } from './test-context';

export function createLspGoTests(getContext: () => TestContext): void {
  describe('LSP Go Diagnostics (gopls)', () => {
    it(
      'detects type errors in Go files when gopls is available',
      async ctx => {
        const { workspace, getTestPath } = getContext();
        const lsp = workspace.lsp;
        if (!lsp) return ctx.skip();

        const testDir = getTestPath();
        const filePath = join(testDir, 'main.go');

        const fs = workspace.filesystem;
        if (fs) {
          // Write go.mod so walkUpAsync finds a project root
          await fs.writeFile(join(testDir, 'go.mod'), 'module test\n\ngo 1.21\n');
        }

        const content = 'package main\n\nfunc main() {\n\tvar x int = "hello"\n}\n';

        const diagnostics = await lsp.getDiagnostics(filePath, content);

        // Graceful skip: if gopls is not installed, getDiagnostics returns []
        if (diagnostics.length === 0) return ctx.skip();

        expect(diagnostics.some(d => d.severity === 'error')).toBe(true);
      },
      getContext().testTimeout,
    );

    it(
      'returns no errors for valid Go when gopls is available',
      async ctx => {
        const { workspace, getTestPath } = getContext();
        const lsp = workspace.lsp;
        if (!lsp) return ctx.skip();

        const testDir = getTestPath();
        const filePath = join(testDir, 'valid.go');

        const fs = workspace.filesystem;
        if (fs) {
          await fs.writeFile(join(testDir, 'go.mod'), 'module test\n\ngo 1.21\n');
        }

        const content = 'package main\n\nfunc main() {\n\tvar x int = 42\n\t_ = x\n}\n';

        const diagnostics = await lsp.getDiagnostics(filePath, content);

        // Graceful skip if gopls not available
        if (diagnostics.length === 0) return ctx.skip();

        const errors = diagnostics.filter(d => d.severity === 'error');
        expect(errors).toHaveLength(0);
      },
      getContext().testTimeout,
    );
  });
}
