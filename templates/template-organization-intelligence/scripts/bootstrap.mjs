import { spawnSync } from 'node:child_process';

const install = spawnSync('npm', ['ci'], { stdio: 'inherit' });
if (install.status !== 0) process.exit(install.status ?? 1);

const start = spawnSync('npm', ['run', 'dev'], { stdio: 'inherit' });
process.exit(start.status ?? 1);
