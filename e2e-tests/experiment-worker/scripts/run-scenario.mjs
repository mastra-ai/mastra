import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
if (args[0] === '--') {
  args.shift();
}

const scenario = args.shift();
if (!scenario) {
  console.error('Usage: pnpm test:scenario -- <scenario-id> [vitest options]');
  process.exit(1);
}

const result = spawnSync('pnpm', ['exec', 'vitest', 'run', 'tests', '--testNamePattern', scenario, ...args], {
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
