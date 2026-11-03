import { parseSync } from 'rolldown/utils';

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Returns the ids that appear as the single string argument of a plain `__require()`/`require()` call. Member calls
 * like `module.require('x')` and other identifiers ending in `require` don't count.
 *
 * Scans the text instead of the AST: building the ESTree of a multi-MB chunk only to find these calls cost hundreds of
 * milliseconds per build. Unlike the AST, the scan also matches calls inside comments and strings; the ids come from
 * `require()` calls Rolldown resolved, so such a match can only keep a dependency that was otherwise dropped.
 */
function findRequiredIds(code: string, ids: ReadonlySet<string>): Set<string> {
  const found = new Set<string>();
  if (!ids.size || !code.includes('require')) {
    return found;
  }

  const alternatives = [...ids].map(escapeRegExp).join('|');
  const requireCall = new RegExp(
    `(?<![\\w$]|\\.\\s*)(?:__require|require)\\s*\\(\\s*(["'\`])(${alternatives})\\1\\s*\\)`,
    'g',
  );
  for (const match of code.matchAll(requireCall)) {
    found.add(match[2]!);
  }
  return found;
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

  // Only read `module` and `errors`: the result serializes the ESTree `program` lazily, on first access.
  const { module, errors } = parseSync('analyze.mjs', code, { sourceType: 'module', lang: 'js' });
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

  for (const id of findRequiredIds(code, requiredExternals)) {
    add(id, 'default');
  }

  return {
    importedBindings: Object.fromEntries([...bindings].map(([source, names]) => [source, [...names]])),
    dynamicImports: [...dynamicImports],
  };
}
