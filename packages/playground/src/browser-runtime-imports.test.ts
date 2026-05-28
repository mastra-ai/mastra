import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const PLAYGROUND_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = path.join(PLAYGROUND_ROOT, 'src');

const SERVER_ONLY_CORE_MODULE_PREFIXES = [
  '@mastra/core/agent-builder/ee',
  '@mastra/core/auth/ee',
  '@mastra/core/observability',
] as const;

const BROWSER_SAFE_CORE_MODULES = new Set(['@mastra/core/agent-builder/ee/model-policy']);

function isServerOnlyRuntimeModule(moduleSpecifier: string): boolean {
  if (BROWSER_SAFE_CORE_MODULES.has(moduleSpecifier)) return false;

  return SERVER_ONLY_CORE_MODULE_PREFIXES.some(
    prefix => moduleSpecifier === prefix || moduleSpecifier.startsWith(`${prefix}/`),
  );
}

function getLiteralModuleSpecifier(node: ts.Node): string | undefined {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
}

async function collectSourceFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async entry => {
      const entryPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        return collectSourceFiles(entryPath);
      }

      if (!/\.[cm]?[jt]sx?$/.test(entry.name) || /\.test\.[cm]?[jt]sx?$/.test(entry.name)) {
        return [];
      }

      return [entryPath];
    }),
  );

  return files.flat();
}

function hasRuntimeImportClause(importClause: ts.ImportClause | undefined): boolean {
  if (!importClause) return true;
  if (importClause.isTypeOnly) return false;
  if (importClause.name) return true;

  const namedBindings = importClause.namedBindings;
  if (namedBindings && ts.isNamedImports(namedBindings)) {
    return namedBindings.elements.some(element => !element.isTypeOnly);
  }

  return Boolean(namedBindings);
}

function getServerOnlyRuntimeImports(filePath: string, sourceText: string): string[] {
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const imports: string[] = [];

  function visit(node: ts.Node) {
    if (
      ts.isImportDeclaration(node) &&
      isServerOnlyRuntimeModule(getLiteralModuleSpecifier(node.moduleSpecifier) ?? '') &&
      hasRuntimeImportClause(node.importClause)
    ) {
      imports.push(getLiteralModuleSpecifier(node.moduleSpecifier) ?? '');
    }

    if (
      ts.isExportDeclaration(node) &&
      !node.isTypeOnly &&
      node.moduleSpecifier &&
      isServerOnlyRuntimeModule(getLiteralModuleSpecifier(node.moduleSpecifier) ?? '')
    ) {
      imports.push(getLiteralModuleSpecifier(node.moduleSpecifier) ?? '');
    }

    if (ts.isImportEqualsDeclaration(node) && !node.isTypeOnly && ts.isExternalModuleReference(node.moduleReference)) {
      const moduleSpecifier = getLiteralModuleSpecifier(node.moduleReference.expression);
      if (moduleSpecifier && isServerOnlyRuntimeModule(moduleSpecifier)) {
        imports.push(moduleSpecifier);
      }
    }

    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const moduleSpecifier = node.arguments[0] ? getLiteralModuleSpecifier(node.arguments[0]) : undefined;
      if (moduleSpecifier && isServerOnlyRuntimeModule(moduleSpecifier)) {
        imports.push(moduleSpecifier);
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return imports;
}

describe('browser runtime imports', () => {
  it('does not value-import server-only core modules into Playground source', async () => {
    const files = await collectSourceFiles(SRC_DIR);
    const violations: string[] = [];

    await Promise.all(
      files.map(async filePath => {
        const imports = getServerOnlyRuntimeImports(filePath, await fs.readFile(filePath, 'utf8'));

        for (const importedModule of imports) {
          violations.push(`${path.relative(PLAYGROUND_ROOT, filePath)} imports ${importedModule}`);
        }
      }),
    );

    expect(violations).toEqual([]);
  });
});
