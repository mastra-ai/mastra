import { spawnSync, spawn } from 'node:child_process';
import { cp, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function setupTestProject(pathToStoreFiles, registryUrl) {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  console.log('[Setup Test Project] Registry URL', registryUrl);

  const projectPath = join(__dirname, 'template');
  const newPath = pathToStoreFiles;

  console.log('[Setup Test Project] Copying template to ', newPath);

  await mkdir(newPath, { recursive: true });
  await cp(projectPath, newPath, { recursive: true });

  console.log('[Setup Test Project] Installing dependencies');

  spawnSync('pnpm', ['install'], {
    cwd: newPath,
    stdio: 'inherit',
    env: {
      ...process.env,
      npm_config_registry: registryUrl,
    },
  });

  console.log('[Setup Test Project] Starting dev server');

  spawn('pnpm', ['dev'], {
    cwd: newPath,
    stdio: 'inherit',
  });
}
