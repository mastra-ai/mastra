import { cp, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installWithRetry } from '../_local-registry-setup/install.js';

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
  installWithRetry(pkgManager, installArgs, {
    cwd: newPath,
    env: process.env,
  });
}
