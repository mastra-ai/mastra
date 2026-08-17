import { cp, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installWithRetry, runOrThrow } from '../_local-registry-setup/install.js';

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
  await writeFile(join(newPath, '.npmrc'), 'minimum-release-age=0\n');
  await writeFile(
    join(newPath, 'pnpm-workspace.yaml'),
    "packages:\n  - '.'\nallowBuilds:\n  esbuild: true\n  sharp: true\n  protobufjs: true\n  workerd: true\n  bufferutil: true\n  utf-8-validate: true\n",
  );

  const installArgs = pkgManager === 'pnpm' ? ['install', '--config.minimum-release-age=0'] : ['install'];
  const env = {
    ...process.env,
    pnpm_config_minimum_release_age: '0',
  };

  console.log('Directory:', newPath);
  console.log('Installing dependencies...');
  installWithRetry(pkgManager, installArgs, { cwd: newPath, shell: true, env });

  console.log('building mastra...');
  runOrThrow(pkgManager, ['build'], { cwd: newPath, shell: true, env });
}
