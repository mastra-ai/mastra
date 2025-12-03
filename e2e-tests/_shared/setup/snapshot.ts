import { execSync, spawnSync } from 'node:child_process';
import { readFile, writeFile, mkdtemp, cp, rm, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { globby } from 'globby';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Restore ONLY the files that e2e tests modify (package.json and CHANGELOG.md files).
 * Uses HEAD to restore - this preserves any branch-specific changes while undoing
 * only the snapshot version modifications made by the e2e test setup.
 *
 * @param rootDir - Root directory of the monorepo
 */
export function restoreGitFiles(rootDir: string): void {
  console.log('[Snapshot] Restoring e2e-modified files from HEAD...');
  try {
    // Find files that have been modified (unstaged changes)
    const modifiedFiles = execSync('git diff --name-only', {
      cwd: rootDir,
      encoding: 'utf8',
    })
      .trim()
      .split('\n')
      .filter(Boolean);

    // Only restore package.json and CHANGELOG.md files (what e2e snapshot versioning modifies)
    // Skip e2e-tests/ directory - those are our infrastructure files, not snapshot artifacts
    const filesToRestore = modifiedFiles.filter(
      f => (f.endsWith('package.json') || f.endsWith('CHANGELOG.md')) && !f.startsWith('e2e-tests/'),
    );

    if (filesToRestore.length > 0) {
      console.log(`[Snapshot] Restoring ${filesToRestore.length} modified files from HEAD...`);
      // Restore each file from HEAD (current commit)
      for (const file of filesToRestore) {
        try {
          execSync(`git checkout HEAD -- "${file}"`, {
            cwd: rootDir,
            stdio: 'pipe',
          });
        } catch {
          console.warn(`[Snapshot] Could not restore: ${file}`);
        }
      }
    } else {
      console.log('[Snapshot] No e2e-modified files to restore');
    }

    // Clean up any untracked changeset files created for e2e tests
    // Only remove changesets that look like e2e test artifacts (contain timestamp patterns)
    try {
      const untrackedChangesets = execSync('git ls-files --others --exclude-standard .changeset/', {
        cwd: rootDir,
        encoding: 'utf8',
      })
        .trim()
        .split('\n')
        .filter(Boolean);

      for (const file of untrackedChangesets) {
        // Only delete files that look like e2e test artifacts
        if (file.includes('e2e-test') || file.match(/test-\d{13}/)) {
          try {
            execSync(`rm -f "${rootDir}/${file}"`, { cwd: rootDir, stdio: 'pipe' });
            console.log(`[Snapshot] Removed e2e changeset: ${file}`);
          } catch {}
        }
      }
    } catch {
      // No untracked changesets, that's fine
    }

    console.log('[Snapshot] Restore complete');
  } catch (error) {
    console.warn('[Snapshot] Warning: Could not restore files:', error);
  }
}

/**
 * Check if the monorepo has uncommitted changes from a previous e2e run.
 * Returns true if there are snapshot version changes (e2e-test versions in package.json).
 */
export function hasSnapshotChanges(rootDir: string): boolean {
  try {
    // Check if any package.json has e2e-test version strings
    const diff = execSync('git diff --unified=0 -- "*/package.json" "package.json"', {
      cwd: rootDir,
      encoding: 'utf8',
    });

    // Look for e2e-test version patterns in the diff
    return diff.includes('e2e-test') || diff.includes('0.0.0-');
  } catch {
    return false;
  }
}

export interface SnapshotOptions {
  /** Root directory of the monorepo */
  rootDir: string;
  /** Tag for the snapshot version (e.g., 'e2e-test') */
  tag: string;
}

export interface PackageInfo {
  name: string;
  path: string;
  version: string;
  tarballPath?: string;
}

/**
 * Get all packages in the monorepo that can be published.
 * Excludes private packages and examples.
 */
export async function getPublishablePackages(rootDir: string): Promise<PackageInfo[]> {
  const result = execSync('pnpm ls -r --depth -1 --json', {
    cwd: rootDir,
    encoding: 'utf8',
  });

  const packages = JSON.parse(result) as Array<{
    name?: string;
    path: string;
    version: string;
    private?: boolean;
  }>;

  return packages
    .filter(pkg => pkg.name && !pkg.private)
    .map(pkg => ({
      name: pkg.name!,
      path: pkg.path,
      version: pkg.version,
    }));
}

/**
 * Create a temporary copy of the monorepo for snapshot versioning.
 * This avoids mutating the actual git repository.
 *
 * @param rootDir - Root directory of the monorepo
 * @param packagesToInclude - Package names to include in the copy
 * @returns Path to the temporary directory
 */
export async function createMonorepoCopy(rootDir: string, packagesToInclude: string[]): Promise<string> {
  const tempDir = await mkdtemp(join(tmpdir(), 'mastra-e2e-snapshot-'));

  // Get package paths
  const allPackages = await getPublishablePackages(rootDir);
  const packagePaths = new Map(allPackages.map(p => [p.name, p.path]));

  // Copy only the packages we need plus essential config files
  const essentialFiles = ['package.json', 'pnpm-workspace.yaml', 'pnpm-lock.yaml', '.changeset'];

  for (const file of essentialFiles) {
    try {
      await cp(join(rootDir, file), join(tempDir, file), { recursive: true });
    } catch {
      // File might not exist, that's ok
    }
  }

  // Copy required packages and their dependencies
  const packagesToCopy = new Set<string>();

  // Add requested packages
  for (const pkgName of packagesToInclude) {
    packagesToCopy.add(pkgName);
  }

  // Copy each package directory
  for (const pkgName of packagesToCopy) {
    const pkgPath = packagePaths.get(pkgName);
    if (pkgPath) {
      const relativePath = pkgPath.replace(rootDir, '').replace(/^\//, '');
      await cp(pkgPath, join(tempDir, relativePath), { recursive: true });
    }
  }

  return tempDir;
}

/**
 * Prepare packages for publishing with snapshot versions.
 * This modifies package.json files in a temporary directory to use snapshot versions.
 *
 * IMPORTANT: This does NOT modify the actual git repository.
 *
 * @param options - Snapshot options including rootDir and tag
 * @param packageFilters - pnpm filter arguments for packages to publish
 * @returns Cleanup function to remove temporary files
 */
export async function prepareSnapshotVersions(
  options: SnapshotOptions,
  packageFilters: string[],
): Promise<{ cleanup: () => Promise<void> }> {
  const { rootDir, tag } = options;

  // Find all package.json files
  const packageFiles = await globby('**/package.json', {
    ignore: ['**/node_modules/**', '**/examples/**'],
    cwd: rootDir,
    absolute: true,
  });

  const originalContents = new Map<string, string>();

  // Store original contents and modify workspace dependencies
  for (const file of packageFiles) {
    const content = await readFile(file, 'utf8');
    originalContents.set(file, content);

    const parsed = JSON.parse(content);

    // Convert workspace:^ dependencies to workspace:*
    if (parsed?.peerDependencies?.['@mastra/core']) {
      parsed.peerDependencies['@mastra/core'] = 'workspace:*';
    }

    for (const depType of ['dependencies', 'devDependencies'] as const) {
      for (const dep of Object.keys(parsed[depType] || {})) {
        if (parsed[depType][dep]?.startsWith('workspace:')) {
          parsed[depType][dep] = 'workspace:*';
        }
      }
    }

    await writeFile(file, JSON.stringify(parsed, null, 2));
  }

  // Also update changeset config to not require GitHub token
  const changesetConfigPath = join(rootDir, '.changeset/config.json');
  try {
    const changesetContent = await readFile(changesetConfigPath, 'utf8');
    originalContents.set(changesetConfigPath, changesetContent);
    const changesetParsed = JSON.parse(changesetContent);
    changesetParsed.changelog = '@changesets/cli/changelog';
    await writeFile(changesetConfigPath, JSON.stringify(changesetParsed, null, 2));
  } catch {
    // Changeset config might not exist
  }

  // Create a changeset for snapshot
  const changesetFile = join(rootDir, `.changeset/e2e-test-${Date.now()}.md`);
  const allPackages = await getPublishablePackages(rootDir);

  let changeset = `---\n`;
  for (const pkg of allPackages) {
    changeset += `"${pkg.name}": patch\n`;
  }
  changeset += `---\n\nE2E test snapshot`;

  await writeFile(changesetFile, changeset);
  originalContents.set(changesetFile, ''); // Empty means delete on cleanup

  // Run changeset commands
  // IMPORTANT: Use 'changeset-cli' not 'changeset' - the latter runs the custom interactive CLI
  try {
    execSync('pnpm changeset-cli pre exit', {
      cwd: rootDir,
      stdio: 'pipe',
    });
  } catch {
    // pre exit might fail if not in pre mode, that's ok
  }

  execSync(`pnpm changeset-cli version --snapshot ${tag}`, {
    cwd: rootDir,
    stdio: 'inherit',
  });

  // Cleanup function restores all files using git (more robust than memory-based)
  const cleanup = async () => {
    restoreGitFiles(rootDir);
  };

  return { cleanup };
}

/**
 * Publish packages to a registry using pnpm publish.
 *
 * @param packageFilters - pnpm filter arguments (e.g., '--filter="mastra"')
 * @param tag - npm tag for the published packages
 * @param rootDir - Root directory of the monorepo
 * @param registryUrl - URL of the registry to publish to
 */
export function publishPackages(packageFilters: string[], tag: string, rootDir: string, registryUrl: string): void {
  const filterArgs = packageFilters.join(' ');

  execSync(`pnpm ${filterArgs} publish --registry=${registryUrl} --no-git-checks --tag=${tag}`, {
    cwd: rootDir,
    stdio: 'inherit',
  });
}
