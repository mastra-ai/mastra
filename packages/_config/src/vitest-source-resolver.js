import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse as parseYaml } from 'yaml';

const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];
const QUERY_RE = /([?#].*)$/;

/**
 * @param {{ root?: string, disabled?: boolean }} options
 * @returns {import('vite').Plugin}
 */
export function workspaceSourceResolver(options = {}) {
  const disabled = options.disabled ?? Boolean(process.env.CI);
  const workspaceRoot = options.root ? resolve(options.root) : findWorkspaceRoot();
  let index;

  return {
    name: 'mastra-workspace-source-resolver',
    enforce: 'pre',
    async resolveId(id, importer, resolveOptions) {
      if (disabled || shouldIgnoreId(id)) return null;

      index ??= createWorkspacePackageIndex(workspaceRoot);
      const resolved = resolveWorkspaceSource(id, index, importer);
      if (!resolved) return null;

      if (importer && normalizePath(resolve(importer.split(QUERY_RE)[0])) === normalizePath(resolved.path)) {
        return null;
      }

      return this.resolve(resolved.path + resolved.query, importer, {
        ...resolveOptions,
        skipSelf: true,
      });
    },
  };
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
    isInsidePath(source, dirname(importer.split(QUERY_RE)[0])) &&
    normalizePath(importer).startsWith(normalizePath(source))
  ) {
    return null;
  }

  return { path: source, query };
}

function findWorkspaceRoot() {
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
  const match = id.match(QUERY_RE);
  if (!match) return { specifier: id, query: '' };
  return { specifier: id.slice(0, match.index), query: match[1] };
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
  return sourceCandidates.find(candidate => existsSync(candidate)) ?? null;
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

function isInsidePath(child, parent) {
  const rel = relative(parent, child);
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function normalizePath(path) {
  return path.split(sep).join('/');
}
