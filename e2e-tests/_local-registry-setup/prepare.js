import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

function cleanup(monorepoDir, resetChanges = false) {
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

/**
 *
 * @param {string} storageDirectory
 * @param {number} port
 * @returns
 */
export async function prepareMonorepo(monorepoDir, glob) {
  let shelvedChanges = false;

  try {
    const gitStatus = execSync('git status --porcelain', {
      cwd: monorepoDir,
      encoding: 'utf8',
    });

    if (gitStatus.length > 0) {
      execSync('git add -A', {
        cwd: monorepoDir,
        stdio: ['inherit', 'inherit', 'inherit'],
      });
      execSync('git commit -m "SAVEPOINT"', {
        cwd: monorepoDir,
        stdio: ['inherit', 'inherit', 'inherit'],
      });
      shelvedChanges = true;
    }

    await (async function updateWorkspaceDependencies() {
      // Update workspace dependencies to use ^ instead of *
      const packageFiles = await glob('**/package.json', {
        ignore: ['**/node_modules/**', '**/examples/**'],
        cwd: monorepoDir,
      });

      for (const file of packageFiles) {
        const content = readFileSync(join(monorepoDir, file), 'utf8');
        const updated = content.replace(/"workspace:\^"/g, '"workspace:*"');

        const parsed = JSON.parse(content);
        if (parsed?.peerDependencies?.['@mastra/core']) {
          parsed.peerDependencies['@mastra/core'] = '*';
        }

        writeFileSync(join(monorepoDir, file), JSON.stringify(parsed, null, 2));
      }
    })();

    execSync('pnpm changeset pre exit', {
      cwd: monorepoDir,
      stdio: ['inherit', 'inherit', 'inherit'],
    });

    execSync('pnpm changeset version --snapshot create-mastra-e2e-test', {
      cwd: monorepoDir,
      stdio: ['inherit', 'inherit', 'inherit'],
    });
  } catch (error) {
    cleanup(monorepoDir, false);
    throw error;
  }

  return () => cleanup(monorepoDir, shelvedChanges);
}
