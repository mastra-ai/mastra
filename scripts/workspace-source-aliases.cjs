const { existsSync, readFileSync, readdirSync } = require('node:fs');
const { dirname, join } = require('node:path');

const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'];
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

function findPackageJsonFiles(dir) {
  const results = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (entry.isFile() && entry.name === 'package.json') {
      results.push(join(dir, entry.name));
      continue;
    }
    if (!entry.isDirectory()) continue;
    if (SKIP_DIRS.has(entry.name)) continue;
    if (entry.name === '__fixtures__' || entry.name === 'fixtures' || entry.name === 'test-fixtures') continue;
    results.push(...findPackageJsonFiles(join(dir, entry.name)));
  }

  return results;
}

function getRuntimeExportPath(exportEntry) {
  if (typeof exportEntry === 'string') return exportEntry;
  if (!exportEntry || typeof exportEntry !== 'object') return null;

  for (const condition of ['import', 'default', 'require']) {
    const path = getRuntimeExportPath(exportEntry[condition]);
    if (path) return path;
  }

  return null;
}

function sourceTargetExists(sourcePath) {
  return (
    existsSync(sourcePath) ||
    EXTENSIONS.some(extension => existsSync(`${sourcePath}${extension}`)) ||
    EXTENSIONS.some(extension => existsSync(join(sourcePath, `index${extension}`)))
  );
}

function addExportAliases(aliases, packageName, packageDir, exports) {
  if (!exports || typeof exports !== 'object') return;

  for (const [exportName, exportEntry] of Object.entries(exports)) {
    if (exportName === '.' || !exportName.startsWith('./')) continue;

    const runtimeExportPath = getRuntimeExportPath(exportEntry);
    if (!runtimeExportPath?.startsWith('./dist/') || !/\.[cm]?js$/.test(runtimeExportPath)) continue;

    const isPattern = exportName.endsWith('/*');
    const subpath = exportName.slice(2).replace(/\/\*$/, '');
    if (!subpath || subpath === '*') continue;

    const sourcePath = runtimeExportPath
      .replace(/^\.\/dist\//, 'src/')
      .replace(/\/\*/, '')
      .replace(/\.[cm]?js$/, '');
    const target = join(packageDir, sourcePath);
    if (!sourceTargetExists(target)) continue;

    aliases.push({ name: `${packageName}/${subpath}`, target, exact: !isPattern });
  }
}

function buildWorkspaceSourceAliases(root) {
  const aliases = [];

  for (const packageJsonPath of findPackageJsonFiles(root)) {
    const packageDir = dirname(packageJsonPath);
    const srcDir = join(packageDir, 'src');
    if (!existsSync(srcDir)) continue;
    if (packageDir.includes('__fixtures__') || packageDir.includes('/fixtures/')) continue;

    const json = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    if (!json.name) continue;

    addExportAliases(aliases, json.name, packageDir, json.exports);
    aliases.push({ name: json.name, target: srcDir, exact: false });
  }

  return aliases;
}

module.exports = { buildWorkspaceSourceAliases };
