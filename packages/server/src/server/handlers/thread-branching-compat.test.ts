import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

// @mastra/server's peer range admits @mastra/core versions without thread branching. Source that
// ships in the published build (and its declarations) must take branch values and types from
// ./thread-branching-compat, never from core, or the package crashes on load or its branch API types become `any`.
const BRANCH_ONLY_CORE_NAMES = [
  'MASTRA_THREAD_BRANCH_METADATA_KEY',
  'MASTRA_THREAD_BRANCH_METADATA_KEYS',
  'MASTRA_THREAD_BRANCH_PARENT_METADATA_KEY',
  'MASTRA_THREAD_BRANCH_STATE_METADATA_KEY',
  'assertNoReservedThreadBranchMetadata',
  'createThreadBranchError',
  'ThreadBranchErrorCode',
  'BranchThreadInput',
  'BranchThreadOutput',
  'PublicThreadBranchMetadata',
  'InternalThreadBranchMetadata',
  'GetThreadBranchInput',
  'ListThreadBranchesInput',
  'ListThreadBranchesOutput',
  'ThreadBranchHistoryOutput',
  'InternalThreadBranchState',
  'InternalThreadBranchAuthorizationCandidate',
];

const srcDir = join(__dirname, '..', '..');

function shippedSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : shippedSourceFiles(path);
    return /\.ts$/.test(name) && !/\.(test|test-d|spec)\.ts$/.test(name) ? [path] : [];
  });
}

function coreImports(source: string): Array<{ specifier: string; names: string[] }> {
  return [...source.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+'(@mastra\/core[^']*)'/g)].map(match => ({
    specifier: match[2]!,
    names: match[1]!
      .split(',')
      .map(
        name =>
          name
            .trim()
            .replace(/^type\s+/, '')
            .split(/\s+as\s+/)[0]!,
      )
      .filter(Boolean),
  }));
}

describe('core compatibility of shipped server source', () => {
  it('takes thread-branching values and types from ./thread-branching-compat, not @mastra/core', () => {
    const offenders = shippedSourceFiles(srcDir).flatMap(file =>
      coreImports(readFileSync(file, 'utf8')).flatMap(({ specifier, names }) => {
        const bad =
          specifier === '@mastra/core/memory/internal' ? names : names.filter(n => BRANCH_ONLY_CORE_NAMES.includes(n));
        return bad.map(name => `${relative(srcDir, file)}: ${name} from ${specifier}`);
      }),
    );
    expect(offenders).toEqual([]);
  });
});
