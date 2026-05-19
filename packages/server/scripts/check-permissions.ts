/**
 * Checks if permissions.generated.ts is up-to-date with SERVER_ROUTES.
 *
 * This script:
 * 1. Generates permissions and compares with existing file
 * 2. Verifies generator output includes getEffectivePermission for each route
 *
 * Usage: pnpm check:permissions (from packages/server)
 */

import * as fs from 'node:fs';

import { SERVER_ROUTES } from '../src/server/server-adapter/routes/index.js';
import { getEffectivePermission } from '../src/server/server-adapter/routes/permissions.js';
import { OUTPUT_PATH, derivePermissionData, generatePermissionFileContent } from './permission-generator.js';

const data = derivePermissionData();
const generatedContent = generatePermissionFileContent(data);

// Verify generator includes getEffectivePermission for each route. The generator
// also keeps compatibility permissions that are public RBAC surface but are not
// represented in SERVER_ROUTES at runtime.
const generatedPermissions = new Set(data.permissions);
const mismatches: string[] = [];

for (const route of SERVER_ROUTES) {
  if (route.method === 'ALL') continue;

  const runtimePerm = getEffectivePermission(route);
  if (runtimePerm) {
    if (!generatedPermissions.has(runtimePerm)) {
      mismatches.push(`Missing: ${runtimePerm} (from ${route.method} ${route.path})`);
    }
  }
}

if (mismatches.length > 0) {
  console.error('✗ Generator output is missing route permissions:');
  for (const m of mismatches) {
    console.error(`  - ${m}`);
  }
  process.exit(1);
}

// Read existing file
let existingContent: string;
try {
  existingContent = fs.readFileSync(OUTPUT_PATH, 'utf-8');
} catch {
  console.error('✗ permissions.generated.ts does not exist');
  console.error('  Run `pnpm generate:permissions` to create it');
  process.exit(1);
}

// Compare
if (generatedContent === existingContent) {
  console.info('✓ permissions.generated.ts is up-to-date');
  console.info(`  - ${data.resources.length} resources`);
  console.info(`  - ${data.actions.length} actions`);
  console.info(`  - ${data.permissions.length} permission combinations`);
  console.info('✓ Generator includes getEffectivePermission for all routes');
  process.exit(0);
} else {
  console.error('✗ permissions.generated.ts is stale');
  console.error('  Run `pnpm generate:permissions` to update it');
  process.exit(1);
}
