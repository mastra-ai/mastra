import { cp, mkdir, writeFile } from 'node:fs/promises';
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
  await writeFile(join(newPath, '.npmrc'), 'minimum-release-age=0\n');

  const installArgs = pkgManager === 'pnpm' ? ['install', '--config.minimum-release-age=0'] : ['install'];
  const env = {
    ...process.env,
    npm_config_minimum_release_age: '0',
  };

  console.log('Directory:', newPath);
  console.log('Installing dependencies...');
  await execa(pkgManager, installArgs, {
    cwd: newPath,
    stdio: 'inherit',
    env,
  });
}
