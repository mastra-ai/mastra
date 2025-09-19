import { spawnSync } from 'node:child_process';
import { cp, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 *
 * @param {string} pathToStoreFiles
 * @param {string} tag
 * @param {'pnpm' | 'npm' | 'yarn'} pkgManager
 */
export async function setupMonorepo(pathToStoreFiles, tag, pkgManager) {
  const __dirname = dirname(fileURLToPath(import.meta.url));

  const monorepoPath = join(__dirname, 'template');
  const newPath = pathToStoreFiles;

  await mkdir(newPath, { recursive: true });
  await cp(monorepoPath, newPath, { recursive: true });
  await cp(join(__dirname, '..', '..', 'tsconfig.node.json'), join(newPath, 'tsconfig.json'));

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
    cwd: join(newPath, 'apps', 'custom'),
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });
}
