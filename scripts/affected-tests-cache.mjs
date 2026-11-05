/**
 * Content-addressed cache for the per-file half of affected-tests.mjs.
 *
 * Each record is keyed by sha1(extension + file text) and holds what the
 * detector extracts from that text alone: madge's import specifiers and
 * parseFile()'s exported names and symbol edges. Resolving specifiers to files
 * is never cached, so a record stays valid wherever the same text appears.
 *
 * Usage: set AFFECTED_TESTS_CACHE=<path>. The file is read at start and
 * rewritten at exit with only the records this run used, so it never grows
 * past the current tree. Unset, the detector behaves as before.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, extname } from 'node:path';

const require = createRequire(import.meta.url);

// Bump when the shape of a record or the extraction logic changes.
const SCHEMA = 1;

function extractorVersions() {
  const madgeRequire = createRequire(require.resolve('madge'));
  const treeRequire = createRequire(madgeRequire.resolve('dependency-tree'));
  const version = (req, name) => req(`${name}/package.json`).version;
  return [
    `schema@${SCHEMA}`,
    `precinct@${version(treeRequire, 'precinct')}`,
    `typescript-classic@${version(require, 'typescript-classic')}`,
  ].join(' ');
}

export function openExtractionCache(path) {
  const versions = extractorVersions();
  let stored = {};
  if (path && existsSync(path)) {
    try {
      const data = JSON.parse(readFileSync(path, 'utf-8'));
      if (data.versions === versions) stored = data.records;
    } catch {
      // A corrupt cache is a cold cache.
    }
  }

  const used = {};
  const stats = { hits: 0, misses: 0 };
  const keyByFile = new Map();

  return {
    stats,
    /**
     * Returns record[field] for this file's text, computing it with
     * compute(text) on a miss. Returns undefined if the file can't be read.
     */
    get(filename, field, compute) {
      // Each file is read and hashed once per run; its text is only read
      // again on a miss.
      let text;
      let key = keyByFile.get(filename);
      if (!key) {
        try {
          text = readFileSync(filename, 'utf-8');
        } catch {
          return undefined;
        }
        key = createHash('sha1').update(extname(filename)).update('\0').update(text).digest('hex');
        keyByFile.set(filename, key);
      }
      const record = (used[key] ??= stored[key] ? { ...stored[key] } : {});
      if (field in record) {
        stats.hits++;
        return record[field];
      }
      stats.misses++;
      record[field] = compute(text ?? readFileSync(filename, 'utf-8'));
      return record[field];
    },
    save() {
      if (!path) return;
      mkdirSync(dirname(path), { recursive: true });
      const tmp = `${path}.${process.pid}.tmp`;
      writeFileSync(tmp, JSON.stringify({ versions, records: used }));
      renameSync(tmp, path);
    },
  };
}

/**
 * Serve madge's per-file specifier extraction from the cache. madge walks the
 * graph with dependency-tree, which looks up `_getDependencies` on its exports
 * for each file; we swap in a version that takes precinct's specifier list from
 * the cache and resolves each one live with filing-cabinet, exactly as the
 * original does. Returns a function that puts the original back.
 */
export function cacheMadgeSpecifiers(cache) {
  const madgeRequire = createRequire(require.resolve('madge'));
  const treeRequire = createRequire(madgeRequire.resolve('dependency-tree'));
  const dependencyTree = madgeRequire('dependency-tree');
  const precinct = treeRequire('precinct');
  const cabinet = treeRequire('filing-cabinet');

  const original = dependencyTree._getDependencies;
  dependencyTree._getDependencies = function getDependencies(config = {}) {
    const precinctOptions = config.detectiveConfig;
    precinctOptions.includeCore = false;

    // Same contract as precinct.paperwork's try/catch in dependency-tree: a
    // file that fails to parse contributes no dependencies.
    const dependencies =
      cache.get(config.filename, 'specifiers', () => {
        try {
          return precinct.paperwork(config.filename, precinctOptions);
        } catch {
          return [];
        }
      }) ?? [];

    const resolved = [];
    for (const dependency of dependencies) {
      const result = cabinet({
        partial: dependency,
        filename: config.filename,
        directory: config.directory,
        ast: precinct.ast,
        config: config.requireConfig,
        webpackConfig: config.webpackConfig,
        nodeModulesConfig: config.nodeModulesConfig,
        tsConfig: config.tsConfig,
        tsConfigPath: config.tsConfigPath,
        noTypeDefinitions: config.noTypeDefinitions,
      });
      if (!result || !existsSync(result)) {
        config.nonExistent.push(dependency);
        continue;
      }
      resolved.push(result);
    }
    return resolved;
  };
  return () => {
    dependencyTree._getDependencies = original;
  };
}
