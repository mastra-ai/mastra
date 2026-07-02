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

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve, relative, dirname } from 'path';
import { fileURLToPath } from 'url';

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
  help: false,
};
const positional = [];

for (const arg of args) {
  if (arg === '--git') flags.git = true;
  else if (arg === '--json') flags.json = true;
  else if (arg === '--verbose') flags.verbose = true;
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
  --git        Detect changed files via git diff (staged + unstaged + vs base)
  --json       Output structured JSON instead of newline-separated paths
  --verbose    Show dependency chain for each affected test
  -h, --help   Show this help message

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
// Reverse BFS from each changed file
// ---------------------------------------------------------------------------

const testSet = new Set(testFiles);
const allAffected = new Set();
const verboseChains = new Map(); // testFile → chain of files

for (const changedFile of changedRelative) {
  if (testSet.has(changedFile)) {
    allAffected.add(changedFile);
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
        allAffected.add(dependent);
      }

      queue.push(dependent);
    }
  }

  // For verbose mode, reconstruct chains for affected tests found via this changed file
  if (flags.verbose) {
    for (const testFile of visited) {
      if (!testSet.has(testFile)) continue;
      if (verboseChains.has(testFile)) continue; // already have a chain

      const chain = [];
      let node = testFile;
      while (node !== null) {
        chain.push(node);
        node = parent.get(node) ?? null;
      }
      verboseChains.set(testFile, chain.reverse());
    }
  }
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

const elapsed = Date.now() - startTime;
const affectedSorted = [...allAffected].sort();

if (flags.json) {
  const output = {
    changedFiles: changedFiles,
    affectedTests: affectedSorted,
    count: affectedSorted.length,
    elapsed: `${elapsed}ms`,
    graphNodes: Object.keys(graph).length,
    testFiles: testFiles.length,
  };
  if (uniqueLeaks.length > 0) {
    output.distLeaks = uniqueLeaks;
  }
  if (flags.verbose) {
    output.chains = {};
    for (const [testFile, chain] of verboseChains) {
      output.chains[testFile] = chain;
    }
  }
  console.log(JSON.stringify(output, null, 2));
} else {
  if (flags.verbose) {
    console.error(`\n${affectedSorted.length} affected test(s) found in ${elapsed}ms:\n`);
    for (const testRel of affectedSorted) {
      const chain = verboseChains.get(testRel) || [];
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
