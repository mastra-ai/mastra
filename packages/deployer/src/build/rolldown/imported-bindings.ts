import { parseSync } from 'rolldown/utils';

type AstNode = { type?: unknown; [key: string]: unknown };

function walk(node: unknown, visit: (node: AstNode) => void) {
  if (!node || typeof node !== 'object') {
    return;
  }
  if (Array.isArray(node)) {
    for (const child of node) {
      walk(child, visit);
    }
    return;
  }

  const astNode = node as AstNode;
  if (typeof astNode.type === 'string') {
    visit(astNode);
  }
  for (const key in astNode) {
    if (key !== 'parent') {
      walk(astNode[key], visit);
    }
  }
}

function isStringLiteral(node: unknown): node is { value: string } {
  return !!node && (node as AstNode).type === 'Literal' && typeof (node as { value?: unknown }).value === 'string';
}

/**
 * Rebuilds Rollup's `OutputChunk.importedBindings` (which Rolldown doesn't expose) plus the chunk's dynamic imports
 * from the generated code of a single-chunk build.
 *
 * - `import x from 'a'` -> `default`, `import * as x` / `export * from` -> `*`, named imports and re-exports keep
 *   their name, `import 'a'` records the package with no bindings.
 * - `require()` calls of externals stay `__require('a')` in Rolldown output. `@rollup/plugin-commonjs` turned them into
 *   default imports, so they are recorded as `default`. Only calls that survived in the output count.
 * - Dynamic imports are read from the code, as `chunk.dynamicImports` also lists imports from removed dead branches.
 */
export function extractImportedBindings(
  code: string,
  requiredExternals: ReadonlySet<string> = new Set(),
): { importedBindings: Record<string, string[]>; dynamicImports: string[] } {
  const bindings = new Map<string, Set<string>>();
  const add = (source: string, name?: string) => {
    let names = bindings.get(source);
    if (!names) {
      names = new Set();
      bindings.set(source, names);
    }
    if (name) {
      names.add(name);
    }
  };

  const { module, program, errors } = parseSync('analyze.mjs', code, { sourceType: 'module', lang: 'js' });
  if (errors.length) {
    throw new Error(`Failed to parse analyzed entry: ${errors[0]!.message}`);
  }

  for (const staticImport of module.staticImports) {
    const source = staticImport.moduleRequest.value;
    add(source);
    for (const entry of staticImport.entries) {
      if (entry.isType) {
        continue;
      }
      const { kind, name } = entry.importName;
      add(source, kind === 'Default' ? 'default' : kind === 'NamespaceObject' ? '*' : (name ?? undefined));
    }
  }

  for (const staticExport of module.staticExports) {
    for (const entry of staticExport.entries) {
      if (!entry.moduleRequest || entry.isType) {
        continue;
      }
      const { kind, name } = entry.importName;
      add(entry.moduleRequest.value, kind === 'Name' ? (name ?? undefined) : '*');
    }
  }

  const dynamicImports = new Set<string>();
  for (const dynamicImport of module.dynamicImports) {
    const request = code.slice(dynamicImport.moduleRequest.start, dynamicImport.moduleRequest.end);
    const literal = /^(["'`])([^"'`$\\]*)\1$/.exec(request);
    if (literal?.[2]) {
      dynamicImports.add(literal[2]);
    }
  }

  if (requiredExternals.size) {
    walk(program, node => {
      if (node.type !== 'CallExpression') {
        return;
      }
      const callee = node.callee as AstNode | undefined;
      const args = node.arguments as unknown[] | undefined;
      if (callee?.type !== 'Identifier' || args?.length !== 1 || !isStringLiteral(args[0])) {
        return;
      }
      const calleeName = (callee as { name?: string }).name;
      if ((calleeName === '__require' || calleeName === 'require') && requiredExternals.has(args[0].value)) {
        add(args[0].value, 'default');
      }
    });
  }

  return {
    importedBindings: Object.fromEntries([...bindings].map(([source, names]) => [source, [...names]])),
    dynamicImports: [...dynamicImports],
  };
}
