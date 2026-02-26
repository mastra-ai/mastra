/**
 * LSP ESLint diagnostics + getDiagnosticsMulti integration tests.
 *
 * Graceful skip pattern: if getDiagnostics returns [] (ESLint language server
 * not installed), the test passes silently. When available, asserts that
 * ESLint rules produce diagnostics.
 *
 * Also tests getDiagnosticsMulti — for a .ts file, both the TypeScript and
 * ESLint servers should contribute diagnostics, with deduplication applied.
 */

import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

import type { LSPDiagnostic } from '@mastra/core/workspace/lsp';
import type { TestContext } from './test-context';

export function createLspEslintTests(getContext: () => TestContext): void {
  describe('LSP ESLint Diagnostics', () => {
    it(
      'detects ESLint rule violations when ESLint language server is available',
      async ctx => {
        const { workspace, getTestPath } = getContext();
        const lsp = workspace.lsp;
        if (!lsp) return ctx.skip();

        const fs = workspace.filesystem;
        if (!fs) return ctx.skip();

        const testDir = getTestPath();

        // Write project markers for ESLint
        await fs.writeFile(
          join(testDir, 'package.json'),
          JSON.stringify({ name: 'test', version: '1.0.0', type: 'module', devDependencies: { eslint: '*' } }),
        );

        // ESLint flat config with no-var rule
        await fs.writeFile(
          join(testDir, 'eslint.config.js'),
          ['export default [', '  {', '    rules: {', '      "no-var": "error",', '    },', '  },', '];'].join('\n'),
        );

        // Write tsconfig so TS server also resolves this directory
        await fs.writeFile(join(testDir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true } }));

        // Code that violates no-var
        const content = 'var x = 1;\n';

        const diagnostics = await lsp.getDiagnostics(join(testDir, 'lint-error.js'), content);

        // Graceful skip: if ESLint language server not available, returns []
        if (diagnostics.length === 0) return ctx.skip();

        expect(diagnostics.some(d => d.message.toLowerCase().includes('var') || d.message.includes('no-var'))).toBe(
          true,
        );
      },
      getContext().testTimeout,
    );

    it(
      'getDiagnosticsMulti returns diagnostics from both TypeScript and ESLint servers',
      async ctx => {
        const { workspace, getTestPath } = getContext();
        const lsp = workspace.lsp;
        if (!lsp) return ctx.skip();

        // getDiagnosticsMulti may not be available on all workspace types
        if (!('getDiagnosticsMulti' in lsp)) return ctx.skip();

        const fs = workspace.filesystem;
        if (!fs) return ctx.skip();

        const testDir = getTestPath();

        // Set up both TS and ESLint project markers
        await fs.writeFile(join(testDir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true } }));

        await fs.writeFile(
          join(testDir, 'package.json'),
          JSON.stringify({ name: 'test', version: '1.0.0', type: 'module', devDependencies: { eslint: '*' } }),
        );

        await fs.writeFile(
          join(testDir, 'eslint.config.js'),
          ['export default [', '  {', '    rules: {', '      "no-var": "error",', '    },', '  },', '];'].join('\n'),
        );

        // Code with both a type error (TS) and a lint error (ESLint no-var)
        const content = 'var x: number = "hello";\n';

        const diagnostics: LSPDiagnostic[] = await lsp.getDiagnosticsMulti(join(testDir, 'multi.ts'), content);

        // Graceful skip if neither server is available
        if (diagnostics.length === 0) return ctx.skip();

        // Should have at least one diagnostic (could be TS type error, ESLint, or both)
        expect(diagnostics.length).toBeGreaterThan(0);

        // Check for type error from TS server
        const hasTypeError = diagnostics.some(d => d.severity === 'error' && d.message.includes('not assignable'));

        // Check for ESLint no-var violation
        const hasLintError = diagnostics.some(
          d => d.message.toLowerCase().includes('var') || d.message.includes('no-var'),
        );

        // At minimum the TS type error should be present
        expect(hasTypeError).toBe(true);

        // If both servers reported, verify we get diagnostics from both sources
        if (hasTypeError && hasLintError) {
          expect(diagnostics.length).toBeGreaterThanOrEqual(2);
        }
      },
      getContext().testTimeout,
    );
  });
}
