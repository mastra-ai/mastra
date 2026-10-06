const { execFileSync } = require('node:child_process');
const { existsSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

const SCANNED_ROOTS_DECLARATION = /^export const scannedRoots(?:\s*:[^=]+)?\s*=\s*\[([\s\S]*?)\]/m;
const STRING_LITERAL = /'([^']*)'|"([^"]*)"/g;

function parseScannedRoots(test, source) {
  const declaration = source.match(SCANNED_ROOTS_DECLARATION);
  if (!declaration) {
    throw new Error(`${test} mentions scannedRoots but its declaration is not a literal array`);
  }
  const roots = [...declaration[1].matchAll(STRING_LITERAL)].map(([, single, double]) => single ?? double);
  if (roots.length === 0) {
    throw new Error(`${test} declares scannedRoots without any string literal paths`);
  }
  return roots;
}

function isUnderRoot(file, root) {
  return file === root || file.startsWith(`${root}/`);
}

function testsScanningChangedFiles(changedFiles, declarations) {
  return declarations
    .filter(({ roots }) => changedFiles.some(file => roots.some(root => isUnderRoot(file, root))))
    .map(({ test }) => test);
}

function listDeclaringTests(repoRoot) {
  try {
    return execFileSync('git', ['grep', '-l', '-e', '^export const scannedRoots', '--', '*.test.ts', '*.test.tsx'], {
      cwd: repoRoot,
      encoding: 'utf8',
    })
      .split('\n')
      .filter(Boolean);
  } catch (error) {
    if (error.status === 1) return [];
    throw error;
  }
}

function readScanDeclarations(repoRoot) {
  return listDeclaringTests(repoRoot).map(test => {
    const roots = parseScannedRoots(test, readFileSync(join(repoRoot, test), 'utf8'));
    const missing = roots.filter(root => !existsSync(join(repoRoot, root)));
    if (missing.length > 0) {
      throw new Error(`${test} declares scannedRoots that do not exist: ${missing.join(', ')}`);
    }
    return { test, roots };
  });
}

function selectScanTests(changedFiles, repoRoot = process.cwd()) {
  return testsScanningChangedFiles(changedFiles, readScanDeclarations(repoRoot));
}

module.exports = {
  parseScannedRoots,
  selectScanTests,
  testsScanningChangedFiles,
};
