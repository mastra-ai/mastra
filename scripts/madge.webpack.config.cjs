/**
 * Webpack config consumed by madge (via enhanced-resolve) for the
 * affected-tests analyzer.
 *
 * Dynamically discovers every workspace package that has a `src/` directory
 * and aliases its package name to that source directory. This, combined with
 * emptying `exportsFields` / `mainFields` / `aliasFields`, forces resolution
 * onto TypeScript source files instead of bundled `dist/` output — which is
 * what lets madge trace through the workspace at the source level.
 */

const { readFileSync, readdirSync, existsSync } = require('node:fs');
const { join, dirname } = require('node:path');

const ROOT = join(__dirname, '..');

const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  '.pnpm',
  '.turbo',
  '.git',
  '.next',
  '.mastra',
  '.claude',
  '.mastracode',
  '.agents',
]);

/**
 * Recursively find all package.json files under `dir`, skipping build
 * artifacts and node_modules.
 */
function findPackageJsonFiles(dir) {
  const results = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() && !entry.isFile()) continue;
    if (entry.name === 'package.json' && entry.isFile()) {
      results.push(join(dir, entry.name));
      continue;
    }
    if (!entry.isDirectory()) continue;
    if (SKIP_DIRS.has(entry.name)) continue;

    const fullPath = join(dir, entry.name);
    // Exclude fixture/scaffold directories anywhere in the tree
    if (entry.name === '__fixtures__' || entry.name === 'fixtures' || entry.name === 'test-fixtures') continue;

    results.push(...findPackageJsonFiles(fullPath));
  }
  return results;
}

/**
 * Build the alias map: package name → absolute path to src/ dir.
 */
function buildAliasMap() {
  const alias = {};
  const packageJsons = findPackageJsonFiles(ROOT);

  for (const pkgJsonPath of packageJsons) {
    const pkgDir = dirname(pkgJsonPath);
    const srcDir = join(pkgDir, 'src');

    if (!existsSync(srcDir)) continue;

    // Skip fixture packages
    if (pkgDir.includes('__fixtures__') || pkgDir.includes('/fixtures/')) continue;

    let json;
    try {
      json = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
    } catch {
      continue;
    }

    if (!json.name) continue;

    alias[json.name] = srcDir;
  }

  return alias;
}

const aliasMap = buildAliasMap();

module.exports = {
  resolve: {
    alias: aliasMap,
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json'],
    exportsFields: [],
    mainFields: [],
    aliasFields: [],
  },
};
