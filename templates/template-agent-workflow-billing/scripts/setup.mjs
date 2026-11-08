import { constants } from 'node:fs';
import { chmod, copyFile, lstat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { register } from 'node:module';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
process.env.MASTRA_PROJECT_ROOT = root;
try {
  await copyFile('.env.example', '.env', constants.COPYFILE_EXCL);
  await chmod('.env', 0o600);
} catch (error) {
  if (error.code !== 'EEXIST') throw error;
}
const info = await lstat('.env');
if (!info.isFile() || info.nlink !== 1) throw new Error('Setup requires a regular .env file.');
process.loadEnvFile('.env');
try {
  await import.meta.resolve('typescript');
  await import.meta.resolve('@mastra/core/mastra');
} catch {
  const npm = process.env.npm_execpath;
  const result = npm
    ? spawnSync(process.execPath, [npm, 'install', '--no-audit', '--no-fund'], { cwd: root, stdio: 'inherit' })
    : spawnSync('npm', ['install', '--no-audit', '--no-fund'], { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) throw new Error('Dependency installation failed.');
}
register('./typescript-loader.mjs', import.meta.url);
try {
  const { setupLocal } = await import('./setup.ts');
  await setupLocal(process.env);
  console.log(
    'Local weather profiles and shared allowance are ready. Credentials remain private in data/local-profiles.json.',
  );
} catch {
  console.error(
    'Setup failed safely. Check local mode, private state, and current credentials. Existing state was preserved.',
  );
  process.exitCode = 1;
}
