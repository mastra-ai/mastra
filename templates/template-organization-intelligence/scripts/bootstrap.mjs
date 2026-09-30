import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

// Official templates omit lockfiles; use the locally generated lockfile on subsequent runs.
const hasLockfile = existsSync('package-lock.json') || existsSync('npm-shrinkwrap.json');
const install = spawnSync('npm', [hasLockfile ? 'ci' : 'install'], { stdio: 'inherit' });
if (install.status !== 0) process.exit(install.status ?? 1);

const start = spawnSync('npm', ['run', 'dev'], { stdio: 'inherit' });
process.exit(start.status ?? 1);
