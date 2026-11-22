import { constants } from 'node:fs';
import { chmod, copyFile, lstat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { register } from 'node:module';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
process.env.MASTRA_PROJECT_ROOT = root;
try {
  try {
    await copyFile('.env.example', '.env', constants.COPYFILE_EXCL);
    await chmod('.env', 0o600);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
  const info = await lstat('.env');
  if (!info.isFile() || info.nlink !== 1) {
    const error = new Error('Setup requires a regular .env file.');
    error.name = 'InvalidEnvironmentFileError';
    throw error;
  }
  process.loadEnvFile('.env');
  try {
    await import.meta.resolve('typescript');
    await import.meta.resolve('@mastra/core/mastra');
  } catch {
    const npm = process.env.npm_execpath;
    const result = npm
      ? spawnSync(process.execPath, [npm, 'install', '--no-audit', '--no-fund'], { cwd: root, stdio: 'inherit' })
      : spawnSync('npm', ['install', '--no-audit', '--no-fund'], { cwd: root, stdio: 'inherit' });
    if (result.status !== 0) {
      const error = result.error ?? new Error('Dependency installation failed.');
      error.name = 'DependencyInstallError';
      error.code ??= result.signal ?? `EXIT_${result.status ?? 'UNKNOWN'}`;
      throw error;
    }
  }
  register('./typescript-loader.mjs', import.meta.url);
  const { setupLocal } = await import('./setup.ts');
  await setupLocal(process.env);
  console.log(
    'Personal image profiles and local allowances are ready. Credentials remain private in data/local-profiles.json.',
  );
} catch (error) {
  if (['SetupLockError', 'UnsupportedPlatformError'].includes(error?.name)) console.error(error.message);
  const identifier = value => typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_.-]{0,79}$/.test(value);
  const name = identifier(error?.name) ? error.name : 'UnknownError';
  const code = identifier(error?.code) ? `; code=${error.code}` : '';
  console.error(`Setup failed (${name}${code}). Check the reported cause and inspect local state before retrying.`);
  process.exitCode = 1;
}
