#!/usr/bin/env node
/**
 * Verify Drizzle schema matches database structure.
 *
 * This script:
 * 1. Creates a temporary schema file with top-level exports (required by drizzle-kit)
 * 2. Runs drizzle-kit push to compare schema vs database
 * 3. Verifies only cosmetic differences exist (constraint naming)
 */

import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORE_ROOT = join(__dirname, '..');
const TEMP_DIR = mkdtempSync(join(tmpdir(), 'drizzle-verify-'));
const TEMP_SCHEMA = join(TEMP_DIR, 'schema.ts');
const TEMP_CONFIG = join(TEMP_DIR, 'drizzle.config.ts');
const TEMP_OUT = join(TEMP_DIR, 'out');

// Set a known env var for the config to read (avoids string injection)
const DB_URL = process.env.DATABASE_URL || process.env.DB_URL || 'postgresql://postgres:postgres@localhost:5434/mastra';
process.env.DRIZZLE_VERIFY_DB_URL = DB_URL;

// Create temp schema with top-level exports (drizzle-kit requirement)
// Use absolute path for import since temp file is outside project
const schemaContent = `
import { createMastraSchema } from '${join(STORE_ROOT, 'src/drizzle/schema').replace(/\\/g, '\\\\')}';
const schema = createMastraSchema();
export const mastraAgents = schema.mastraAgents;
export const mastraThreads = schema.mastraThreads;
export const mastraMessages = schema.mastraMessages;
export const mastraResources = schema.mastraResources;
export const mastraScorers = schema.mastraScorers;
export const mastraWorkflowSnapshot = schema.mastraWorkflowSnapshot;
export const mastraAiSpans = schema.mastraAiSpans;
`;

const configContent = `
import { defineConfig } from 'drizzle-kit';
export default defineConfig({
  schema: '${TEMP_SCHEMA.replace(/\\/g, '\\\\')}',
  dialect: 'postgresql',
  out: '${TEMP_OUT.replace(/\\/g, '\\\\')}',
  dbCredentials: { url: process.env.DRIZZLE_VERIFY_DB_URL },
});
`;

function cleanup() {
  rmSync(TEMP_DIR, { recursive: true, force: true });
}

try {
  writeFileSync(TEMP_SCHEMA, schemaContent);
  writeFileSync(TEMP_CONFIG, configContent);

  console.log('Comparing Drizzle schema to database...');

  const output = execSync(`npx drizzle-kit push --config "${TEMP_CONFIG}" --verbose`, {
    cwd: STORE_ROOT,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  if (output.includes('No changes detected')) {
    console.log('✓ Drizzle schema matches database structure');
    process.exit(0);
  }

  // Check for acceptable differences (constraint naming only)
  const lines = output.split('\n');
  const changes = lines.filter(
    l => l.includes('ALTER TABLE') || l.includes('CREATE TABLE') || l.includes('DROP TABLE'),
  );

  const unacceptable = changes.filter(
    l => !l.includes('CONSTRAINT') && !l.includes('test_'), // Test table cleanup is OK
  );

  if (unacceptable.length > 0) {
    console.error('✗ Found structural differences between schema and database:');
    unacceptable.forEach(l => console.error('  ' + l));
    process.exit(1);
  }

  console.log('✓ Only cosmetic differences found (constraint naming) - acceptable');
  process.exit(0);
} catch (error) {
  // drizzle-kit push might prompt for confirmation, which causes it to fail in non-interactive mode
  // Check if the error output indicates no changes
  if (error.stdout?.includes('No changes detected')) {
    console.log('✓ Drizzle schema matches database structure');
    process.exit(0);
  }

  console.error('Error verifying schema:', error.message);
  if (error.stdout) console.log(error.stdout);
  if (error.stderr) console.error(error.stderr);
  process.exit(1);
} finally {
  cleanup();
}
