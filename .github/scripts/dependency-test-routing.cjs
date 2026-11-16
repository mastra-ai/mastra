const { posix } = require('node:path');
const { parse } = require('yaml');

// The import graph only follows source files, so it never selects tests for a dependency
// bump or for a test that reads its package's directory instead of importing from it.
// This module covers both.

const SNAPSHOT_DEP_FIELDS = ['dependencies', 'optionalDependencies'];
const IMPORTER_DEP_FIELDS = ['dependencies', 'devDependencies', 'optionalDependencies'];
const MAX_SELECTED_SHARE = 0.25;
const DIRECTORY_SCAN_RE = /\b(?:readdirSync|readdir|opendirSync|opendir|globSync|glob)\s*\(/;

function snapshotKey(name, version) {
  // Aliased dependencies record the real `name@version` as their version.
  return /^(?:@[^@/]+\/)?[^@]+@/.test(version.split('(')[0]) ? version : `${name}@${version}`;
}

/**
 * Maps each workspace importer to every resolved package it can load, following workspace
 * links into the linked package's own dependencies.
 */
function resolvedClosures(lockfileText) {
  const lockfile = (lockfileText && parse(lockfileText)) || {};
  const importers = lockfile.importers || {};
  const snapshots = lockfile.snapshots || {};

  const direct = new Map();
  for (const [importer, entry] of Object.entries(importers)) {
    const links = [];
    const keys = [];
    for (const field of IMPORTER_DEP_FIELDS) {
      for (const [name, dep] of Object.entries(entry[field] || {})) {
        const version = String(dep.version);
        if (version.startsWith('link:')) {
          links.push(posix.normalize(posix.join(importer, version.slice('link:'.length))));
        } else {
          keys.push(snapshotKey(name, version));
        }
      }
    }
    direct.set(importer, { links, keys });
  }

  const closures = new Map();
  for (const importer of direct.keys()) {
    const seenImporters = new Set([importer]);
    const importerQueue = [importer];
    const closure = new Set();
    const keyQueue = [];
    while (importerQueue.length > 0) {
      const { links, keys } = direct.get(importerQueue.pop());
      keyQueue.push(...keys);
      for (const link of links) {
        if (direct.has(link) && !seenImporters.has(link)) {
          seenImporters.add(link);
          importerQueue.push(link);
        }
      }
    }
    while (keyQueue.length > 0) {
      const key = keyQueue.pop();
      if (closure.has(key)) continue;
      closure.add(key);
      const snapshot = snapshots[key] || {};
      for (const field of SNAPSHOT_DEP_FIELDS) {
        for (const [name, version] of Object.entries(snapshot[field] || {})) {
          keyQueue.push(snapshotKey(name, String(version)));
        }
      }
    }
    closures.set(importer, closure);
  }
  return closures;
}

function sameSet(a, b) {
  if (a.size !== b.size) return false;
  for (const value of a) if (!b.has(value)) return false;
  return true;
}

/** Importers whose resolved dependency tree differs between the two lockfiles. */
function importersWithChangedDependencies(baseLockfile, headLockfile) {
  const base = resolvedClosures(baseLockfile);
  const head = resolvedClosures(headLockfile);
  const changed = new Set();
  for (const [importer, closure] of head) {
    const before = base.get(importer);
    if (!before || !sameSet(before, closure)) changed.add(importer);
  }
  return changed;
}

function ownerOf(file, packageDirs) {
  let owner;
  for (const dir of packageDirs) {
    if (dir === '.') continue;
    if (file.startsWith(`${dir}/`) && (!owner || dir.length > owner.length)) owner = dir;
  }
  return owner;
}

/**
 * Picks the tests the import graph cannot see.
 *
 * - A package whose resolved dependencies changed (lockfile) or whose package.json changed
 *   runs all of its tests.
 * - A test that scans its package's directory runs when a file in that package is added,
 *   deleted or renamed.
 * - A change to the root importer's dependencies (vitest, TypeScript, shared tooling) can
 *   affect every package, so it asks for the full suite, as does a selection covering more
 *   than a quarter of the suite.
 *
 * @param {{
 *   changedFiles: string[],
 *   addedOrRemovedFiles?: string[],
 *   baseLockfile?: string,
 *   headLockfile: string,
 *   testFiles: string[],
 *   readTest: (file: string) => string,
 * }} input
 */
function dependencyAffectedTests({
  changedFiles,
  addedOrRemovedFiles = [],
  baseLockfile,
  headLockfile,
  testFiles,
  readTest,
}) {
  const packageDirs = [...resolvedClosures(headLockfile).keys()];
  const reasons = new Map();
  const select = (dir, reason) => {
    if (!reasons.has(dir)) reasons.set(dir, reason);
  };

  if (changedFiles.includes('pnpm-lock.yaml')) {
    const changedImporters = importersWithChangedDependencies(baseLockfile, headLockfile);
    if (changedImporters.has('.')) {
      return { runFull: true, reason: 'root dependencies changed', packages: [], tests: [] };
    }
    for (const importer of changedImporters) select(importer, 'resolved dependencies changed');
  }

  for (const file of changedFiles) {
    if (!file.endsWith('/package.json')) continue;
    const dir = posix.dirname(file);
    if (packageDirs.includes(dir)) select(dir, 'package.json changed');
  }

  const packagesWithNewOrRemovedFiles = new Set(
    addedOrRemovedFiles.map(file => ownerOf(file, packageDirs)).filter(Boolean),
  );

  const tests = new Set();
  for (const test of testFiles) {
    const owner = ownerOf(test, packageDirs);
    if (!owner) continue;
    if (reasons.has(owner)) {
      tests.add(test);
    } else if (packagesWithNewOrRemovedFiles.has(owner) && DIRECTORY_SCAN_RE.test(readTest(test))) {
      tests.add(test);
    }
  }

  // The affected-unit job splits at most three ways by file count; past this share of the
  // suite the full run, sharded four ways, finishes sooner.
  if (tests.size > testFiles.length * MAX_SELECTED_SHARE) {
    return { runFull: true, reason: 'dependency changes select most of the suite', packages: [], tests: [] };
  }

  return {
    runFull: false,
    reason: reasons.size > 0 ? 'dependency changes' : tests.size > 0 ? 'directory-scanning tests' : 'none',
    packages: [...reasons].map(([dir, reason]) => ({ dir, reason })).sort((a, b) => a.dir.localeCompare(b.dir)),
    tests: [...tests].sort(),
  };
}

module.exports = {
  dependencyAffectedTests,
  importersWithChangedDependencies,
  resolvedClosures,
};
