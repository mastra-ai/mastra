import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const exampleDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const repoRoot = path.resolve(exampleDir, '..', '..');

const linkedPackages = ['mastra', '@mastra/deployer-vercel', '@mastra/core', '@mastra/memory', '@mastra/editor'];

// remote cache miss = turbo builds linked packages for real — root toolchain must be installed
const rootPackageManager = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8')).packageManager;
const rootPnpm = rootPackageManager.split('+')[0];
execFileSync(
  'npx',
  ['-y', rootPnpm, 'install', '--frozen-lockfile', ...linkedPackages.flatMap(name => ['--filter', `${name}...`])],
  { cwd: repoRoot, stdio: 'inherit' },
);

execFileSync('turbo', ['--cwd', repoRoot, 'build', ...linkedPackages.flatMap(name => ['--filter', name])], {
  stdio: 'inherit',
});
