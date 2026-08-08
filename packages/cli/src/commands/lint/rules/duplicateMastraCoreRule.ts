import { readFileSync, readdirSync, realpathSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { LintContext, LintIssue, LintRule } from './types.js';

// Nested node_modules deeper than this are vanishingly rare and not worth the
// extra directory walk on large dependency trees.
const MAX_SCAN_DEPTH = 6;

interface CoreInstall {
  version: string;
  /** Path relative to the project root, for a readable report. */
  path: string;
}

function readVersion(packageDir: string): string | null {
  try {
    const parsed = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf-8'));
    return typeof parsed.version === 'string' ? parsed.version : null;
  } catch {
    return null;
  }
}

/** Lists every package directory inside a node_modules dir, unwrapping `@scope` folders. */
function listPackageDirs(nodeModulesDir: string): string[] {
  const packageDirs: string[] = [];

  let entries;
  try {
    entries = readdirSync(nodeModulesDir, { withFileTypes: true });
  } catch {
    return packageDirs;
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const entryPath = join(nodeModulesDir, entry.name);

    if (!entry.name.startsWith('@')) {
      packageDirs.push(entryPath);
      continue;
    }

    try {
      for (const scoped of readdirSync(entryPath, { withFileTypes: true })) {
        if (!scoped.name.startsWith('.')) packageDirs.push(join(entryPath, scoped.name));
      }
    } catch {
      // Unreadable scope directory; nothing to contribute.
    }
  }

  return packageDirs;
}

/**
 * Finds physically distinct @mastra/core installs under the project root.
 *
 * Results are de-duplicated by realpath: pnpm and npm workspaces legitimately
 * create many symlinks to a single copy, and those are not duplicates. Only
 * genuinely separate copies on disk cause the type incompatibility this rule
 * reports.
 */
export function findMastraCoreInstalls(rootDir: string): CoreInstall[] {
  const installs = new Map<string, CoreInstall>();
  const visitedDirs = new Set<string>();
  const queue: { dir: string; depth: number }[] = [{ dir: join(rootDir, 'node_modules'), depth: 0 }];

  while (queue.length > 0) {
    const { dir, depth } = queue.shift()!;

    let realDir: string;
    try {
      realDir = realpathSync(dir);
    } catch {
      continue;
    }
    if (visitedDirs.has(realDir)) continue;
    visitedDirs.add(realDir);

    const coreDir = join(dir, '@mastra', 'core');
    const version = readVersion(coreDir);
    if (version) {
      try {
        const realCoreDir = realpathSync(coreDir);
        if (!installs.has(realCoreDir)) {
          installs.set(realCoreDir, { version, path: relative(rootDir, coreDir) || coreDir });
        }
      } catch {
        // Disappeared between the read and the realpath; ignore.
      }
    }

    if (depth >= MAX_SCAN_DEPTH) continue;
    for (const packageDir of listPackageDirs(dir)) {
      queue.push({ dir: join(packageDir, 'node_modules'), depth: depth + 1 });
    }
  }

  return [...installs.values()].sort((a, b) => a.path.localeCompare(b.path));
}

export const duplicateMastraCoreRule: LintRule = {
  name: 'duplicate-mastra-core',
  description: 'Checks that only one copy of @mastra/core is installed',
  async run(context: LintContext): Promise<LintIssue[]> {
    const installs = findMastraCoreInstalls(context.rootDir);
    if (installs.length < 2) return [];

    const versions = [...new Set(installs.map(install => install.version))];
    const installList = installs.map(install => `${install.path} (${install.version})`).join(', ');

    return [
      {
        code: 'DUPLICATE_MASTRA_CORE',
        severity: 'error',
        scope: 'project',
        message:
          `Found ${installs.length} separate copies of @mastra/core (${versions.join(', ')}): ${installList}. ` +
          `Mastra classes carry private fields, so types from one copy are not assignable to types from another. ` +
          `This surfaces as type errors such as "Type 'Memory' is missing the following properties from type 'MastraMemory': #private, #private" ` +
          `or "Property '#private' in type 'PostgresStore' refers to a different member". The code still runs correctly; only type-checking fails.`,
        fix: [
          'Align every @mastra/* package on a single @mastra/core version, then reinstall from a clean state (remove node_modules and your lockfile).',
          'npm: add an "overrides" entry pinning @mastra/core to one version.',
          'pnpm: add a "pnpm.overrides" entry, or run `pnpm dedupe`.',
          'yarn: add a "resolutions" entry pinning @mastra/core to one version.',
        ],
      },
    ];
  },
};
