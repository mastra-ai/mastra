import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const electronPackageJson = require.resolve('electron/package.json');
const electronDist = join(dirname(electronPackageJson), 'dist');
const targets = process.argv.slice(2);

if (targets.length === 0) {
  throw new Error('Pass at least one macOS electron-builder target.');
}

const builderBin = process.platform === 'win32' ? 'electron-builder.cmd' : 'electron-builder';
const result = spawnSync(
  builderBin,
  ['--mac', ...targets, '--publish', 'never', `-c.electronDist=${electronDist}`],
  {
    env: {
      ...process.env,
      CSC_IDENTITY_AUTO_DISCOVERY: 'false',
    },
    stdio: 'inherit',
  },
);

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
