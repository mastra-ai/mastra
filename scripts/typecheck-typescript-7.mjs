#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const tscPath = fileURLToPath(new URL('../node_modules/typescript-native/bin/tsc', import.meta.url));

// Mirror the non-example/non-exploration workspace configs exercised by the
// root `pnpm typecheck` lane, preserving package-specific project selections.
// Include changed package configs that do not currently expose a typecheck
// script so TypeScript 7 rejects removed compiler options here instead of later.
const configs = [
  'channels/slack/tsconfig.json',
  'packages/_changeset-cli/tsconfig.json',
  'packages/_internal-core/tsconfig.build.json',
  'packages/_internals/auth/tsconfig.build.json',
  'packages/_internals/voice/tsconfig.build.json',
  'packages/cli/tsconfig.json',
  'packages/codemod/tsconfig.json',
  'packages/core/tsconfig.build.json',
  'packages/editor/tsconfig.json',
  'packages/mcp-registry-registry/tsconfig.json',
  'packages/playground/tsconfig.build.json',
  'packages/playground-ui/tsconfig.json',
  'packages/playground-ui/.storybook/tsconfig.json',
  'stores/duckdb/tsconfig.json',
  'stores/dynamodb/tsconfig.json',
  'workflows/temporal/tsconfig.json',
];

if (!existsSync(tscPath)) {
  console.error(`TypeScript 7 compiler not found at ${tscPath}`);
  console.error('Run `pnpm install` to install the `typescript-native` alias.');
  process.exit(1);
}

const failures = [];

for (const config of configs) {
  if (!existsSync(new URL(`../${config}`, import.meta.url))) {
    failures.push(config);
    console.error(`\n✗ ${config} does not exist`);
    continue;
  }

  console.log(`\n▶ TypeScript 7: ${config}`);
  const result = spawnSync(process.execPath, [tscPath, '--noEmit', '--pretty', 'false', '-p', config], {
    cwd: root,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    failures.push(config);
  }
}

if (failures.length > 0) {
  console.error(`\nTypeScript 7 compatibility check failed for ${failures.length} config(s):`);
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('\nTypeScript 7 compatibility check passed.');
