#!/usr/bin/env node

/**
 * affected-tests — given changed source files, find which test files are
 * transitively affected.
 *
 * Usage:
 *   node scripts/affected-tests.mjs <file> [file...]
 *   node scripts/affected-tests.mjs --git
 *   node scripts/affected-tests.mjs --git --json
 *   node scripts/affected-tests.mjs packages/core/src/storage/index.ts --verbose
 *
 * Builds a full module graph from all test files using madge, inverts it into
 * a reverse dependency index, then for each changed source file does a reverse
 * BFS to find all transitively-dependent test files.
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, relative, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const flags = {
  git: false,
  json: false,
  verbose: false,
  fileLevel: false,
  compareSymbols: false,
  ignoreTypeOnlySymbols: true,
  includeTypeOnlyTypeTests: true,
  help: false,
};
const positional = [];

for (const arg of args) {
  if (arg === '--git') flags.git = true;
  else if (arg === '--json') flags.json = true;
  else if (arg === '--verbose') flags.verbose = true;
  else if (arg === '--symbol-aware') flags.fileLevel = false;
  else if (arg === '--file-level') flags.fileLevel = true;
  else if (arg === '--compare-symbols') flags.compareSymbols = true;
  else if (arg === '--include-type-only-symbols') flags.ignoreTypeOnlySymbols = false;
  else if (arg === '--ignore-type-only-symbols') flags.ignoreTypeOnlySymbols = true;
  else if (arg === '--no-type-only-type-tests') flags.includeTypeOnlyTypeTests = false;
  else if (arg === '--help' || arg === '-h') flags.help = true;
  else positional.push(arg);
}

if (flags.help) {
  console.log(`
affected-tests — find test files transitively affected by source changes

Usage:
  node scripts/affected-tests.mjs <file> [file...]   Explicit changed source files
  node scripts/affected-tests.mjs --git              Auto-detect from git diff

Options:
  --git                      Detect changed files via git diff (staged + unstaged + vs base)
  --json                     Output structured JSON instead of newline-separated paths
  --verbose                  Show dependency chain for each affected test
  --symbol-aware              Use symbol-aware barrel traversal for affected tests (default)
  --file-level                Use legacy file-level traversal instead of symbol-aware traversal
  --compare-symbols           Include file-level vs symbol-aware comparison in JSON output
  --include-type-only-symbols Include type-only edges in the main symbol traversal
  --ignore-type-only-symbols  Ignore type-only edges in the main symbol traversal (default)
  --no-type-only-type-tests   Disable the type-only follow-up pass for Vitest type-test files
  -h, --help                  Show this help message

Examples:
  node scripts/affected-tests.mjs packages/core/src/storage/index.ts
  node scripts/affected-tests.mjs --git --json
  node scripts/affected-tests.mjs packages/memory/src/index.ts --verbose

Output (default):
  Newline-separated test file paths, pipeable to vitest:
    node scripts/affected-tests.mjs --git | xargs pnpm vitest run
`);
  process.exit(0);
}

if (!flags.git && positional.length === 0) {
  console.error('Error: provide at least one file path, or use --git to auto-detect changes.');
  console.error('Run with --help for usage information.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Test file discovery
// ---------------------------------------------------------------------------

function discoverTestFiles() {
  // Use two patterns: '*.test.ts' catches top-level files (e.g. src/foo.test.ts)
  // and '**/*.test.ts' catches nested files. Dedupe via Set.
  // Also include .test.tsx and .spec.ts/.spec.tsx for completeness.
  const patterns = [
    '*.test.ts',
    '**/*.test.ts',
    '*.test.tsx',
    '**/*.test.tsx',
    '*.spec.ts',
    '**/*.spec.ts',
    '*.spec.tsx',
    '**/*.spec.tsx',
    '*.test-d.ts',
    '**/*.test-d.ts',
    '*.test-d.tsx',
    '**/*.test-d.tsx',
    '*.spec-d.ts',
    '**/*.spec-d.ts',
    '*.spec-d.tsx',
    '**/*.spec-d.tsx',
  ];

  const files = new Set();
  for (const pattern of patterns) {
    try {
      const output = execSync(`git ls-files '${pattern}'`, {
        cwd: ROOT,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      for (const line of output.trim().split('\n')) {
        if (!line) continue;
        // Exclude fixtures and node_modules
        if (line.includes('__fixtures__') || line.includes('/fixtures/') || line.includes('node_modules')) continue;
        files.add(line);
      }
    } catch {
      // git ls-files may fail silently for patterns with no matches
    }
  }

  return [...files];
}

// ---------------------------------------------------------------------------
// Git diff detection (--git mode)
// ---------------------------------------------------------------------------

function getGitChangedFiles() {
  const files = new Set();

  // Staged + unstaged changes
  try {
    const output = execSync('git diff --name-only HEAD', {
      cwd: ROOT,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    for (const line of output.trim().split('\n')) {
      if (line) files.add(line);
    }
  } catch {
    // No HEAD commit or no changes
  }

  // Also check untracked files
  try {
    const output = execSync('git ls-files --others --exclude-standard', {
      cwd: ROOT,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    for (const line of output.trim().split('\n')) {
      if (line) files.add(line);
    }
  } catch {
    // ignore
  }

  // Try diff against base branch (main) for PR-style detection
  try {
    const baseBranch = execSync('git merge-base HEAD main', {
      cwd: ROOT,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();

    if (baseBranch) {
      const output = execSync(`git diff --name-only ${baseBranch}`, {
        cwd: ROOT,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      for (const line of output.trim().split('\n')) {
        if (line) files.add(line);
      }
    }
  } catch {
    // No main branch or merge-base fails
  }

  // Filter to source files only (under src/, with code extensions)
  return [...files].filter(f => {
    if (f.includes('__fixtures__') || f.includes('/fixtures/') || f.includes('node_modules')) return false;
    if (!/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(f)) return false;
    // Must be a source-like file (not a test file itself, not a config)
    if (f.includes('/src/') || f.match(/^[^/]+\/src\//)) return true;
    return false;
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const startTime = Date.now();

// Determine changed source files
let changedFiles;
if (flags.git) {
  changedFiles = getGitChangedFiles();
  if (changedFiles.length === 0) {
    if (flags.json) {
      console.log(JSON.stringify({ changedFiles: [], affectedTests: [], elapsed: 0 }));
    } else {
      console.error('No changed source files detected.');
    }
    process.exit(0);
  }
  if (!flags.json) {
    console.error(`Detected ${changedFiles.length} changed source file(s):`);
    for (const f of changedFiles) {
      console.error(`  ${f}`);
    }
    console.error('');
  }
} else {
  changedFiles = positional;
}

// Resolve to relative paths (relative to ROOT, matching madge's baseDir)
const changedRelative = changedFiles.map(f => relative(ROOT, resolve(ROOT, f)));

// Verify files exist
for (const rel of changedRelative) {
  if (!existsSync(resolve(ROOT, rel))) {
    console.error(`Warning: file does not exist: ${rel}`);
  }
}

if (!flags.json) {
  console.error('Discovering test files...');
}

const testFiles = discoverTestFiles();
if (!flags.json) {
  console.error(`Found ${testFiles.length} test files.`);
  console.error('Building module graph (this may take a moment)...');
}

// Build module graph via madge
const webpackConfigPath = resolve(__dirname, 'madge.webpack.config.cjs');

// madge is CJS — default import
const madge = (await import('madge')).default;

const testAbsolutePaths = testFiles.map(f => resolve(ROOT, f));

const res = await madge(testAbsolutePaths, {
  baseDir: ROOT,
  webpackConfig: webpackConfigPath,
  fileExtensions: ['ts', 'tsx', 'js', 'jsx'],
});

const graph = await res.obj();

if (!flags.json) {
  const graphSize = Object.keys(graph).length;
  console.error(`Graph built: ${graphSize} nodes.`);
}

// ---------------------------------------------------------------------------
// Dist-leak guard
// ---------------------------------------------------------------------------

const distLeaks = [];
for (const node of Object.keys(graph)) {
  if (node.includes('/dist/')) {
    distLeaks.push(node);
  }
  const deps = graph[node] || [];
  for (const dep of deps) {
    if (dep.includes('/dist/')) {
      distLeaks.push(dep);
    }
  }
}

const uniqueLeaks = [...new Set(distLeaks)];
if (uniqueLeaks.length > 0) {
  const leakMsg = `Warning: ${uniqueLeaks.length} node(s) resolved to dist/ (resolution leak):\n${uniqueLeaks
    .slice(0, 10)
    .map(l => `  ${l}`)
    .join('\n')}${uniqueLeaks.length > 10 ? '\n  ...' : ''}`;
  if (flags.json) {
    // Will include in output
  } else {
    console.error(leakMsg);
  }
}

// ---------------------------------------------------------------------------
// Build reverse index
// ---------------------------------------------------------------------------

const reverseIndex = new Map(); // dep → Set of dependents

for (const [node, deps] of Object.entries(graph)) {
  for (const dep of deps) {
    if (!reverseIndex.has(dep)) {
      reverseIndex.set(dep, new Set());
    }
    reverseIndex.get(dep).add(node);
  }
}

// ---------------------------------------------------------------------------
// Symbol edge analysis
// ---------------------------------------------------------------------------

const ALL = '*';
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

function toRel(root, path) {
  return path.replace(`${root}/`, '').replaceAll('\\', '/');
}

function normalizeRel(path) {
  return path.replaceAll('\\', '/').replace(/^\.\//, '');
}

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

function buildAliasMap(root) {
  const alias = new Map();
  for (const pkgJsonPath of findPackageJsonFiles(root)) {
    const pkgDir = dirname(pkgJsonPath);
    const srcDir = join(pkgDir, 'src');
    if (!existsSync(srcDir)) continue;
    if (pkgDir.includes('__fixtures__') || pkgDir.includes('/fixtures/')) continue;

    try {
      const json = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
      if (json.name) alias.set(json.name, srcDir);
    } catch {
      // ignore malformed package.json files in fixture-like directories
    }
  }
  return alias;
}

function scriptKindFor(file) {
  if (file.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (file.endsWith('.jsx')) return ts.ScriptKind.JSX;
  if (file.endsWith('.js') || file.endsWith('.mjs') || file.endsWith('.cjs')) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function hasModifier(node, kind) {
  return Boolean(node.modifiers?.some(modifier => modifier.kind === kind));
}

function exportedDeclarationNames(node) {
  if (!hasModifier(node, ts.SyntaxKind.ExportKeyword)) return [];

  if (ts.isVariableStatement(node)) {
    return node.declarationList.declarations
      .map(declaration => (ts.isIdentifier(declaration.name) ? declaration.name.text : null))
      .filter(Boolean);
  }

  if (
    (ts.isFunctionDeclaration(node) ||
      ts.isClassDeclaration(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isTypeAliasDeclaration(node) ||
      ts.isEnumDeclaration(node) ||
      ts.isModuleDeclaration(node)) &&
    node.name &&
    ts.isIdentifier(node.name)
  ) {
    return [node.name.text];
  }

  return [];
}

function addNamedEdge(edges, moduleName, kind, names, typeOnly = false) {
  if (names.length === 0) return;
  edges.push({ moduleName, kind, names, typeOnly });
}

function parseFile(root, file) {
  const fullPath = resolve(root, file);
  let text;
  try {
    text = readFileSync(fullPath, 'utf-8');
  } catch {
    return { exportedNames: new Set(), moduleEdges: [] };
  }

  const source = ts.createSourceFile(fullPath, text, ts.ScriptTarget.Latest, true, scriptKindFor(file));
  const exportedNames = new Set();
  const moduleEdges = [];

  for (const statement of source.statements) {
    for (const name of exportedDeclarationNames(statement)) exportedNames.add(name);

    if (ts.isExportAssignment(statement)) {
      exportedNames.add('default');
      continue;
    }

    if (ts.isExportDeclaration(statement)) {
      if (!statement.moduleSpecifier || !ts.isStringLiteralLike(statement.moduleSpecifier)) {
        if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
          for (const element of statement.exportClause.elements) exportedNames.add(element.name.text);
        }
        continue;
      }

      const moduleName = statement.moduleSpecifier.text;
      const typeOnly = Boolean(statement.isTypeOnly);
      if (!statement.exportClause) {
        moduleEdges.push({ moduleName, kind: 'all', typeOnly });
        continue;
      }

      if (ts.isNamespaceExport(statement.exportClause)) {
        moduleEdges.push({ moduleName, kind: 'all', typeOnly });
        continue;
      }

      const valueNames = [];
      const typeNames = [];
      for (const element of statement.exportClause.elements) {
        const name = {
          imported: (element.propertyName ?? element.name).text,
          exported: element.name.text,
        };
        exportedNames.add(name.exported);
        if (typeOnly || element.isTypeOnly) typeNames.push(name);
        else valueNames.push(name);
      }
      if (valueNames.length > 0)
        moduleEdges.push({ moduleName, kind: 'reexport-named', names: valueNames, typeOnly: false });
      if (typeNames.length > 0)
        moduleEdges.push({ moduleName, kind: 'reexport-named', names: typeNames, typeOnly: true });
      continue;
    }

    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteralLike(statement.moduleSpecifier)) continue;

    const moduleName = statement.moduleSpecifier.text;
    const importClause = statement.importClause;
    if (!importClause) {
      moduleEdges.push({ moduleName, kind: 'all', typeOnly: false });
      continue;
    }

    if (importClause.name) {
      addNamedEdge(moduleEdges, moduleName, 'import-named', ['default'], Boolean(importClause.isTypeOnly));
    }

    if (!importClause.namedBindings) continue;

    if (ts.isNamespaceImport(importClause.namedBindings)) {
      moduleEdges.push({ moduleName, kind: 'all', typeOnly: Boolean(importClause.isTypeOnly) });
      continue;
    }

    const valueNames = [];
    const typeNames = [];
    for (const element of importClause.namedBindings.elements) {
      const imported = (element.propertyName ?? element.name).text;
      if (importClause.isTypeOnly || element.isTypeOnly) typeNames.push(imported);
      else valueNames.push(imported);
    }
    addNamedEdge(moduleEdges, moduleName, 'import-named', valueNames, false);
    addNamedEdge(moduleEdges, moduleName, 'import-named', typeNames, true);
  }

  return { exportedNames, moduleEdges };
}

function candidateFiles(base) {
  const candidates = [];
  if (EXTENSIONS.some(ext => base.endsWith(ext))) candidates.push(base);
  for (const ext of EXTENSIONS) candidates.push(`${base}${ext}`);
  for (const ext of EXTENSIONS) candidates.push(join(base, `index${ext}`));
  return candidates;
}

function resolveModuleToGraphDep(root, fromFile, moduleName, deps, aliasMap) {
  const depSet = new Set(deps);
  let basePath = null;

  if (moduleName.startsWith('.')) {
    basePath = resolve(root, dirname(fromFile), moduleName);
  } else {
    const matchingAlias = [...aliasMap.keys()]
      .filter(name => moduleName === name || moduleName.startsWith(`${name}/`))
      .sort((a, b) => b.length - a.length)[0];

    if (matchingAlias) {
      const suffix = moduleName === matchingAlias ? '' : moduleName.slice(matchingAlias.length + 1);
      basePath = join(aliasMap.get(matchingAlias), suffix);
    }
  }

  if (!basePath) return null;

  for (const candidate of candidateFiles(basePath)) {
    const rel = normalizeRel(toRel(root, candidate));
    if (depSet.has(rel)) return rel;
  }

  return null;
}

function edgeKey(from, to) {
  return `${from}\0${to}`;
}

function buildSymbolIndex({ graph, root }) {
  const aliasMap = buildAliasMap(root);
  const fileSymbols = new Map();
  const edges = new Map();

  for (const node of Object.keys(graph)) {
    const parsed = parseFile(root, node);
    fileSymbols.set(node, { exportedNames: parsed.exportedNames });

    const deps = graph[node] || [];
    const matchedDeps = new Set();
    for (const moduleEdge of parsed.moduleEdges) {
      const dep = resolveModuleToGraphDep(root, node, moduleEdge.moduleName, deps, aliasMap);
      if (!dep) continue;
      matchedDeps.add(dep);
      const key = edgeKey(node, dep);
      if (!edges.has(key)) edges.set(key, []);
      edges.get(key).push(moduleEdge);
    }

    for (const dep of deps) {
      if (matchedDeps.has(dep)) continue;
      edges.set(edgeKey(node, dep), [{ kind: 'all', typeOnly: false }]);
    }
  }

  return { fileSymbols, edges, all: ALL };
}

function getSymbolEdges(symbolIndex, from, to) {
  return symbolIndex.edges.get(edgeKey(from, to)) ?? [{ kind: 'all', typeOnly: false }];
}

// ---------------------------------------------------------------------------
// Reverse BFS from each changed file
// ---------------------------------------------------------------------------

const testSet = new Set(testFiles);
const SYMBOL_ALL = '*';

function isVitestTypeTest(file) {
  return /\.(test|spec)-d\.tsx?$/.test(file);
}

function collectFileLevelAffected() {
  const affected = new Set();
  const chains = new Map(); // testFile → chain of files

  for (const changedFile of changedRelative) {
    if (testSet.has(changedFile)) {
      affected.add(changedFile);
    }

    // BFS through the reverse index starting from the changed file
    const visited = new Set();
    const queue = [changedFile];
    visited.add(changedFile);

    // For verbose mode, track parents
    const parent = new Map();
    parent.set(changedFile, null);

    while (queue.length > 0) {
      const current = queue.shift();
      const dependents = reverseIndex.get(current);
      if (!dependents) continue;

      for (const dependent of dependents) {
        if (visited.has(dependent)) continue;
        visited.add(dependent);
        parent.set(dependent, current);

        if (testSet.has(dependent)) {
          affected.add(dependent);
        }

        queue.push(dependent);
      }
    }

    // For verbose mode, reconstruct chains for affected tests found via this changed file
    if (flags.verbose) {
      for (const testFile of visited) {
        if (!testSet.has(testFile)) continue;
        if (chains.has(testFile)) continue; // already have a chain

        const chain = [];
        let node = testFile;
        while (node !== null) {
          chain.push(node);
          node = parent.get(node) ?? null;
        }
        chains.set(testFile, chain.reverse());
      }
    }
  }

  return { affected, chains };
}

function isAllSymbols(symbols) {
  return symbols === SYMBOL_ALL;
}

function symbolStateKey(file, symbols) {
  return `${file}\0${isAllSymbols(symbols) ? SYMBOL_ALL : [...symbols].sort().join(',')}`;
}

function initialSymbolsForFile(symbolIndex, file) {
  const exportedNames = symbolIndex.fileSymbols.get(file)?.exportedNames;
  if (exportedNames?.size) return new Set(exportedNames);
  return SYMBOL_ALL;
}

function nextSymbolsForEdges(edges, currentSymbols, options) {
  const nextSymbols = new Set();

  for (const edge of edges) {
    if (options.ignoreTypeOnlySymbols && edge.typeOnly) continue;

    if (edge.kind === 'all') {
      return SYMBOL_ALL;
    }

    if (edge.kind === 'import-named') {
      const importsChangedSymbol = isAllSymbols(currentSymbols) || edge.names?.some(name => currentSymbols.has(name));
      if (importsChangedSymbol) return SYMBOL_ALL;
      continue;
    }

    if (edge.kind === 'reexport-named') {
      for (const name of edge.names ?? []) {
        const imported = typeof name === 'string' ? name : name.imported;
        const exported = typeof name === 'string' ? name : name.exported;
        if (isAllSymbols(currentSymbols) || currentSymbols.has(imported)) {
          nextSymbols.add(exported);
        }
      }
    }
  }

  return nextSymbols.size > 0 ? nextSymbols : null;
}

function addSymbolState(seenSymbolsByFile, file, symbols) {
  const current = seenSymbolsByFile.get(file);

  if (isAllSymbols(symbols)) {
    if (isAllSymbols(current)) return null;
    seenSymbolsByFile.set(file, SYMBOL_ALL);
    return SYMBOL_ALL;
  }

  if (isAllSymbols(current)) return null;

  if (!current) {
    const next = new Set(symbols);
    seenSymbolsByFile.set(file, next);
    return next;
  }

  const newSymbols = new Set([...symbols].filter(symbol => !current.has(symbol)));
  if (newSymbols.size === 0) return null;
  for (const symbol of newSymbols) current.add(symbol);
  return newSymbols;
}

function collectSymbolAwareAffected(symbolIndex, getSymbolEdges, options = {}) {
  const affected = new Set();
  const chains = new Map();
  const includeAffectedTest = options.includeAffectedTest ?? (() => true);
  const ignoreTypeOnlySymbols = options.ignoreTypeOnlySymbols ?? flags.ignoreTypeOnlySymbols;
  const seenSymbolsByFile = new Map();
  const parentByState = new Map();
  const fileByState = new Map();
  const queue = [];

  for (const changedFile of changedRelative) {
    const symbols = addSymbolState(seenSymbolsByFile, changedFile, initialSymbolsForFile(symbolIndex, changedFile));
    if (!symbols) continue;

    const key = symbolStateKey(changedFile, symbols);
    parentByState.set(key, null);
    fileByState.set(key, changedFile);
    queue.push({ file: changedFile, symbols, key });
  }

  while (queue.length > 0) {
    const current = queue.shift();
    if (testSet.has(current.file) && includeAffectedTest(current.file)) {
      affected.add(current.file);
      if (flags.verbose && !chains.has(current.file)) {
        const chain = [];
        let key = current.key;
        while (key !== null) {
          chain.push(fileByState.get(key));
          key = parentByState.get(key) ?? null;
        }
        chains.set(current.file, chain.reverse());
      }
    }

    const dependents = reverseIndex.get(current.file);
    if (!dependents) continue;

    for (const dependent of dependents) {
      const nextSymbols = nextSymbolsForEdges(getSymbolEdges(symbolIndex, dependent, current.file), current.symbols, {
        ignoreTypeOnlySymbols,
      });
      if (!nextSymbols) continue;

      const symbolsToQueue = addSymbolState(seenSymbolsByFile, dependent, nextSymbols);
      if (!symbolsToQueue) continue;

      const key = symbolStateKey(dependent, symbolsToQueue);
      parentByState.set(key, current.key);
      fileByState.set(key, dependent);
      queue.push({ file: dependent, symbols: symbolsToQueue, key });
    }
  }

  return { affected, chains };
}

const fileLevelResult = collectFileLevelAffected();
const symbolIndex = buildSymbolIndex({ graph, root: ROOT });
const symbolAwareResult = collectSymbolAwareAffected(symbolIndex, getSymbolEdges, {
  ignoreTypeOnlySymbols: flags.ignoreTypeOnlySymbols,
});
let typeOnlyTypeTestResult = null;

if (flags.includeTypeOnlyTypeTests && flags.ignoreTypeOnlySymbols) {
  typeOnlyTypeTestResult = collectSymbolAwareAffected(symbolIndex, getSymbolEdges, {
    ignoreTypeOnlySymbols: false,
    includeAffectedTest: isVitestTypeTest,
  });

  for (const testFile of typeOnlyTypeTestResult.affected) {
    symbolAwareResult.affected.add(testFile);
    if (!symbolAwareResult.chains.has(testFile) && typeOnlyTypeTestResult.chains.has(testFile)) {
      symbolAwareResult.chains.set(testFile, typeOnlyTypeTestResult.chains.get(testFile));
    }
  }
}

const selectedResult = flags.fileLevel ? fileLevelResult : symbolAwareResult;

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

const elapsed = Date.now() - startTime;
const affectedSorted = [...selectedResult.affected].sort();

if (flags.json) {
  const output = {
    changedFiles: changedFiles,
    affectedTests: affectedSorted,
    count: affectedSorted.length,
    elapsed: `${elapsed}ms`,
    graphNodes: Object.keys(graph).length,
    testFiles: testFiles.length,
  };
  if (!flags.fileLevel) {
    output.symbolAware = true;
    output.ignoreTypeOnlySymbols = flags.ignoreTypeOnlySymbols;
    output.typeOnlyTypeTests = Boolean(typeOnlyTypeTestResult);
  }
  if (flags.compareSymbols && symbolAwareResult) {
    const fileLevelAffected = [...fileLevelResult.affected].sort();
    const symbolAwareAffected = [...symbolAwareResult.affected].sort();
    const fileLevelSet = new Set(fileLevelAffected);
    const symbolAwareSet = new Set(symbolAwareAffected);
    const removedTests = fileLevelAffected.filter(testFile => !symbolAwareSet.has(testFile));
    const addedTests = symbolAwareAffected.filter(testFile => !fileLevelSet.has(testFile));

    output.symbolComparison = {
      ignoreTypeOnlySymbols: flags.ignoreTypeOnlySymbols,
      fileLevelCount: fileLevelAffected.length,
      symbolAwareCount: symbolAwareAffected.length,
      removedCount: removedTests.length,
      addedCount: addedTests.length,
      removedTests,
      addedTests,
      symbolAwareAffectedTests: symbolAwareAffected,
    };
  }
  if (uniqueLeaks.length > 0) {
    output.distLeaks = uniqueLeaks;
  }
  if (flags.verbose) {
    output.chains = {};
    for (const [testFile, chain] of selectedResult.chains) {
      output.chains[testFile] = chain;
    }
  }
  console.log(JSON.stringify(output, null, 2));
} else {
  if (flags.verbose) {
    console.error(`\n${affectedSorted.length} affected test(s) found in ${elapsed}ms:\n`);
    for (const testRel of affectedSorted) {
      const chain = selectedResult.chains.get(testRel) || [];
      console.log(`${testRel}`);
      if (chain.length > 1) {
        console.log(`  chain: ${chain.join(' → ')}`);
      }
      console.log('');
    }
  } else {
    for (const testRel of affectedSorted) {
      console.log(testRel);
    }
  }
}
