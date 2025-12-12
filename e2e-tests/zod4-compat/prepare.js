import { spawnSync } from 'node:child_process';
import { cp, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export async function setupTestProject(pathToStoreFiles) {
  const __dirname = dirname(fileURLToPath(import.meta.url));

  const projectPath = join(__dirname, 'template');
  const newPath = pathToStoreFiles;

  await mkdir(newPath, { recursive: true });
  await cp(projectPath, newPath, { recursive: true });

  console.log('Installing dependencies...');
  const res = spawnSync('pnpm', ['install'], {
    cwd: newPath,
    stdio: 'inherit',
    env: process.env,
  });

  if (res.status !== 0) {
    throw new Error(`[Setup Test Project] pnpm install failed with exit code ${res.status}`);
  }
}
