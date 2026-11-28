import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript-classic';
import { afterEach, describe, expect, it } from 'vitest';

// Guards the package's one promise: everything reachable from index.ts loads in a browser.
// Runtime imports may reach only relative files, zod and core's browser-safe entries; type-only imports may also reach
// @mastra/core, which the build erases.

const SRC = dirname(fileURLToPath(import.meta.url));
// Core entries whose own build guard (browserSafeEntries) proves them browser-safe.
const RUNTIME_PACKAGES = new Set(['zod', '@mastra/core/error', '@mastra/core/llm/reasoning']);
const TYPE_PACKAGE_PREFIX = '@mastra/core/';

interface Import {
  spec: string;
  typeOnly: boolean;
}

function isTypeOnlyImport(node: ts.ImportDeclaration): boolean {
  const clause = node.importClause;
  if (!clause) return false; // `import 'x'` runs x
  if (clause.isTypeOnly) return true;
  const bindings = clause.namedBindings;
  if (clause.name || !bindings || !ts.isNamedImports(bindings) || bindings.elements.length === 0) return false;
  return bindings.elements.every(element => element.isTypeOnly);
}

function isTypeOnlyExport(node: ts.ExportDeclaration): boolean {
  if (node.isTypeOnly) return true;
  const clause = node.exportClause;
  if (!clause || !ts.isNamedExports(clause) || clause.elements.length === 0) return false; // `export *` re-exports values
  return clause.elements.every(element => element.isTypeOnly);
}

/** Every module a file names, read by the TypeScript parser so no form of import slips past. */
function importsOf(text: string, fileName = 'module.ts'): Import[] {
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const found: Import[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      found.push({ spec: node.moduleSpecifier.text, typeOnly: isTypeOnlyImport(node) });
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      found.push({ spec: node.moduleSpecifier.text, typeOnly: isTypeOnlyExport(node) });
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      const target = node.moduleReference.expression;
      if (ts.isStringLiteral(target)) found.push({ spec: target.text, typeOnly: node.isTypeOnly });
    } else if (ts.isImportTypeNode(node)) {
      const literal = ts.isLiteralTypeNode(node.argument) ? node.argument.literal : undefined;
      if (literal && ts.isStringLiteral(literal)) found.push({ spec: literal.text, typeOnly: true });
    } else if (ts.isCallExpression(node)) {
      const [first] = node.arguments;
      const loads =
        node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require');
      if (loads && first && ts.isStringLiteralLike(first)) found.push({ spec: first.text, typeOnly: false });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

function resolveRelative(spec: string, from: string): string {
  const base = resolve(dirname(from), spec.replace(/\.js$/, ''));
  for (const candidate of [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(`cannot resolve ${spec} from ${from}`);
}

/** Imports reachable from `entry` that a browser bundle could not carry, with the path that reaches each. */
function browserViolations(root: string, entry = 'index'): string[] {
  const seen = new Set<string>();
  const violations: string[] = [];
  const stack = [{ path: join(root, `${entry}.ts`), via: [entry] }];
  while (stack.length > 0) {
    const { path, via } = stack.pop()!;
    if (seen.has(path)) continue;
    seen.add(path);
    for (const { spec, typeOnly } of importsOf(readFileSync(path, 'utf8'), path)) {
      if (spec.startsWith('.')) {
        const next = resolveRelative(spec, path);
        stack.push({ path: next, via: [...via, relative(root, next)] });
      } else if (!RUNTIME_PACKAGES.has(spec) && !(typeOnly && spec.startsWith(TYPE_PACKAGE_PREFIX))) {
        violations.push(`${typeOnly ? 'type' : 'value'} ${spec} <- ${via.join(' > ')}`);
      }
    }
  }
  return violations.sort();
}

describe('@internal/factory-contract', () => {
  it('reaches nothing from index.ts that a browser cannot load', () => {
    expect(browserViolations(SRC)).toEqual([]);
  });
});

describe('the browser-safety guard', () => {
  describe('when reading one file', () => {
    it.each([
      ["import type { A } from '@mastra/core/storage';", true],
      ["import { type A, type B } from '@mastra/core/storage';", true],
      ["export type { A } from '@mastra/core/storage';", true],
      ['export { type A } from "@mastra/core/storage";', true],
      ["type T = import('@mastra/core/storage').A;", true],
      ["import { A } from '@mastra/core/storage';", false],
      ["import { type A, B } from '@mastra/core/storage';", false],
      ["import A, { type B } from '@mastra/core/storage';", false],
      ["import * as A from '@mastra/core/storage';", false],
      ["import {} from '@mastra/core/storage';", false],
      ["import '@mastra/core/storage';", false],
      ['import "@mastra/core/storage";', false],
      ["export * from '@mastra/core/storage';", false],
      ["export * as A from '@mastra/core/storage';", false],
      ["const a = import('@mastra/core/storage');", false],
      ["const a = require('@mastra/core/storage');", false],
      ["import a = require('@mastra/core/storage');", false],
    ])('classifies %s as type-only: %s', (text, typeOnly) => {
      expect(importsOf(text)).toEqual([{ spec: '@mastra/core/storage', typeOnly }]);
    });

    it('finds a side-effect import that sits next to another import', () => {
      expect(importsOf("import 'node:crypto';\nimport { z } from 'zod';")).toEqual([
        { spec: 'node:crypto', typeOnly: false },
        { spec: 'zod', typeOnly: false },
      ]);
    });
  });

  describe('when walking a contract', () => {
    let root: string | undefined;
    afterEach(() => {
      if (root) rmSync(root, { recursive: true, force: true });
      root = undefined;
    });

    const contract = (files: Record<string, string>) => {
      // A space in the path checks the guard resolves checkouts whose path has one.
      root = join(mkdtempSync(join(tmpdir(), 'factory contract ')), 'src');
      for (const [name, text] of Object.entries(files)) {
        mkdirSync(dirname(join(root, name)), { recursive: true });
        writeFileSync(join(root, name), text);
      }
      return root;
    };

    it('accepts zod, relative files and type-only @mastra/core', () => {
      const src = contract({
        'index.ts': "export * from './leaf.js';\nimport { z } from 'zod';",
        'leaf.ts': "import type { A } from '@mastra/core/storage';\nexport type B = A;",
      });
      expect(browserViolations(src)).toEqual([]);
    });

    it('fails on a value import of @mastra/core and a Node side-effect import deep in the closure', () => {
      const src = contract({
        'index.ts': "export * from './nested/leaf.js';",
        'nested/leaf.ts': "import 'node:crypto';\nimport { z } from 'zod';\nimport { A } from '@mastra/core/storage';",
      });
      expect(browserViolations(src)).toEqual([
        'value @mastra/core/storage <- index > nested/leaf.ts',
        'value node:crypto <- index > nested/leaf.ts',
      ]);
    });

    it('fails on a type-only import of any package other than @mastra/core', () => {
      const src = contract({ 'index.ts': "import type { Hono } from 'hono';" });
      expect(browserViolations(src)).toEqual(['type hono <- index']);
    });
  });
});
