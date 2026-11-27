import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse as parseYaml } from 'yaml';

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];
export const RESOLVER_PLUGIN_NAME = 'mastra-workspace-source-resolver';
const indexCache = new Map();
const SOURCE_FILE_RE = /\.(?:[cm]?[jt]sx?)$/;
const IMPORT_SPECIFIER_RE = /(\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\bvi\.mock\(\s*)(['"])([^'"\n]+)\2/g;

/**
 * @param {{ root?: string, disabled?: boolean }} options
 * @returns {import('vite').Plugin}
 */
export function workspaceSourceResolver(options = {}) {
  const disabled = options.disabled ?? Boolean(process.env.MASTRA_TEST_DIST);
  const workspaceRoot = options.root ? resolve(options.root) : findWorkspaceRoot();

  const getIndex = () => {
    let index = indexCache.get(workspaceRoot);
    if (!index) {
      index = createWorkspacePackageIndex(workspaceRoot);
      indexCache.set(workspaceRoot, index);
    }
    return index;
  };

  return {
    name: RESOLVER_PLUGIN_NAME,
    enforce: 'pre',
    // Vitest caches transforms on disk keyed by plugin names, not plugin code. Transformed modules bake in
    // resolved import paths, so key them on this resolver's code and the workspace export maps too.
    configureVitest({ defineCacheKeyGenerator }) {
      if (disabled || !defineCacheKeyGenerator) return;
      const cacheKey = resolverCacheKey(workspaceRoot, getIndex());
      defineCacheKeyGenerator(() => cacheKey);
    },
    transform(code, id) {
      if (disabled) return null;
      const file = splitQuery(id).specifier;
      if (!SOURCE_FILE_RE.test(file) || file.includes(`${sep}node_modules${sep}`)) return null;

      const projectRoot = this.environment?.config?.root;
      return rewritePackagePathAliases(code, file, getIndex(), projectRoot);
    },
    async resolveId(id, importer, resolveOptions) {
      if (disabled || shouldIgnoreId(id)) return null;

      const index = getIndex();
      const resolved = resolveWorkspaceSource(id, index, importer);
      if (!resolved) return null;

      // Shared setup files mock packages by name for their consumers (e.g. `vi.mock('@mastra/core/mastra')`).
      // In that package's own suite, resolving the name to source would make the mock hit the modules its
      // tests import relatively, which never happens against dist. Leave those setup imports alone.
      if (importer && isOwnPackageSetupImport(this.environment?.config, importer, resolved.packageDir, index)) {
        return null;
      }

      if (importer && normalizePath(resolve(splitQuery(importer).specifier)) === normalizePath(resolved.path)) {
        return null;
      }

      return this.resolve(resolved.path + resolved.query, importer, {
        ...resolveOptions,
        skipSelf: true,
      });
    },
  };
}

function resolverCacheKey(workspaceRoot, packages) {
  const hash = createHash('sha1');
  for (const file of ['vitest-source-resolver.js', 'vitest.js']) {
    hash.update(readFileSync(fileURLToPath(new URL(`./${file}`, import.meta.url))));
  }
  for (const [name, pkg] of packages) {
    hash.update(JSON.stringify([name, relative(workspaceRoot, pkg.dir), pkg.exports, readPathAliases(pkg.dir)]));
  }
  return hash.digest('hex');
}

/** @param {string} root */
export function createWorkspacePackageIndex(root) {
  const workspacePath = join(root, 'pnpm-workspace.yaml');
  if (!existsSync(workspacePath)) return new Map();

  const workspace = parseYaml(readFileSync(workspacePath, 'utf8'));
  const packagePatterns = Array.isArray(workspace?.packages) ? workspace.packages : [];
  const packages = new Map();

  for (const pattern of packagePatterns) {
    if (typeof pattern !== 'string' || pattern.startsWith('!')) continue;

    for (const packageDir of expandWorkspacePattern(root, pattern)) {
      const relativeDir = normalizePath(relative(root, packageDir));
      if (relativeDir === 'e2e-tests' || relativeDir.startsWith('e2e-tests/')) continue;

      const manifestPath = join(packageDir, 'package.json');
      if (!existsSync(manifestPath)) continue;

      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      if (!manifest.name || !manifest.exports) continue;

      packages.set(manifest.name, {
        name: manifest.name,
        dir: packageDir,
        exports: manifest.exports,
      });
    }
  }

  return packages;
}

/**
 * @param {string} id
 * @param {Map<string, { name: string, dir: string, exports: unknown }>} packages
 * @param {string | undefined} importer
 */
export function resolveWorkspaceSource(id, packages, importer) {
  const { specifier, query } = splitQuery(id);
  const match = findPackageForSpecifier(specifier, packages);
  if (!match) return null;

  const source = resolveExportSource(match.pkg, match.subpath);
  if (!source) return null;

  if (
    importer &&
    isInsidePath(source, dirname(splitQuery(importer).specifier)) &&
    normalizePath(importer).startsWith(normalizePath(source))
  ) {
    return null;
  }

  return { path: source, query, packageDir: match.pkg.dir };
}

export function findWorkspaceRoot() {
  let current = dirname(fileURLToPath(import.meta.url));
  while (current !== dirname(current)) {
    if (existsSync(join(current, 'pnpm-workspace.yaml'))) return current;
    current = dirname(current);
  }
  return process.cwd();
}

/** @param {string} id */
function shouldIgnoreId(id) {
  return (
    id.startsWith('.') ||
    id.startsWith('/') ||
    id.startsWith('\0') ||
    id.startsWith('node:') ||
    id.includes('/node_modules/') ||
    /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(id)
  );
}

function splitQuery(id) {
  const questionIndex = id.indexOf('?');
  const hashIndex = id.indexOf('#');
  const queryIndex =
    questionIndex === -1 ? hashIndex : hashIndex === -1 ? questionIndex : Math.min(questionIndex, hashIndex);

  if (queryIndex === -1) return { specifier: id, query: '' };
  return { specifier: id.slice(0, queryIndex), query: id.slice(queryIndex) };
}

function expandWorkspacePattern(root, pattern) {
  const normalized = normalizePath(pattern);
  if (!normalized.includes('*')) {
    return [resolve(root, normalized)];
  }

  const parts = normalized.split('/');
  const wildcardIndex = parts.indexOf('*');
  if (wildcardIndex === -1 || parts.lastIndexOf('*') !== wildcardIndex) return [];

  const base = resolve(root, parts.slice(0, wildcardIndex).join('/'));
  const rest = parts.slice(wildcardIndex + 1);
  if (!existsSync(base)) return [];

  return readdirSync(base, { withFileTypes: true })
    .filter(entry => entry.isDirectory())
    .map(entry => join(base, entry.name, ...rest));
}

/** @param {string} specifier @param {Map<string, { name: string, dir: string, exports: unknown }>} packages */
function findPackageForSpecifier(specifier, packages) {
  const parts = specifier.split('/');
  const packageName = specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
  const pkg = packages.get(packageName);
  if (!pkg) return null;

  const remaining = specifier.slice(packageName.length);
  return {
    pkg,
    subpath: remaining ? `.${remaining}` : '.',
  };
}

/** @param {{ dir: string, exports: unknown }} pkg @param {string} subpath */
function resolveExportSource(pkg, subpath) {
  const target = selectExportTarget(pkg.exports, subpath);
  if (!target) return null;

  const sourceCandidates = distTargetToSourceCandidates(pkg.dir, target);
  const mirrored = sourceCandidates.find(candidate => existsSync(candidate));
  if (mirrored || sourceCandidates.length === 0) return mirrored ?? null;

  // Some builds flatten a grouping folder (`src/ds/components/*` -> `dist/components/*`). Accept the
  // one-level-deeper source only when exactly one grouping folder matches.
  const srcDir = join(pkg.dir, 'src');
  const nested = sourceGroupDirs(srcDir).flatMap(group => {
    const match = sourceCandidates.find(candidate => existsSync(join(group, relative(srcDir, candidate))));
    return match ? [join(group, relative(srcDir, match))] : [];
  });
  return nested.length === 1 ? nested[0] : null;
}

const sourceGroupDirsCache = new Map();

function sourceGroupDirs(srcDir) {
  let dirs = sourceGroupDirsCache.get(srcDir);
  if (!dirs) {
    dirs = existsSync(srcDir)
      ? readdirSync(srcDir, { withFileTypes: true })
          .filter(entry => entry.isDirectory() && !entry.name.startsWith('__') && !entry.name.startsWith('.'))
          .map(entry => join(srcDir, entry.name))
      : [];
    sourceGroupDirsCache.set(srcDir, dirs);
  }
  return dirs;
}

function selectExportTarget(exportsField, subpath) {
  if (typeof exportsField === 'string') return subpath === '.' ? exportsField : null;
  if (Array.isArray(exportsField)) return pickFromArray(exportsField, subpath);
  if (!exportsField || typeof exportsField !== 'object') return null;

  const exportsObject = /** @type {Record<string, unknown>} */ (exportsField);
  if (Object.keys(exportsObject).some(key => key.startsWith('.'))) {
    if (Object.hasOwn(exportsObject, subpath)) return selectConditionalTarget(exportsObject[subpath]);

    for (const [key, value] of Object.entries(exportsObject)) {
      if (!key.includes('*')) continue;
      const wildcard = matchWildcardExport(key, subpath);
      if (wildcard === null) continue;

      const target = selectConditionalTarget(value);
      return typeof target === 'string' ? target.replaceAll('*', wildcard) : null;
    }

    return null;
  }

  return subpath === '.' ? selectConditionalTarget(exportsField) : null;
}

function pickFromArray(values, subpath) {
  for (const value of values) {
    const target = typeof value === 'string' ? value : selectExportTarget(value, subpath);
    if (target) return target;
  }
  return null;
}

function selectConditionalTarget(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return pickFromArray(value, '.');
  if (!value || typeof value !== 'object') return null;

  const object = /** @type {Record<string, unknown>} */ (value);
  for (const condition of ['import', 'default']) {
    const selected = selectConditionalTarget(object[condition]);
    if (selected) return selected;
  }

  return null;
}

function matchWildcardExport(pattern, subpath) {
  const [prefix, suffix] = pattern.split('*');
  if (!subpath.startsWith(prefix) || !subpath.endsWith(suffix)) return null;
  return subpath.slice(prefix.length, subpath.length - suffix.length);
}

function distTargetToSourceCandidates(packageDir, target) {
  if (isAbsolute(target) || !target.startsWith('./dist/')) return [];

  const jsOutputExtension = /\.(?:(?:es|cjs)\.)?(?:cjs|mjs|js|jsx)$/;
  if (!jsOutputExtension.test(target)) return [];

  const withoutDist = target.replace(/^\.\/dist\//, '').replace(jsOutputExtension, '');
  const candidates = [];

  for (const extension of SOURCE_EXTENSIONS) {
    candidates.push(join(packageDir, 'src', `${withoutDist}${extension}`));
  }

  if (withoutDist.endsWith('/index')) {
    const withoutIndex = withoutDist.slice(0, -'/index'.length);
    for (const extension of SOURCE_EXTENSIONS) {
      candidates.push(join(packageDir, 'src', `${withoutIndex}${extension}`));
    }
  } else {
    for (const extension of SOURCE_EXTENSIONS) {
      candidates.push(join(packageDir, 'src', withoutDist, `index${extension}`));
    }
  }

  return candidates;
}

/**
 * A package's own source can use its tsconfig `paths` (e.g. `@/*`), which the consuming project's
 * resolver doesn't know (or maps to its own `src`). Rewrite those imports to absolute paths, as
 * builds do for published output. The consuming project's own files keep its alias config.
 */
function rewritePackagePathAliases(code, file, packages, projectRoot) {
  const packageDir = findOwningPackageDir(file, packages);
  if (!packageDir) return null;
  if (projectRoot && findOwningPackageDir(resolve(projectRoot), packages) === packageDir) return null;

  const aliases = readPathAliases(packageDir);
  if (aliases.length === 0) return null;

  let changed = false;
  const rewritten = code.replace(IMPORT_SPECIFIER_RE, (match, prefix, quote, specifier) => {
    for (const { prefix: aliasPrefix, target } of aliases) {
      if (!specifier.startsWith(aliasPrefix)) continue;
      changed = true;
      const path = join(target, specifier.slice(aliasPrefix.length)).replaceAll(sep, '/');
      return `${prefix}${quote}${path}${quote}`;
    }
    return match;
  });
  return changed ? { code: rewritten, map: null } : null;
}

const pathAliasCache = new Map();

/** Wildcard `paths` from the package's tsconfig.json, e.g. `{ "@/*": ["./src/*"] }`. */
function readPathAliases(packageDir) {
  let aliases = pathAliasCache.get(packageDir);
  if (aliases) return aliases;

  aliases = [];
  const tsconfigPath = join(packageDir, 'tsconfig.json');
  if (existsSync(tsconfigPath)) {
    const compilerOptions = parseJsonc(readFileSync(tsconfigPath, 'utf8'))?.compilerOptions ?? {};
    const baseDir = resolve(packageDir, compilerOptions.baseUrl ?? '.');
    for (const [key, targets] of Object.entries(compilerOptions.paths ?? {})) {
      const target = Array.isArray(targets) ? targets[0] : undefined;
      if (!key.endsWith('/*') || typeof target !== 'string' || !target.endsWith('/*')) continue;
      if (key.startsWith('.') || key.startsWith('/')) continue;
      aliases.push({ prefix: key.slice(0, -1), target: resolve(baseDir, target.slice(0, -1)) });
    }
  }
  pathAliasCache.set(packageDir, aliases);
  return aliases;
}

/** JSON with comments and trailing commas, as tsconfig allows. */
function parseJsonc(text) {
  let output = '';
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      const start = i;
      for (i++; i < text.length && text[i] !== '"'; i++) if (text[i] === '\\') i++;
      output += text.slice(start, i + 1);
    } else if (char === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      output += '\n';
    } else if (char === '/' && text[i + 1] === '*') {
      i = text.indexOf('*/', i + 2);
      if (i === -1) break;
      i++;
    } else {
      output += char;
    }
  }
  try {
    return JSON.parse(output.replace(/,(\s*[}\]])/g, '$1'));
  } catch {
    return null;
  }
}

function isOwnPackageSetupImport(config, importer, packageDir, packages) {
  if (!config?.root) return false;
  const root = resolve(config.root);
  if (findOwningPackageDir(root, packages) !== packageDir) return false;

  const importerPath = normalizePath(resolve(splitQuery(importer).specifier));
  return toArray(config.test?.setupFiles).some(
    file => typeof file === 'string' && normalizePath(resolve(root, file)) === importerPath,
  );
}

function findOwningPackageDir(path, packages) {
  let owner;
  for (const pkg of packages.values()) {
    if (isInsidePath(path, pkg.dir) && (!owner || pkg.dir.length > owner.length)) owner = pkg.dir;
  }
  return owner;
}

function isInsidePath(child, parent) {
  const rel = relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function normalizePath(path) {
  return path.split(sep).join('/');
}

function toArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}
