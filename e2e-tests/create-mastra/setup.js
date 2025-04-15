import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { globby } from 'globby';
import { runRegistry, login } from './registry.js';
import { resolve, join } from 'node:path';
import { mkdir } from 'node:fs/promises';

const rootDir = resolve(join(process.cwd(), '..', '..'));

function cleanup(registry, resetChanges = false) {
  execSync('git checkout .', {
    cwd: rootDir,
    stdio: ['inherit', 'inherit', 'pipe'],
  });
  execSync('git clean -fd', {
    cwd: rootDir,
    stdio: ['inherit', 'inherit', 'pipe'],
  });

  if (resetChanges) {
    execSync('git reset --soft HEAD~1', {
      cwd: rootDir,
      stdio: ['inherit', 'inherit', 'pipe'],
    });
  }

  if (registry) {
    registry.kill();
  }
}

/**
 *
 * @param {string} storageDirectory
 * @param {number} port
 * @returns
 */
export async function setupRegistry(storageDirectory, port) {
  const registry = await runRegistry(['-c', './verdaccio.yaml', '-l', `${port}`], {
    cwd: storageDirectory,
  });
  login('mastra', 'mastra-ai', port);
  let shelvedChanges = false;

  try {
    const gitStatus = execSync('git status --porcelain', {
      cwd: rootDir,
      encoding: 'utf8',
    });

    if (gitStatus.length > 0) {
      execSync('git add -A', {
        cwd: rootDir,
        stdio: ['inherit', 'inherit', 'pipe'],
      });
      execSync('git commit -m "SAVEPOINT"', {
        cwd: rootDir,
        stdio: ['inherit', 'inherit', 'pipe'],
      });
      shelvedChanges = true;
    }

    await (async function updateWorkspaceDependencies() {
      // Update workspace dependencies to use ^ instead of *
      const packageFiles = await globby('**/package.json', {
        ignore: ['**/node_modules/**'],
      });

      for (const file of packageFiles) {
        const content = readFileSync(file, 'utf8');
        const updated = content.replace(/"workspace:\^"/g, '"workspace:*"');
        writeFileSync(file, updated);
      }
    })();

    execSync('pnpm changeset pre exit', {
      cwd: rootDir,
      stdio: ['inherit', 'inherit', 'pipe'],
    });

    execSync('pnpm changeset version --snapshot create-mastra-e2e-test', {
      cwd: rootDir,
      stdio: ['inherit', 'inherit', 'pipe'],
    });

    execSync(
      `pnpm --filter="create-mastra^..." --filter="create-mastra" publish --registry=http://localhost:${port}/ --no-git-checks --tag=create-mastra-e2e-test`,
      {
        cwd: rootDir,
        stdio: ['ignore', 'ignore', 'ignore'],
      },
    );
  } catch (error) {
    cleanup(registry);
    throw error;
  }

  return () => cleanup(registry, shelvedChanges);
}

export async function runCreateMastra(rootDir, pkgManager) {
  execSync(`${pkgManager} dlx create-mastra@create-mastra-e2e-test -c agents,tools,workflows -l openai -e project`, {
    cwd: rootDir,
    stdio: ['inherit', 'inherit', 'pipe'],
  });
}
