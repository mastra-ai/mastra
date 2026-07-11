import { spawnSync } from 'node:child_process';

import { resolveElectronDist } from './electron-dist.mjs';

const electronDist = resolveElectronDist();
const packageRoot = new URL('..', import.meta.url);
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

/** @param {NodeJS.ProcessEnv} env */
function hasNotarizationCredentials(env) {
  return (
    (env.APPLE_API_KEY && env.APPLE_API_KEY_ID && env.APPLE_API_ISSUER) ||
    (env.APPLE_ID && env.APPLE_APP_SPECIFIC_PASSWORD && env.APPLE_TEAM_ID) ||
    (env.APPLE_KEYCHAIN && env.APPLE_KEYCHAIN_PROFILE)
  );
}

if (process.platform !== 'darwin') throw new Error('macOS releases must be built on macOS');
if (!hasNotarizationCredentials(process.env)) {
  throw new Error(
    'Missing Apple notarization credentials. Configure App Store Connect API key, Apple ID, or keychain profile credentials.',
  );
}

const buildResult = spawnSync(pnpm, ['run', 'desktop:build'], {
  cwd: packageRoot,
  stdio: 'inherit',
  env: process.env,
});
if (buildResult.status !== 0) process.exit(buildResult.status ?? 1);

const result = spawnSync(
  pnpm,
  [
    'exec',
    'electron-builder',
    '--mac',
    'dmg',
    'zip',
    `-c.electronDist=${electronDist}`,
    '-c.forceCodeSigning=true',
    '-c.mac.notarize=true',
  ],
  {
    cwd: packageRoot,
    stdio: 'inherit',
    env: process.env,
  },
);

if (result.status !== 0) process.exit(result.status ?? 1);
