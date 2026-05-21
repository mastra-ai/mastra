import { createHash } from 'node:crypto';
import { open, readFile, stat } from 'node:fs/promises';
import { dirname, join, relative, posix } from 'node:path';
import { glob } from 'tinyglobby';

export interface BuildManifest {
  buildTime: string;
  sourceHash: string;
}

const MANIFEST_FILENAME = 'build-manifest.json';
const LOCKFILES = ['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock'] as const;
const SOURCE_FILE_GLOB = '**/*.{ts,tsx,js,jsx,mts,mjs,cts,cjs}';
const TEST_FILE_GLOB = '**/*.{test,spec}.{ts,tsx,js,jsx,mts,mjs,cts,cjs}';

/**
 * Recursively collects all files matching the given patterns.
 */
async function collectFiles(rootDir: string, patterns: string[]): Promise<string[]> {
  const files = await glob(patterns, {
    cwd: rootDir,
    absolute: true,
    expandDirectories: false,
  });
  return Array.from(new Set(files)).sort(); // Deterministic order
}

/**
 * Finds the workspace root by walking up directories looking for a lockfile.
 * Returns null if no workspace root is found.
 */
async function findWorkspaceRoot(projectDir: string): Promise<string | null> {
  let currentDir = projectDir;
  let previousDir = '';

  // Walk up until we hit the filesystem root (when dirname returns the same path)
  while (currentDir !== previousDir) {
    for (const lockfile of LOCKFILES) {
      const lockfilePath = join(currentDir, lockfile);
      try {
        await stat(lockfilePath);
        // Found a lockfile — this is likely the workspace root
        return currentDir;
      } catch {
        // Continue searching
      }
    }
    previousDir = currentDir;
    currentDir = dirname(currentDir);
  }

  return null;
}

/**
 * Gets workspace root lockfile paths if they exist and are different from project root.
 */
async function getWorkspaceRootLockfiles(projectDir: string): Promise<string[]> {
  const workspaceRoot = await findWorkspaceRoot(projectDir);

  if (!workspaceRoot || workspaceRoot === projectDir) {
    return [];
  }

  const lockfiles: string[] = [];
  for (const lockfile of LOCKFILES) {
    const lockfilePath = join(workspaceRoot, lockfile);
    try {
      await stat(lockfilePath);
      lockfiles.push(lockfilePath);
    } catch {
      // Lockfile doesn't exist
    }
  }

  return lockfiles;
}

/**
 * Gets workspace package sources that can be bundled through local workspace
 * imports. This intentionally stays scoped to conventional package source
 * roots rather than hashing the entire monorepo.
 */
async function getWorkspaceRootSourceFiles(projectDir: string): Promise<string[]> {
  const workspaceRoot = await findWorkspaceRoot(projectDir);

  if (!workspaceRoot) {
    return [];
  }

  const files = await collectFiles(workspaceRoot, [
    `packages/*/src/${SOURCE_FILE_GLOB}`,
    'packages/*/package.json',
    `!packages/*/src/${TEST_FILE_GLOB}`,
    '!packages/*/src/**/__tests__/**',
  ]);

  if (workspaceRoot === projectDir) {
    return files;
  }

  return files.filter(filePath => {
    const relToProject = relative(projectDir, filePath);
    return relToProject.startsWith('..') || relToProject === '' || relToProject.startsWith('/');
  });
}

/**
 * Computes a SHA-256 hash of a file's contents.
 */
async function hashFile(filePath: string): Promise<string> {
  const content = await readFile(filePath);
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Computes a single rolled-up hash of all source files.
 *
 * The hash is computed by:
 * 1. Collecting all relevant source files
 * 2. Sorting them alphabetically by relative path (for determinism)
 * 3. Hashing each file's content
 * 4. Combining path + hash into a final hash
 *
 * Also includes workspace root lockfiles if the project is in a monorepo.
 */
export async function computeSourceHash(rootDir: string, mastraDir: string): Promise<string> {
  const relMastraDir = relative(rootDir, mastraDir);
  const normalizedMastraDir = relMastraDir.split('\\').join('/'); // Normalize for Windows

  // Patterns for source files to hash
  const patterns = [
    // Project source files that can be imported by the Mastra entrypoint.
    `src/${SOURCE_FILE_GLOB}`,
    // The Mastra directory may be customized outside the conventional src tree.
    posix.join(normalizedMastraDir, SOURCE_FILE_GLOB),
    // Exclude test files
    `!src/${TEST_FILE_GLOB}`,
    '!src/**/__tests__/**',
    `!${posix.join(normalizedMastraDir, TEST_FILE_GLOB)}`,
    `!${posix.join(normalizedMastraDir, '**/__tests__/**')}`,
    // Package files that affect the build
    'package.json',
    'pnpm-lock.yaml',
    'package-lock.json',
    'yarn.lock',
    // TypeScript config
    'tsconfig.json',
  ];

  const files = await collectFiles(rootDir, patterns);

  // Also check for workspace root lockfiles (monorepo support)
  const workspaceRoot = await findWorkspaceRoot(rootDir);
  const workspaceRootLockfiles = await getWorkspaceRootLockfiles(rootDir);
  const workspaceRootSourceFiles = await getWorkspaceRootSourceFiles(rootDir);

  // Create a hash of all file hashes combined with their paths
  const masterHash = createHash('sha256');

  // Hash project files
  for (const filePath of files) {
    const relPath = relative(rootDir, filePath);
    const fileHash = await hashFile(filePath);
    // Include path in hash so file renames are detected
    masterHash.update(`${relPath}:${fileHash}\n`);
  }

  // Hash workspace root lockfiles (if any)
  for (const lockfilePath of workspaceRootLockfiles.sort()) {
    const fileHash = await hashFile(lockfilePath);
    // Use just the lockfile name to ensure determinism across machines
    const lockfileName = lockfilePath.split(/[/\\]/).pop()!;
    masterHash.update(`[workspace-root]${lockfileName}:${fileHash}\n`);
  }

  // Hash workspace package sources that may be bundled via local imports.
  for (const filePath of workspaceRootSourceFiles) {
    const fileHash = await hashFile(filePath);
    const relPath = workspaceRoot
      ? relative(workspaceRoot, filePath).split('\\').join('/')
      : relative(rootDir, filePath);
    masterHash.update(`[workspace-root]${relPath}:${fileHash}\n`);
  }

  return `sha256:${masterHash.digest('hex')}`;
}

/**
 * Writes a build manifest to the output directory.
 */
export async function writeBuildManifest(outputDirectory: string, sourceHash: string): Promise<void> {
  const manifest: BuildManifest = {
    buildTime: new Date().toISOString(),
    sourceHash,
  };

  const manifestPath = join(outputDirectory, MANIFEST_FILENAME);
  // fsync the manifest to disk — some CI runners return stale page-cache
  // content if we write and then immediately read.
  const fh = await open(manifestPath, 'w');
  try {
    await fh.writeFile(JSON.stringify(manifest, null, 2));
    await fh.sync();
  } finally {
    await fh.close();
  }
}

/**
 * Reads the build manifest from the output directory.
 * Returns null if the manifest doesn't exist or is invalid.
 */
export async function readBuildManifest(outputDirectory: string): Promise<BuildManifest | null> {
  const manifestPath = join(outputDirectory, MANIFEST_FILENAME);

  try {
    const content = await readFile(manifestPath, 'utf-8');
    const manifest = JSON.parse(content) as BuildManifest;

    // Basic validation
    if (typeof manifest.sourceHash !== 'string' || typeof manifest.buildTime !== 'string') {
      return null;
    }

    return manifest;
  } catch {
    return null;
  }
}

export interface StalenessCheckResult {
  isStale: boolean;
  reason: 'no-build' | 'no-manifest' | 'hash-mismatch' | 'up-to-date';
  currentHash?: string;
  manifestHash?: string;
}

/**
 * Checks if the build output is stale compared to the current source files.
 */
export async function checkBuildStaleness(
  rootDir: string,
  mastraDir: string,
  outputDirectory: string,
): Promise<StalenessCheckResult> {
  // Check if build output exists
  const outputPath = join(outputDirectory, 'output', 'index.mjs');
  try {
    await stat(outputPath);
  } catch {
    return { isStale: true, reason: 'no-build' };
  }

  // Read the manifest
  const manifest = await readBuildManifest(outputDirectory);
  if (!manifest) {
    return { isStale: true, reason: 'no-manifest' };
  }

  // Compute current source hash
  const currentHash = await computeSourceHash(rootDir, mastraDir);

  if (currentHash !== manifest.sourceHash) {
    return {
      isStale: true,
      reason: 'hash-mismatch',
      currentHash,
      manifestHash: manifest.sourceHash,
    };
  }

  return {
    isStale: false,
    reason: 'up-to-date',
    currentHash,
    manifestHash: manifest.sourceHash,
  };
}
