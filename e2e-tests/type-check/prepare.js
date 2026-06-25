import { cp, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execa } from 'execa';

/**
 *
 * @param {string} pathToStoreFiles
 * @param {'pnpm' | 'npm' | 'yarn'} pkgManager
 */
export async function setupTemplate(pathToStoreFiles, pkgManager) {
  const __dirname = dirname(fileURLToPath(import.meta.url));

  const templatePath = join(__dirname, 'template');
  const newPath = pathToStoreFiles;

  await mkdir(newPath, { recursive: true });
  await cp(templatePath, newPath, { recursive: true });

  const installArgs =
    pkgManager === 'pnpm'
      ? ['install', '--config.minimum-release-age=0', '--config.trust-policy=no-check']
      : ['install'];

  console.log('Directory:', newPath);
  console.log('Installing dependencies...');
  await execa(pkgManager, installArgs, {
    cwd: newPath,
    stdio: 'inherit',
    env: process.env,
  });
}
