import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const mastraBin = process.platform === 'win32' ? 'mastra.cmd' : 'mastra';

const result = spawnSync(
  mastraBin,
  ['build', '--dir', join(packageRoot, 'src/starter/mastra'), '--root', packageRoot],
  {
    cwd: packageRoot,
    env: process.env,
    stdio: 'inherit',
  },
);

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
