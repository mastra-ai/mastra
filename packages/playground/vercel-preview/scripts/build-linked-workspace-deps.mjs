import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repoRoot = path.resolve(appDir, '..', '..', '..');

const linkedPackages = ['mastra', '@mastra/deployer-vercel', '@mastra/core', '@mastra/memory', '@mastra/editor'];

// remote cache miss = turbo builds linked packages for real — root toolchain must be installed
const rootPackageManager = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8')).packageManager;
const rootPnpm = rootPackageManager.split('+')[0];
execFileSync(
  'npx',
  ['-y', rootPnpm, 'install', '--frozen-lockfile', ...linkedPackages.flatMap(name => ['--filter', `${name}...`])],
  { cwd: repoRoot, stdio: 'inherit' },
);

// app's own pinned turbo — script must also work outside pnpm run, where .bin is not on PATH
// keep peak memory within Vercel's preview builder limit when the full dependency graph misses cache
const turboBin = path.join(appDir, 'node_modules', '.bin', 'turbo');
execFileSync(
  turboBin,
  ['--cwd', repoRoot, 'build', '--concurrency=2', ...linkedPackages.flatMap(name => ['--filter', name])],
  {
    stdio: 'inherit',
  },
);
