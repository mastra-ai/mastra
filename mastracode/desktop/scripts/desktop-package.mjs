import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const target = process.argv[2] ?? 'dir';
const electronDist = join(dirname(require.resolve('electron/package.json')), 'dist');
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
