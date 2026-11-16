import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isolatedTestFiles } from '../vitest.isolated-tests';

const coreRoot = join(__dirname, '..');

function unitTestFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : unitTestFiles(path);
    return entry.name.endsWith('.test.ts') && !entry.name.endsWith('.e2e.test.ts')
      ? [relative(coreRoot, path).split(sep).join('/')]
      : [];
  });
}

// Sets process.env before the file's imports run: at the top level or inside vi.hoisted.
const envWrite = String.raw`process\.env(?:\.\w+|\[\s*['"\`]\w+['"\`]\s*\])\s*=(?!=)`;
const envBeforeImports = new RegExp(String.raw`^${envWrite}|vi\.hoisted\(\(\)\s*=>\s*\{[^}]*${envWrite}`, 'm');

describe('vitest.isolated-tests', () => {
  it('recognizes env writes before imports in dot and bracket form', () => {
    // Built at runtime so this file's own source doesn't match the pattern it tests.
    const env = ['process', 'env'].join('.');
    const hoisted = (body: string) => `vi.hoisted(() => {\n  ${body}\n});`;
    const dot = `${env}.LEASE_TTL = '300';`;
    const single = `${env}['LEASE_TTL'] = '300';`;
    const double = `${env}["LEASE_TTL"] = '300';`;

    for (const source of [dot, single, double, hoisted(dot), hoisted(single)]) {
      expect(envBeforeImports.test(source), source).toBe(true);
    }
    for (const source of [
      `beforeEach(() => {\n  ${single}\n});`,
      `if (${env}['LEASE_TTL'] === '300') {}`,
      `const ttl = ${env}.LEASE_TTL;`,
    ]) {
      expect(envBeforeImports.test(source), source).toBe(false);
    }
  });

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
