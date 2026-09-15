import { defineConfig } from 'vitest/config';

const prTests = [
  'tests/setup.test.ts',
  'tests/harness.test.ts',
  'tests/minimal-agent.test.ts',
  'tests/target-process.test.ts',
  'tests/runtime-resources.test.ts',
  'tests/native-duckdb.test.ts',
];

const fullTests = [
  ...prTests,
  'tests/full-workspace-lifecycle.test.ts',
  'tests/postgres-lifecycle.test.ts',
  'tests/project-shapes.test.ts',
  'tests/portability-isolation.test.ts',
  'tests/installed-boundary-negative.test.ts',
];

export function getTestFiles(tier: string | undefined) {
  return tier === 'full' ? fullTests : prTests;
}

export default defineConfig({
  test: {
    environment: 'node',
    include: getTestFiles(process.env.MASTRA_EXPERIMENT_E2E_TIER),
    globalSetup: ['./setup.ts'],
    reporters: ['default', './reporters/scenario-reporter.ts'],
    testTimeout: 90_000,
    hookTimeout: 15 * 60_000,
  },
});
