/**
 * LSP per-file root resolution integration tests.
 *
 * Verifies that walkUpAsync resolves different LSP project roots for files
 * in separate project directories. Creates two projects with distinct
 * tsconfig.json files and validates that each file gets diagnostics from
 * its own project's TS server instance.
 *
 * Local vs remote FS behavior:
 * - Local FS: walkUpAsync finds markers → TS server reads tsconfig.json from
 *   disk at the resolved root → different tsconfig settings produce different
 *   diagnostics
 * - Remote FS (S3/GCS): walkUpAsync finds markers via filesystem API → but
 *   the TS server can't read tsconfig.json from the remote path → uses default
 *   compiler settings → we can only verify that both projects resolve and
 *   return diagnostics
 *
 * Uses `sandboxPathsAligned` as the proxy for whether the TS server sees
 * files written via the workspace filesystem API.
 */

import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

import type { TestContext } from './test-context';

export function createLspPerFileRootTests(getContext: () => TestContext): void {
  describe('LSP Per-File Root Resolution', () => {
    it(
      'reports diagnostics for files in separate project directories',
      async ctx => {
        const { workspace, getTestPath } = getContext();
        const lsp = workspace.lsp;
        if (!lsp) return ctx.skip();

        const fs = workspace.filesystem;
        if (!fs) return ctx.skip();

        const testDir = getTestPath();

        // Create two separate project directories with tsconfig.json
        await fs.writeFile(
          join(testDir, 'project-a', 'tsconfig.json'),
          JSON.stringify({ compilerOptions: { strict: true } }),
        );
        await fs.writeFile(
          join(testDir, 'project-b', 'tsconfig.json'),
          JSON.stringify({ compilerOptions: { strict: false, noImplicitAny: false } }),
        );

        // Get diagnostics for a type error in project-a
        const diagsA = await lsp.getDiagnostics(join(testDir, 'project-a', 'error.ts'), 'const x: number = "hello";');

        // Get diagnostics for a type error in project-b
        const diagsB = await lsp.getDiagnostics(join(testDir, 'project-b', 'error.ts'), 'const y: number = "world";');

        // Both should report at least one type error — proves separate LSP roots resolved
        expect(diagsA.length).toBeGreaterThan(0);
        expect(diagsA.some(d => d.severity === 'error')).toBe(true);

        expect(diagsB.length).toBeGreaterThan(0);
        expect(diagsB.some(d => d.severity === 'error')).toBe(true);
      },
      getContext().testTimeout,
    );

    it(
      'uses project-specific tsconfig strict settings',
      async ctx => {
        const { workspace, getTestPath, sandboxPathsAligned } = getContext();
        if (!sandboxPathsAligned) return ctx.skip(); // TS server must see tsconfig on disk

        const lsp = workspace.lsp;
        if (!lsp) return ctx.skip();

        const fs = workspace.filesystem;
        if (!fs) return ctx.skip();

        const testDir = getTestPath();

        // project-a: strict mode → implicit any is an error
        await fs.writeFile(
          join(testDir, 'project-a', 'tsconfig.json'),
          JSON.stringify({ compilerOptions: { strict: true } }),
        );

        // project-b: no implicit any check → no error for untyped params
        await fs.writeFile(
          join(testDir, 'project-b', 'tsconfig.json'),
          JSON.stringify({ compilerOptions: { strict: false, noImplicitAny: false } }),
        );

        // Code with an untyped parameter: error under strict, ok under noImplicitAny: false
        const code = 'function f(x) { return x; }';

        const diagsA = await lsp.getDiagnostics(join(testDir, 'project-a', 'param.ts'), code);
        const diagsB = await lsp.getDiagnostics(join(testDir, 'project-b', 'param.ts'), code);

        // project-a (strict: true) should have an "implicit" any error
        expect(diagsA.length).toBeGreaterThan(0);
        expect(diagsA.some(d => d.message.toLowerCase().includes('implicit'))).toBe(true);

        // project-b (noImplicitAny: false) should have no errors
        const errorsB = diagsB.filter(d => d.severity === 'error');
        expect(errorsB).toHaveLength(0);
      },
      getContext().testTimeout,
    );

    it(
      'returns empty diagnostics for valid code in both projects',
      async ctx => {
        const { workspace, getTestPath } = getContext();
        const lsp = workspace.lsp;
        if (!lsp) return ctx.skip();

        const fs = workspace.filesystem;
        if (!fs) return ctx.skip();

        const testDir = getTestPath();

        // Create two separate project directories
        await fs.writeFile(
          join(testDir, 'project-a', 'tsconfig.json'),
          JSON.stringify({ compilerOptions: { strict: true } }),
        );
        await fs.writeFile(
          join(testDir, 'project-b', 'tsconfig.json'),
          JSON.stringify({ compilerOptions: { strict: false, noImplicitAny: false } }),
        );

        const validCode = 'const x: number = 42;';

        const diagsA = await lsp.getDiagnostics(join(testDir, 'project-a', 'valid.ts'), validCode);
        const diagsB = await lsp.getDiagnostics(join(testDir, 'project-b', 'valid.ts'), validCode);

        const errorsA = diagsA.filter(d => d.severity === 'error');
        const errorsB = diagsB.filter(d => d.severity === 'error');

        expect(errorsA).toHaveLength(0);
        expect(errorsB).toHaveLength(0);
      },
      getContext().testTimeout,
    );
  });
}
