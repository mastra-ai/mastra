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
  execSync('git reset --soft HEAD~1', {
    cwd: rootDir,
    stdio: ['inherit', 'inherit', 'pipe'],
  });

  if (registry) {
    registry.kill();
  }
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

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

const rootDir = resolve(import.meta.dirname, '..', '..');
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
} finally {
  cleanup();
}
