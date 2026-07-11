import { spawnSync } from 'node:child_process';

import { resolveElectronDist } from './electron-dist.mjs';

const target = process.argv[2] ?? 'dir';
const electronDist = resolveElectronDist();
const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

const result = spawnSync(pnpm, ['exec', 'electron-builder', '--mac', target, `-c.electronDist=${electronDist}`], {
  cwd: new URL('..', import.meta.url),
  stdio: 'inherit',
  env: {
    ...process.env,
    CSC_IDENTITY_AUTO_DISCOVERY: 'false',
    MASTRACODE_DESKTOP_LOCAL_ALPHA_BUILD: '1',
  },
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
