import { cp, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execa } from 'execa';

/**
 *
 * @param {string} pathToStoreFiles
 * @param {'pnpm' | 'npm' | 'yarn'} pkgManager
 */
export async function setupMonorepo(pathToStoreFiles, pkgManager) {
  const __dirname = dirname(fileURLToPath(import.meta.url));

  const monorepoPath = join(__dirname, 'template');
  const newPath = pathToStoreFiles;

  await mkdir(newPath, { recursive: true });
  await cp(monorepoPath, newPath, { recursive: true });
  await cp(join(__dirname, '..', '..', 'tsconfig.node.json'), join(newPath, 'tsconfig.json'));

  console.log('Directory:', newPath);
  console.log('Installing dependencies...');
  await execa(pkgManager, ['install'], {
    cwd: newPath,
    stdio: 'inherit',
    env: process.env,
  });
}
