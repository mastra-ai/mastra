import { cp, mkdir, writeFile } from 'node:fs/promises';
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
  await writeFile(join(newPath, '.npmrc'), 'minimum-release-age=0\n');
  await writeFile(
    join(newPath, 'pnpm-workspace.yaml'),
    `packages:
  - '.'
allowBuilds:
  esbuild: true
  sharp: true
  protobufjs: true
minimumReleaseAge: 0
`,
  );

  const installArgs = pkgManager === 'pnpm' ? ['install', '--config.minimum-release-age=0'] : ['install'];
  const env = {
    ...process.env,
    pnpm_config_minimum_release_age: '0',
  };

  console.log('Directory:', newPath);
  console.log('Installing dependencies...');
  await execa(pkgManager, installArgs, {
    cwd: newPath,
    stdio: 'inherit',
    env,
  });
}
