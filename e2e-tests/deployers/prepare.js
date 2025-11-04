import { spawnSync } from 'node:child_process';
import { cp, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 *
 * @param {string} pathToStoreFiles
 * @param {string} tag
 * @param {'pnpm' | 'npm' | 'yarn'} pkgManager
 * @param {string} deployer
 */
export async function setupDeployerProject(pathToStoreFiles, tag, pkgManager, deployer) {
  const __dirname = dirname(fileURLToPath(import.meta.url));

  const projectPath = join(__dirname, 'template', deployer);
  const newPath = pathToStoreFiles;

  await mkdir(newPath, { recursive: true });
  await cp(projectPath, newPath, { recursive: true });

  console.log('Directory:', newPath);
  console.log('Installing dependencies...');
  spawnSync(pkgManager, ['install'], {
    cwd: newPath,
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });

  console.log('building mastra...');
  spawnSync(pkgManager, ['build'], {
    cwd: newPath,
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });
}
