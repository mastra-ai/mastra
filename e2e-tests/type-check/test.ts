/**
 * Type-checking E2E tests for @mastra/core
 *
 * These tests verify that @mastra/core compiles correctly in a real userland environment.
 * We publish packages to a local Verdaccio registry and install them in a fresh project
 * outside the monorepo to catch type errors that wouldn't surface during development:
 *
 * - Missing or incorrect type exports
 * - Broken type references to internal packages
 * - Dependencies on dev-only types not available to end users
 *
 * Running type checks inside the monorepo would incorrectly resolve dev dependencies
 * and miss these issues.
 *
 * Usage: npx tsx test.ts
 */

import { join } from 'node:path';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

// Mock TestProject to capture .provide() calls
const providedContext: Record<string, string> = {};

const mockProject = {
  provide(key: string, value: string) {
    providedContext[key] = value;
    console.log(`[provide] ${key}: ${value}`);
  },
};

async function main() {
  // Dynamically import setup to run it
  const { default: setup } = await import('./setup.js');
  const { setupTemplate } = await import('./prepare.js');

  const teardown = await setup(mockProject as any);

  const fixturePath = await mkdtemp(join(tmpdir(), `mastra-${providedContext.tag}-`));
  process.env.npm_config_registry = providedContext.registry;
  await setupTemplate(fixturePath, 'pnpm');

  try {
    spawnSync('pnpm', ['vitest', 'run'], {
      cwd: fixturePath,
      stdio: 'inherit',
      env: {
        ...process.env,
        npm_config_registry: providedContext.registry,
      },
    });
  } finally {
    await teardown();
  }
}

main().catch(err => {
  console.error('Setup failed:', err);
  process.exit(1);
});
