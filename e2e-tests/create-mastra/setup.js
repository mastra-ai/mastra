import getPort from 'get-port';
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { readFileSync, writeFileSync } from 'node:fs';
import { globby } from 'globby';
import { runRegistry, login } from './registry.js';
// 1. setup verdaccio
// 2. publish all local packages

const port = await getPort();
const registry = await runRegistry(['-c', './verdaccio.yaml', '-l', `${port}`], {});

login('mastra', 'mastra-ai', port);
registry.on('message', message => {
  console.log(message);
});

function cleanup() {
  execSync('git checkout .', {
    cwd: rootDir,
    stdio: ['inherit', 'inherit', 'pipe'],
  });
  execSync('git clean -fd', {
    cwd: rootDir,
    stdio: ['inherit', 'inherit', 'pipe'],
  });
  execSync('git reset --soft HEAD~1', {
    cwd: rootDir,
    stdio: ['inherit', 'inherit', 'pipe'],
  });

  if (registry) {
    registry.kill();
  }
}

export function setupRegistry(port) {
  try {
    execSync('git add -A', {
      cwd: rootDir,
      stdio: ['inherit', 'inherit', 'pipe'],
    });
    execSync('git commit -m "SAVEPOINT"', {
      cwd: rootDir,
      stdio: ['inherit', 'inherit', 'pipe'],
    });

    execSync('pnpm changeset pre exit', {
      cwd: rootDir,
      stdio: ['inherit', 'inherit', 'pipe'],
    });

    execSync('pnpm changeset version --snapshot create-mastra-e2e-test', {
      cwd: rootDir,
      stdio: ['inherit', 'inherit', 'pipe'],
    });

    execSync(
      `pnpm --filter="create-mastra^..." publish --registry=http://localhost:${port}/ --no-git-checks --tag=create-mastra-e2e-test`,
      {
        cwd: rootDir,
        stdio: ['inherit', 'inherit', 'pipe'],
      },
    );
  } catch (error) {
    cleanup();
    throw error;
  }

  return cleanup;
}
