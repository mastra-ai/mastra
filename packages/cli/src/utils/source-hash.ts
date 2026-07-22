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

/**
 * Recursively collects all files matching the given patterns.
 */
async function collectFiles(rootDir: string, patterns: string[]): Promise<string[]> {
  const files = await glob(patterns, {
    cwd: rootDir,
    absolute: true,
    expandDirectories: false,
  });
  return files.sort(); // Deterministic order
}

/**
 * Finds the workspace root by walking up directories looking for a lockfile.
 * Returns null if no workspace root is found (i.e., lockfile is in projectDir or no lockfile found).
 */
async function findWorkspaceRoot(projectDir: string): Promise<string | null> {
  let currentDir = dirname(projectDir);
  let previousDir = projectDir;

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

  if (!workspaceRoot) {
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
export async function computeSourceHash(rootDir: string, mastraDir: string, projectType?: string): Promise<string> {
  const relMastraDir = relative(rootDir, mastraDir);
  const normalizedMastraDir = relMastraDir.split('\\').join('/'); // Normalize for Windows

  // Patterns for source files to hash
  const patterns = [
    // All TypeScript/JavaScript files in the mastra directory
    posix.join(normalizedMastraDir, '**/*.{ts,js,mts,mjs,cts,cjs}'),
    // Exclude test files
    `!${posix.join(normalizedMastraDir, '**/*.{test,spec}.{ts,js,mts,mjs}')}`,
    `!${posix.join(normalizedMastraDir, '**/__tests__/**')}`,
    // Package files that affect the build
    'package.json',
    'pnpm-lock.yaml',
    'package-lock.json',
    'yarn.lock',
    // TypeScript config
    'tsconfig.json',
  ];

  // Software Factory projects have a project-owned SPA whose source and
  // config live outside src/mastra. Include those UI inputs so a UI-only
  // edit triggers a staleness mismatch. Do NOT hash the generated output
  // at src/mastra/public/factory — it is a build artifact, not a source.
  if (projectType === 'software-factory') {
    patterns.push(
      // SPA source (React/TS components, styles, hooks, etc.)
      'src/web/ui/**/*.{ts,tsx,js,jsx,css,scss,json}',
      // Vite config
      'src/web/vite.config.{ts,js,mts,mjs}',
      // Static public assets consumed by Vite
      'src/web/public/**/*',
      // Exclude generated Factory UI output so it doesn't self-invalidate
      `!${posix.join(normalizedMastraDir, 'public/factory/**')}`,
    );
  }

  const files = await collectFiles(rootDir, patterns);

  // Also check for workspace root lockfiles (monorepo support)
  const workspaceRootLockfiles = await getWorkspaceRootLockfiles(rootDir);

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
  projectType?: string,
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
  const currentHash = await computeSourceHash(rootDir, mastraDir, projectType);

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
