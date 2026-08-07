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

const result = spawnSync('pnpm', ['exec', 'vitest', 'run', '--testNamePattern', scenario, ...args], {
  stdio: 'inherit',
  env: {
    ...process.env,
    MASTRA_EXPERIMENT_E2E_TIER: process.env.MASTRA_EXPERIMENT_E2E_TIER ?? 'full',
    MASTRA_EXPERIMENT_E2E_SCENARIO: scenario,
  },
});

process.exit(result.status ?? 1);
