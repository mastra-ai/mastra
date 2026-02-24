/**
 * LSP large file diagnostics integration tests.
 *
 * Generates a ~500-line TypeScript file with a single type error near the end
 * and verifies that the LSP server correctly identifies the error despite the
 * file size. Only runs on local providers — remote FS is too slow for large files.
 */

import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

import type { TestContext } from './test-context';

/** Generate a large TypeScript file with a type error at the specified line. */
function generateLargeFile(totalLines: number, errorLine: number): string {
  const lines: string[] = [];
  for (let i = 1; i <= totalLines; i++) {
    if (i === errorLine) {
      lines.push(`const error${i}: number = "this is a type error";`);
    } else {
      lines.push(`const var${i}: number = ${i};`);
    }
  }
  return lines.join('\n');
}

export function createLspLargeFileTests(getContext: () => TestContext): void {
  describe('LSP Large File Diagnostics', () => {
    it(
      'detects type error in a ~500-line TypeScript file',
      async ctx => {
        const { workspace, getTestPath } = getContext();
        const lsp = workspace.lsp;
        if (!lsp) return ctx.skip();

        const testDir = getTestPath();
        const filePath = join(testDir, 'large-file.ts');

        const fs = workspace.filesystem;
        if (fs) {
          await fs.writeFile(join(testDir, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true } }));
        }

        const errorLine = 400;
        const content = generateLargeFile(500, errorLine);

        const diagnostics = await lsp.getDiagnostics(filePath, content);

        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics.some(d => d.severity === 'error')).toBe(true);
        expect(diagnostics.some(d => d.message.includes('not assignable'))).toBe(true);
        // The error should be reported near the expected line
        const typeError = diagnostics.find(d => d.message.includes('not assignable'));
        expect(typeError).toBeDefined();
        expect(typeError!.line).toBe(errorLine);
      },
      getContext().testTimeout,
    );
  });
}
