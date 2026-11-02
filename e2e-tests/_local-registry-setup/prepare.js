import { exec, execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';

const execAsync = promisify(exec);
const gitIdentityEnv = {
  GIT_AUTHOR_NAME: 'GitHub Action',
  GIT_AUTHOR_EMAIL: 'action@github.com',
  GIT_COMMITTER_NAME: 'GitHub Action',
  GIT_COMMITTER_EMAIL: 'action@github.com',
};

async function cleanup(monorepoDir, resetChanges = false) {
  execSync('git checkout .', {
    cwd: monorepoDir,
    stdio: ['inherit', 'inherit', 'pipe'],
  });
  execSync('git clean -fd', {
    cwd: monorepoDir,
    stdio: ['inherit', 'inherit', 'pipe'],
  });

  if (resetChanges) {
    execSync('git reset --soft HEAD~1', {
      cwd: monorepoDir,
      stdio: ['inherit', 'inherit', 'pipe'],
    });
  }
}

function stripWorkspaceTrustPolicy(monorepoDir) {
  const workspacePath = join(monorepoDir, 'pnpm-workspace.yaml');
  const localRegistryIncompatibleSettings = [
    'blockExoticSubdeps',
    'trustPolicy',
    'trustPolicyIgnoreAfter',
    'minimumReleaseAge',
  ];

  try {
    const content = readFileSync(workspacePath, 'utf8');
    const nextContent = content
      .split('\n')
      .filter(line => !localRegistryIncompatibleSettings.some(setting => line.startsWith(`${setting}:`)))
      .join('\n');

    if (nextContent !== content) {
      console.log('Removing pnpm registry policy settings for local registry tests');
      writeFileSync(workspacePath, nextContent);
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      throw error;
    }
  }
}

/**
 *
 * @param {string} monorepoDir
 * @param {typeof import('tinyglobby').glob} glob
 * @param {string} tag
 * @returns
 */
export async function prepareMonorepo(monorepoDir, glob, tag) {
  let shelvedChanges = false;

  console.log('Storing changes into SAVEPOINT.');
  try {
    const gitStatus = await execAsync('git status --porcelain', {
      cwd: monorepoDir,
      encoding: 'utf8',
    });

    if (gitStatus.stdout.length > 0) {
      await execAsync('git add -A', {
        cwd: monorepoDir,
        stdio: ['inherit', 'inherit', 'inherit'],
      });
      await execAsync('git commit -m "SAVEPOINT" --no-verify', {
        cwd: monorepoDir,
        stdio: ['inherit', 'inherit', 'inherit'],
        env: {
          ...process.env,
          ...gitIdentityEnv,
          HUSKY: '0',
          GIT_AUTHOR_NAME: process.env.GIT_AUTHOR_NAME || 'Mastra CI',
          GIT_AUTHOR_EMAIL: process.env.GIT_AUTHOR_EMAIL || 'ci@mastra.ai',
          GIT_COMMITTER_NAME: process.env.GIT_COMMITTER_NAME || 'Mastra CI',
          GIT_COMMITTER_EMAIL: process.env.GIT_COMMITTER_EMAIL || 'ci@mastra.ai',
        },
      });
      shelvedChanges = true;
    }

    stripWorkspaceTrustPolicy(monorepoDir);

    console.log('Updating workspace dependencies to use * instead of ^');
    await (async function updateWorkspaceDependencies() {
      // Update workspace dependencies to use ^ instead of *
      const packageFiles = await glob('**/package.json', {
        ignore: ['**/node_modules/**', '**/examples/**'],
        cwd: monorepoDir,
      });

      for (const file of packageFiles) {
        const content = readFileSync(join(monorepoDir, file), 'utf8');

        const parsed = JSON.parse(content);
        if (parsed?.peerDependencies?.['@mastra/core']) {
          parsed.peerDependencies['@mastra/core'] = 'workspace:*';
        }

        // convert all workspace dependencies to *
        for (const dependency of Object.keys(parsed.dependencies || {})) {
          if (parsed.dependencies[dependency]?.startsWith('workspace:')) {
            parsed.dependencies[dependency] = 'workspace:*';
          }
        }
        // convert all workspace devDependencies to *
        for (const dependency of Object.keys(parsed.devDependencies || {})) {
          if (parsed.devDependencies[dependency]?.startsWith('workspace:')) {
            parsed.devDependencies[dependency] = 'workspace:*';
          }
        }

        writeFileSync(join(monorepoDir, file), JSON.stringify(parsed, null, 2));
      }
    })();

    // Give every publishable package the same snapshot version, matching what
    // `changeset version --snapshot` produced. Internal dependencies are `workspace:`
    // ranges at this point, and pnpm publish rewrites them to this version.
    const timestamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
    const snapshotVersion = `0.0.0-${tag}-${timestamp}`;
    console.log(`Setting publishable package versions to ${snapshotVersion}`);
    const allPackages = await execAsync('pnpm ls -r --depth -1 --json', {
      cwd: monorepoDir,
    });
    for (const pkg of JSON.parse(allPackages.stdout)) {
      if (!pkg.name || pkg.private) {
        continue;
      }
      const manifestPath = join(pkg.path, 'package.json');
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      manifest.version = snapshotVersion;
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    }
  } catch (error) {
    await cleanup(monorepoDir, false);
    throw error;
  }

  return () => cleanup(monorepoDir, shelvedChanges);
}
