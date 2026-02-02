/**
 * Checks if permissions.generated.ts is up-to-date with SERVER_ROUTES.
 *
 * This script generates permissions to a temporary file and compares it
 * with the existing generated file. Exits with code 1 if they differ.
 *
 * Usage: pnpm check:permissions (from packages/server)
 */

import * as fs from 'node:fs';

import { OUTPUT_PATH, derivePermissionData, generatePermissionFileContent } from './permission-generator.js';

const data = derivePermissionData();
const generatedContent = generatePermissionFileContent(data);

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
  process.exit(0);
} else {
  console.error('✗ permissions.generated.ts is stale');
  console.error('  Run `pnpm generate:permissions` to update it');
  process.exit(1);
}
