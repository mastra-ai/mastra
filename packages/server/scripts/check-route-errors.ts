/**
 * Checks that every built-in route's `errors` lists each business code its handler can reach.
 *
 * Framework codes (`COMMON_ERROR_CODES`, plus `AUTH_ERROR_CODES` on authenticated routes) are
 * added to every route by `generate:route-types`, so routes don't list them.
 *
 * Usage (from packages/server):
 *   pnpm check:route-errors          report routes missing codes
 *   pnpm check:route-errors --write  add the missing codes to each route's `errors`
 */

import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { analyzeRouteErrors, missingErrorCodes, writeRouteErrors } from './route-error-analysis.js';
import type { AnalyzedRoute } from './route-error-analysis.js';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const write = process.argv.includes('--write');

const routes = analyzeRouteErrors(serverRoot);
const missing = new Map<AnalyzedRoute, string[]>();
for (const route of routes) {
  const codes = missingErrorCodes(route);
  if (codes.length > 0) missing.set(route, codes);
}

if (missing.size === 0) {
  console.log(`✓ ${routes.length} routes declare every error code they can return`);
  process.exit(0);
}

if (write) {
  const updates = new Map([...missing].map(([route, codes]) => [route, [...(route.declared ?? []), ...codes]]));
  const files = writeRouteErrors(serverRoot, updates);
  console.log(`Updated errors on ${missing.size} routes in ${files.length} files. Run the formatter on:`);
  for (const f of files) console.log(`  ${f}`);
  process.exit(0);
}

console.error(`✗ ${missing.size} routes can return error codes they don't declare in \`errors\`:`);
for (const [route, codes] of missing) {
  console.error(`  - ${route.name} (${route.file}:${route.line}): ${codes.join(', ')}`);
}
console.error('\nRun `pnpm check:route-errors --write` to add them.');
process.exit(1);
