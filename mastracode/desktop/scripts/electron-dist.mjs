import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);

export function resolveElectronDist() {
  const electronRoot = dirname(require.resolve('electron/package.json'));
  const electronDist = join(electronRoot, 'dist');
  if (existsSync(electronDist)) return electronDist;

  const result = spawnSync(process.execPath, [join(electronRoot, 'install.js')], { stdio: 'inherit' });
  if (result.status !== 0 || !existsSync(electronDist)) {
    throw new Error(`Electron runtime installation failed with status ${result.status ?? 'unknown'}`);
  }
  return electronDist;
}
