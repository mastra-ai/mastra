import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isolatedTestFiles } from '../vitest.isolated-tests';

const coreRoot = join(__dirname, '..');

function unitTestFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : unitTestFiles(path);
    return entry.name.endsWith('.test.ts') && !entry.name.endsWith('.e2e.test.ts') ? [relative(coreRoot, path)] : [];
  });
}

// Sets process.env before the file's imports run: at the top level or inside vi.hoisted.
const envBeforeImports = /^process\.env\.\w+\s*=|vi\.hoisted\(\(\)\s*=>\s*\{[^}]*process\.env\.\w+\s*=/m;

describe('vitest.isolated-tests', () => {
  it('isolates every unit test file that sets env before its imports', () => {
    const isolated = new Set(isolatedTestFiles);
    const missing = unitTestFiles(join(coreRoot, 'src')).filter(
      file => !isolated.has(file) && envBeforeImports.test(readFileSync(join(coreRoot, file), 'utf8')),
    );
    // In the shared lane, a module that reads this env at import keeps the value the first importer
    // saw, and the assignment leaks into later files. Add these to vitest.isolated-tests.ts as `env`.
    expect(missing).toEqual([]);
  });
});
