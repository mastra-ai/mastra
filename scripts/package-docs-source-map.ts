/**
 * Builds the `SOURCE_MAP.json` that `generate-package-docs.ts` embeds in `dist/docs/assets/`.
 *
 * It maps each public export name of a package to the `.d.ts` file that declares it and the
 * bundled `.js` file (plus line) that implements it. The bundler (tsdown) emits module entries
 * like `import { n as Agent } from "../agent-xyz.js"; export { Agent };`, where `n` is only the
 * name the chunk exports the binding under. The chunk itself ends with `export { Agent as n }`,
 * so finding the declaration means following that alias back to the declared identifier.
 */

import fs from 'node:fs';
import path from 'node:path';

export interface ExportInfo {
  types: string;
  implementation: string;
  line?: number;
}

export interface ModuleInfo {
  index: string;
  chunks: string[];
}

export interface SourceMap {
  version: string;
  package: string;
  exports: Record<string, ExportInfo>;
  modules: Record<string, ModuleInfo>;
}

/**
 * One public binding of an ES module.
 * - `reexport`: the binding comes from `source`, where it is exported as `imported` (`'*'` for a namespace).
 * - `local`: the binding is declared in this file under the identifier `local`.
 * - `star`: `export * from source`; every export of `source` except `default` is re-exported.
 */
export type ModuleExport =
  | { kind: 'reexport'; name: string; imported: string; source: string }
  | { kind: 'local'; name: string; local: string }
  | { kind: 'star'; source: string };

interface Specifier {
  from: string;
  to: string;
}

function unquote(name: string): string {
  return name.replace(/^["']|["']$/g, '');
}

// Parses the inside of `{ ... }` in an import or export statement. Type-only specifiers are skipped
// because they have no runtime binding.
function parseSpecifiers(list: string): Specifier[] {
  const specifiers: Specifier[] = [];
  for (const raw of list.split(',')) {
    const spec = raw.trim();
    if (!spec || /^type\s/.test(spec)) continue;
    const [from, to = from] = spec.split(/\s+as\s+/).map(s => unquote(s.trim()));
    if (from && to) specifiers.push({ from, to });
  }
  return specifiers;
}

const IMPORT_RE = /^import\s+(?!type\s)([^'";]*?)\s*from\s*["']([^"']+)["']/gm;
const EXPORT_LIST_FROM_RE = /^export\s+(type\s+)?\{([^}]*)\}\s*from\s*["']([^"']+)["']/gm;
const EXPORT_LIST_RE = /^export\s+(type\s+)?\{([^}]*)\}(?!\s*from\b)/gm;
const EXPORT_STAR_RE = /^export\s+\*\s*(?:as\s+([\w$]+|"[^"]+"|'[^']+')\s*)?from\s*["']([^"']+)["']/gm;
const EXPORT_DECLARATION_RE =
  /^export\s+(?:declare\s+)?(?:abstract\s+)?(?:async\s+)?(?:function\*?|class|const|let|var|enum|namespace|interface|type)\s+([\w$]+)/gm;
const EXPORT_DEFAULT_RE = /^export\s+default\b/m;

/**
 * Lists the bindings an ES module (`.js` or `.d.ts`) exports. Imported bindings that are exported
 * again with `export { Name }` are reported as re-exports of their source module.
 */
export function parseModuleExports(content: string): ModuleExport[] {
  const imports = new Map<string, { imported: string; source: string }>();
  for (const match of content.matchAll(IMPORT_RE)) {
    const clause = match[1]!;
    const source = match[2]!;
    const braces = clause.match(/\{([^}]*)\}/);
    if (braces) {
      for (const { from, to } of parseSpecifiers(braces[1]!)) imports.set(to, { imported: from, source });
    }
    const namespace = clause.match(/\*\s*as\s+([\w$]+)/);
    if (namespace) imports.set(namespace[1]!, { imported: '*', source });
    const defaultImport = clause.match(/^([\w$]+)\s*(?:,|$)/);
    if (defaultImport) imports.set(defaultImport[1]!, { imported: 'default', source });
  }

  const exports: ModuleExport[] = [];

  for (const match of content.matchAll(EXPORT_LIST_FROM_RE)) {
    if (match[1]) continue;
    for (const { from, to } of parseSpecifiers(match[2]!)) {
      exports.push({ kind: 'reexport', name: to, imported: from, source: match[3]! });
    }
  }

  for (const match of content.matchAll(EXPORT_LIST_RE)) {
    if (match[1]) continue;
    for (const { from, to } of parseSpecifiers(match[2]!)) {
      const imported = imports.get(from);
      exports.push(
        imported
          ? { kind: 'reexport', name: to, imported: imported.imported, source: imported.source }
          : { kind: 'local', name: to, local: from },
      );
    }
  }

  for (const match of content.matchAll(EXPORT_STAR_RE)) {
    exports.push(
      match[1]
        ? { kind: 'reexport', name: unquote(match[1]), imported: '*', source: match[2]! }
        : { kind: 'star', source: match[2]! },
    );
  }

  for (const match of content.matchAll(EXPORT_DECLARATION_RE)) {
    exports.push({ kind: 'local', name: match[1]!, local: match[1]! });
  }
  if (EXPORT_DEFAULT_RE.test(content)) {
    exports.push({ kind: 'local', name: 'default', local: 'default' });
  }

  return exports;
}

// Both patterns only match at the start of a line (after `\n`), so they find top-level declarations.
const DECLARATION_LINE_RE =
  /(?<![^\n])(?:export\s+)?(?:declare\s+)?(?:(?:var|let|const)\s+([\w$]+)\s*=|(?:async\s+)?function\s*\*?\s*([\w$]+)\s*\(|(?:abstract\s+)?class\s+([\w$]+))/g;
const TYPE_DECLARATION_RE =
  /(?<![^\n])(?:export\s+)?(?:default\s+)?(?:declare\s+)?(?:abstract\s+)?(?:async\s+)?(?:function\*?|class|const|let|var|enum|namespace|interface|type)\s+([\w$]+)/g;

/**
 * Maps each identifier declared at the top level of `content` to the 1-indexed line of its first
 * declaration. Built in one pass so looking up many exports in a large chunk stays linear.
 */
export function indexDeclarationLines(content: string): Map<string, number> {
  const result = new Map<string, number>();
  let line = 1;
  let newline = content.indexOf('\n');
  for (const match of content.matchAll(DECLARATION_LINE_RE)) {
    while (newline !== -1 && newline < match.index) {
      line++;
      newline = content.indexOf('\n', newline + 1);
    }
    const name = match[1] ?? match[2] ?? match[3]!;
    if (!result.has(name)) result.set(name, line);
  }
  return result;
}

/** Lists the identifiers `.d.ts` content declares itself (exported or not). */
function indexDeclaredTypes(content: string): Set<string> {
  return new Set(Array.from(content.matchAll(TYPE_DECLARATION_RE), match => match[1]!));
}

type PublicExport = Exclude<ModuleExport, { kind: 'star' }> & { from: string };

interface Resolved {
  file: string;
  identifier: string;
}

const MAX_DEPTH = 25;

export class SourceMapResolver {
  private readonly contents = new Map<string, string | null>();
  private readonly parsed = new Map<string, ModuleExport[]>();
  private readonly publicCache = new Map<string, Map<string, PublicExport>>();
  private readonly declarationLines = new Map<string, Map<string, number>>();
  private readonly declaredTypes = new Map<string, Set<string>>();

  constructor(private readonly readFile: (file: string) => string | null = defaultReadFile) {}

  read(file: string): string | null {
    let content = this.contents.get(file);
    if (content === undefined) {
      content = this.readFile(file);
      this.contents.set(file, content);
    }
    return content;
  }

  exportsOf(file: string): ModuleExport[] {
    let exports = this.parsed.get(file);
    if (!exports) {
      exports = parseModuleExports(this.read(file) ?? '');
      this.parsed.set(file, exports);
    }
    return exports;
  }

  /**
   * Lists the public export names of `file` with the first module each one resolves to. Relative
   * `export *` statements are expanded; `export *` from other packages is skipped because its names
   * cannot be known without resolving that package.
   */
  publicExports(file: string): Map<string, PublicExport> {
    let result = this.publicCache.get(file);
    if (!result) {
      result = this.collectPublicExports(file, new Set());
      this.publicCache.set(file, result);
    }
    return result;
  }

  /** Returns the 1-indexed line that declares `identifier` at the top level of `file`, if any. */
  declarationLine(file: string, identifier: string): number | undefined {
    let index = this.declarationLines.get(file);
    if (!index) {
      index = indexDeclarationLines(this.read(file) ?? '');
      this.declarationLines.set(file, index);
    }
    return index.get(identifier);
  }

  private declaresType(file: string, identifier: string): boolean {
    let index = this.declaredTypes.get(file);
    if (!index) {
      index = indexDeclaredTypes(this.read(file) ?? '');
      this.declaredTypes.set(file, index);
    }
    return index.has(identifier);
  }

  private collectPublicExports(file: string, seen: Set<string>): Map<string, PublicExport> {
    const result = new Map<string, PublicExport>();
    if (seen.has(file)) return result;
    seen.add(file);

    for (const entry of this.exportsOf(file)) {
      if (entry.kind === 'star') continue;
      if (!result.has(entry.name)) result.set(entry.name, { ...entry, from: file });
    }
    for (const entry of this.exportsOf(file)) {
      if (entry.kind !== 'star') continue;
      const target = this.resolveJs(file, entry.source);
      if (!target) continue;
      for (const [name, info] of this.collectPublicExports(target, seen)) {
        if (name !== 'default' && !result.has(name)) result.set(name, info);
      }
    }
    return result;
  }

  /** Follows `name` exported from `file` through re-exports to the `.js` file that declares it. */
  resolveImplementation(file: string, name: string, depth = 0): Resolved | undefined {
    if (depth > MAX_DEPTH) return undefined;
    const entry = this.publicExports(file).get(name);
    if (!entry) return undefined;
    if (entry.kind === 'local') return { file: entry.from, identifier: entry.local };
    const target = this.resolveJs(entry.from, entry.source);
    if (!target) return undefined;
    if (entry.imported === '*') return { file: target, identifier: '*' };
    // Bindings the target does not export locally (e.g. through `export * from "other-package"`)
    // belong to another package, so they resolve to `undefined`.
    return this.resolveImplementation(target, entry.imported, depth + 1);
  }

  /** Follows `name` exported from the `.d.ts` `file` through re-exports to the `.d.ts` that declares it. */
  resolveTypes(file: string, name: string, depth = 0, seen = new Set<string>()): string | undefined {
    const key = `${file}#${name}`;
    if (depth > MAX_DEPTH || seen.has(key)) return undefined;
    seen.add(key);

    if (this.read(file) === null) return undefined;

    for (const entry of this.exportsOf(file)) {
      if (entry.kind === 'star' || entry.name !== name) continue;
      if (entry.kind === 'local') return this.declaresType(file, entry.local) ? file : undefined;
      const target = this.resolveDts(file, entry.source);
      if (!target) return undefined;
      if (entry.imported === '*') return target;
      return this.resolveTypes(target, entry.imported, depth + 1, seen);
    }

    for (const entry of this.exportsOf(file)) {
      if (entry.kind !== 'star') continue;
      const target = this.resolveDts(file, entry.source);
      const resolved = target && this.resolveTypes(target, name, depth + 1, seen);
      if (resolved) return resolved;
    }
    return undefined;
  }

  private resolveJs(fromFile: string, specifier: string): string | undefined {
    if (!specifier.startsWith('.')) return undefined;
    const target = path.resolve(path.dirname(fromFile), specifier);
    return this.read(target) === null ? undefined : target;
  }

  private resolveDts(fromFile: string, specifier: string): string | undefined {
    if (!specifier.startsWith('.')) return undefined;
    const base = path.resolve(path.dirname(fromFile), specifier).replace(/\.(?:js|ts|d\.ts)$/, '');
    return [`${base}.d.ts`, path.join(base, 'index.d.ts')].find(candidate => this.read(candidate) !== null);
  }
}

function defaultReadFile(file: string): string | null {
  try {
    return fs.statSync(file).isFile() ? fs.readFileSync(file, 'utf-8') : null;
  } catch {
    return null;
  }
}

// Modules of `@mastra/core` that are mapped in addition to the package root entry.
const DEFAULT_MODULES = [
  'agent',
  'tools',
  'workflows',
  'memory',
  'stream',
  'llm',
  'mastra',
  'mcp',
  'evals',
  'processors',
  'storage',
  'vector',
  'voice',
];

export function generateSourceMap(
  packageRoot: string,
  packageJson: { name: string; version: string },
  modules: string[] = DEFAULT_MODULES,
  resolver = new SourceMapResolver(),
): SourceMap {
  const distDir = path.join(packageRoot, 'dist');
  const toPackagePath = (file: string) => path.relative(packageRoot, file).split(path.sep).join('/');

  const sourceMap: SourceMap = {
    version: packageJson.version,
    package: packageJson.name,
    exports: {},
    modules: {},
  };

  // Each module entry is mapped first; root entry exports only fill in names no module provided.
  const entries = [...modules.map(mod => ({ mod, dir: path.join(distDir, mod) })), { mod: undefined, dir: distDir }];

  for (const { mod, dir } of entries) {
    const indexPath = path.join(dir, 'index.js');
    if (resolver.read(indexPath) === null) continue;

    const indexTypes = path.join(dir, 'index.d.ts');
    const hasIndexTypes = resolver.read(indexTypes) !== null;
    const chunks = new Set<string>();

    for (const name of resolver.publicExports(indexPath).keys()) {
      if (name === 'default') continue;
      const impl = resolver.resolveImplementation(indexPath, name);
      // Bindings re-exported from other packages have no implementation in this package.
      if (!impl) continue;

      const relativeChunk = path.relative(distDir, impl.file).split(path.sep).join('/');
      if (impl.file !== indexPath) chunks.add(relativeChunk);
      if (sourceMap.exports[name]) continue;

      const types =
        (hasIndexTypes && resolver.resolveTypes(indexTypes, name)) || (hasIndexTypes ? indexTypes : undefined);
      if (!types) continue;

      const line = impl.identifier === '*' ? undefined : resolver.declarationLine(impl.file, impl.identifier);

      sourceMap.exports[name] = {
        types: toPackagePath(types),
        implementation: toPackagePath(impl.file),
        line,
      };
    }

    if (mod) {
      sourceMap.modules[mod] = {
        index: toPackagePath(indexPath),
        chunks: [...chunks],
      };
    }
  }

  return sourceMap;
}
