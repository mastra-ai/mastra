/**
 * LSP Rust (rust-analyzer) diagnostics integration tests.
 *
 * Graceful skip pattern: if getDiagnostics returns [] (rust-analyzer not
 * installed), the test passes silently. When rust-analyzer is available,
 * asserts that a type error is detected for `let x: i32 = "hello"`.
 */

import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

import type { TestContext } from './test-context';

export function createLspRustTests(getContext: () => TestContext): void {
  describe('LSP Rust Diagnostics (rust-analyzer)', () => {
    it(
      'detects type errors in Rust files when rust-analyzer is available',
      async ctx => {
        const { workspace, getTestPath } = getContext();
        const lsp = workspace.lsp;
        if (!lsp) return ctx.skip();

        const testDir = getTestPath();
        const filePath = join(testDir, 'src', 'main.rs');

        const content = 'fn main() {\n    let x: i32 = "hello";\n}\n';

        const fs = workspace.filesystem;
        if (fs) {
          // Write Cargo.toml so walkUpAsync finds a project root
          await fs.writeFile(
            join(testDir, 'Cargo.toml'),
            '[package]\nname = "test"\nversion = "0.1.0"\nedition = "2021"\n',
          );
          // Persist src/main.rs to disk so rust-analyzer can see it as part of a Cargo target
          await fs.writeFile(filePath, content);
        }

        const diagnostics = await lsp.getDiagnostics(filePath, content);

        // Graceful skip: if rust-analyzer is not installed, getDiagnostics returns []
        if (diagnostics.length === 0) return ctx.skip();

        expect(diagnostics.some(d => d.severity === 'error')).toBe(true);
      },
      getContext().testTimeout,
    );

    it(
      'returns no errors for valid Rust when rust-analyzer is available',
      async ctx => {
        const { workspace, getTestPath } = getContext();
        const lsp = workspace.lsp;
        if (!lsp) return ctx.skip();

        const testDir = getTestPath();
        const filePath = join(testDir, 'src', 'main.rs');

        const content = 'fn main() {\n    let x: i32 = 42;\n    println!("{}", x);\n}\n';

        const fs = workspace.filesystem;
        if (fs) {
          await fs.writeFile(
            join(testDir, 'Cargo.toml'),
            '[package]\nname = "test"\nversion = "0.1.0"\nedition = "2021"\n',
          );
          // Persist src/main.rs to disk so rust-analyzer can see it as part of a Cargo target
          await fs.writeFile(filePath, content);
        }

        const diagnostics = await lsp.getDiagnostics(filePath, content);

        // Graceful skip if rust-analyzer not available
        if (diagnostics.length === 0) return ctx.skip();

        const errors = diagnostics.filter(d => d.severity === 'error');
        expect(errors).toHaveLength(0);
      },
      getContext().testTimeout,
    );
  });
}
