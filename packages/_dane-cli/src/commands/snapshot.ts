import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import * as clack from '@clack/prompts';
import { getPackages } from '@manypkg/get-packages';
import { defineCommand } from 'citty';
import { rootDir } from '../config.js';
import { DEFAULT_REGISTRY_PORT } from './registry.js';

async function isRegistryRunning(port: number): Promise<boolean> {
  try {
    const response = await fetch(`http://localhost:${port}/-/ping`, {
      method: 'GET',
      signal: AbortSignal.timeout(1000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function cacheAllPackageJsons(rootDir: string): Promise<Map<string, string>> {
  const cache = new Map<string, string>();
  const { packages, rootPackage } = await getPackages(rootDir);

  // Cache root package.json
  if (rootPackage) {
    const rootPackageJsonPath = path.join(rootDir, 'package.json');
    cache.set(rootPackageJsonPath, fs.readFileSync(rootPackageJsonPath, 'utf-8'));
  }

  // Cache all package.json files
  for (const pkg of packages) {
    const packageJsonPath = path.join(pkg.dir, 'package.json');
    cache.set(packageJsonPath, fs.readFileSync(packageJsonPath, 'utf-8'));
  }

  return cache;
}

function restoreAllPackageJsons(cache: Map<string, string>): void {
  for (const [packageJsonPath, content] of cache) {
    fs.writeFileSync(packageJsonPath, content);
  }
}

function updateWorkspaceDeps(rootDir: string): void {
  // Use sed to replace workspace:^ with workspace:* in all package.json files
  try {
    execSync(
      `find . -type f -name package.json -not -path "./node_modules/*" -exec sed -i '' -E 's/"workspace:\\^"/"workspace:*"/g' {} \\;`,
      { stdio: 'pipe', cwd: rootDir },
    );
  } catch {
    // sed might not find any matches, that's ok
  }
}

function isInPrereleaseMode(rootDir: string): boolean {
  const preFilePath = path.join(rootDir, '.changeset', 'pre.json');
  return fs.existsSync(preFilePath);
}

export const snapshotCommand = defineCommand({
  meta: {
    name: 'snapshot',
    description: 'Publish a snapshot version of packages using changesets',
  },
  args: {
    tag: {
      type: 'string',
      description: "Tag for the snapshot version (e.g. 'alpha', 'beta', 'pr-123')",
      required: true,
    },
    port: {
      type: 'string',
      description: 'Port of the local registry to publish to',
      default: String(DEFAULT_REGISTRY_PORT),
    },
    dryRun: {
      type: 'boolean',
      description: 'Run without actually publishing',
      default: false,
    },
  },
  async run({ args }) {
    clack.intro('Snapshot Publish');

    const { tag, port, dryRun } = args;
    const portNum = parseInt(port, 10);
    const registry = `http://localhost:${portNum}`;

    if (dryRun) {
      clack.log.warn('Dry run mode - no packages will be published');
    }

    clack.log.info(`Tag: ${tag}`);
    clack.log.info(`Registry: ${registry}`);

    const spinner = clack.spinner();

    // Step 0: Check if registry is running
    spinner.start('Checking if local registry is running...');
    const registryRunning = await isRegistryRunning(portNum);
    if (!registryRunning) {
      spinner.stop('Local registry not running');
      clack.log.error(`No registry found at ${registry}`);
      clack.log.info(`Start a registry first with: dane registry --port ${portNum}`);
      clack.outro('Snapshot failed');
      process.exit(1);
    }
    spinner.stop(`Registry running at ${registry}`);

    // Step 1: Cache all package.json files before any modifications
    spinner.start('Caching package.json files...');
    let cachedPackageJsons: Map<string, string>;
    try {
      cachedPackageJsons = await cacheAllPackageJsons(rootDir);
      spinner.stop(`Cached ${cachedPackageJsons.size} package.json files`);
    } catch (err) {
      spinner.stop('Failed to cache package.json files');
      clack.log.error(err instanceof Error ? err.message : String(err));
      clack.outro('Snapshot failed');
      process.exit(1);
    }

    // Check if we're in prerelease mode (to restore later)
    const wasInPrereleaseMode = isInPrereleaseMode(rootDir);

    // Cleanup function to restore everything
    const cleanup = () => {
      clack.log.info('Restoring original package.json files...');
      restoreAllPackageJsons(cachedPackageJsons);
      clack.log.success('Package.json files restored');

      // Revert CHANGELOG.md files from git
      clack.log.info('Reverting CHANGELOG.md files...');
      try {
        execSync("git checkout -- '**/CHANGELOG.md'", { stdio: 'pipe', cwd: rootDir });
        clack.log.success('CHANGELOG.md files reverted');
      } catch {
        clack.log.warn('Failed to revert CHANGELOG.md files');
      }

      // Revert .changeset directory from git
      clack.log.info('Reverting .changeset directory...');
      try {
        execSync('git checkout -- .changeset', { stdio: 'pipe', cwd: rootDir });
        clack.log.success('.changeset directory reverted');
      } catch {
        clack.log.warn('Failed to revert .changeset directory');
      }

      // Re-enter prerelease mode if we were in it
      if (wasInPrereleaseMode) {
        clack.log.info('Re-entering prerelease mode...');
        try {
          execSync('pnpm changeset-cli pre enter alpha', { stdio: 'pipe', cwd: rootDir });
          clack.log.success('Re-entered prerelease mode');
        } catch {
          clack.log.warn('Failed to re-enter prerelease mode');
        }
      }
    };

    try {
      // Step 2: Update workspace dependencies (workspace:^ -> workspace:*)
      spinner.start('Updating workspace dependencies...');
      updateWorkspaceDeps(rootDir);
      spinner.stop('Workspace dependencies updated');

      // Step 3: Exit prerelease mode if active
      spinner.start('Exiting changeset prerelease mode...');
      try {
        execSync('pnpm changeset-cli pre exit', { stdio: 'pipe', cwd: rootDir });
        spinner.stop('Exited prerelease mode');
      } catch {
        // Not in prerelease mode, that's ok
        spinner.stop('Not in prerelease mode');
      }

      // Step 4: Version with snapshot
      spinner.start(`Creating snapshot version with tag '${tag}'...`);
      try {
        execSync(`pnpm changeset-cli version --snapshot ${tag}`, {
          stdio: 'pipe',
          cwd: rootDir,
        });
        spinner.stop('Snapshot version created');
      } catch (err) {
        spinner.stop('Failed to create snapshot version');
        clack.log.error(err instanceof Error ? err.message : String(err));
        throw err;
      }

      // Step 5: Publish
      if (dryRun) {
        clack.log.info('Skipping publish (dry run)');
        cleanup();
        clack.outro('Dry run completed');
        return;
      }

      spinner.start(`Publishing to ${registry} with tag '${tag}'...`);
      try {
        execSync('pnpm config set //localhost:4873/:_authToken fake', {
          stdio: 'inherit',
          cwd: rootDir,
        });
        execSync(`pnpm publish -r --no-git-checks --tag ${tag} --access public --registry ${registry}`, {
          stdio: 'inherit',
          cwd: rootDir,
          env: {
            ...process.env,
            NODE_AUTH_TOKEN: 'fake',
          },
        });
        spinner.stop('Published successfully');
      } catch (err) {
        console.log(err);
        spinner.stop('Failed to publish');
        clack.log.error(err instanceof Error ? err.message : String(err));
        throw err;
      }

      clack.log.success(`Snapshot published with tag '${tag}'`);
      clack.log.info(`Install with: pnpm add @mastra/core@${tag} --registry ${registry}`);
    } finally {
      cleanup();
    }

    clack.outro('Done');
  },
});
