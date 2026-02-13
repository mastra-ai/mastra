/**
 * Generates type-safe permission types from SERVER_ROUTES.
 *
 * This script imports the actual route definitions and derives all valid permissions
 * by iterating over SERVER_ROUTES and extracting resources from paths.
 *
 * Usage: pnpm generate:permissions (from packages/server)
 *
 * Note: This requires the server package to be built first, or use tsx to run directly.
 */

import * as fs from 'node:fs';

import { OUTPUT_PATH, derivePermissionData, generatePermissionFileContent } from './permission-generator.js';

const data = derivePermissionData();
const content = generatePermissionFileContent(data);

fs.writeFileSync(OUTPUT_PATH, content);

console.info(`✓ Generated ${OUTPUT_PATH}`);
console.info(`  - ${data.resources.length} resources`);
console.info(`  - ${data.actions.length} actions`);
console.info(`  - ${data.permissions.length} permission combinations`);
