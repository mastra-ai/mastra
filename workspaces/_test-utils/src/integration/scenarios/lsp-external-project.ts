/**
 * LSP external project diagnostics integration tests.
 *
 * Verifies that with contained: false, getDiagnostics works for a file in a
 * completely separate project directory outside the workspace basePath.
 * walkUpAsync should resolve the external dir as the project root.
 *
 * Only meaningful when the filesystem can see absolute host paths
 * (sandboxPathsAligned === true).
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, afterEach } from 'vitest';

import type { TestContext } from './test-context';

export function createLspExternalProjectTests(getContext: () => TestContext): void {
  describe('LSP External Project Diagnostics', () => {
    let externalDir: string | undefined;

    afterEach(() => {
      if (externalDir) {
        try {
          rmSync(externalDir, { recursive: true, force: true });
        } catch {
          // best-effort cleanup
        }
        externalDir = undefined;
      }
    });

    it(
      'detects type errors in files outside workspace basePath',
      async ctx => {
        const { workspace, sandboxPathsAligned } = getContext();

        // Only meaningful when the filesystem can see absolute host paths
        if (!sandboxPathsAligned) return ctx.skip();

        const lsp = workspace.lsp;
        if (!lsp) return ctx.skip();

        const fs = workspace.filesystem;
        if (!fs) return ctx.skip();

        // Create a completely separate temp dir outside the workspace
        externalDir = mkdtempSync(join(tmpdir(), 'ws-external-project-'));

        // Write tsconfig.json in the external dir — walkUpAsync should find it
        await fs.writeFile(join(externalDir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true } }));

        const content = 'const x: number = "hello";';

        const diagnostics = await lsp.getDiagnostics(join(externalDir, 'error.ts'), content);

        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics.some(d => d.severity === 'error')).toBe(true);
        expect(diagnostics.some(d => d.message.includes('not assignable'))).toBe(true);
      },
      getContext().testTimeout,
    );

    it(
      'returns no errors for valid code in external project',
      async ctx => {
        const { workspace, sandboxPathsAligned } = getContext();

        if (!sandboxPathsAligned) return ctx.skip();

        const lsp = workspace.lsp;
        if (!lsp) return ctx.skip();

        const fs = workspace.filesystem;
        if (!fs) return ctx.skip();

        externalDir = mkdtempSync(join(tmpdir(), 'ws-external-project-'));

        await fs.writeFile(join(externalDir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true } }));

        const content = 'const x: number = 42;';

        const diagnostics = await lsp.getDiagnostics(join(externalDir, 'valid.ts'), content);

        const errors = diagnostics.filter(d => d.severity === 'error');
        expect(errors).toHaveLength(0);
      },
      getContext().testTimeout,
    );
  });
}
