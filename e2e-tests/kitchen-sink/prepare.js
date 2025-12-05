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

  const installResult = spawnSync('pnpm', ['install'], {
    cwd: newPath,
    stdio: 'inherit',
    env: {
      ...process.env,
      npm_config_registry: registryUrl,
    },
  });

  if (installResult.status !== 0) {
    throw new Error(`[Setup Test Project] pnpm install failed with exit code ${installResult.status}`);
  }

  console.log('[Setup Test Project] Starting dev server');

  const devServer = spawn('pnpm', ['dev'], {
    cwd: newPath,
    stdio: 'inherit',
    // Create a process group so we can kill it cleanly later
    detached: process.platform !== 'win32',
  });

  // Return cleanup function
  return () => {
    try {
      if (process.platform !== 'win32') {
        process.kill(-devServer.pid, 'SIGTERM');
      } else {
        devServer.kill('SIGTERM');
      }
    } catch {
      // Process may have already exited
    }
  };
}
