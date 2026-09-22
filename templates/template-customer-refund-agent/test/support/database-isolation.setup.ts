import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll } from 'vitest';

const inheritedDatabaseUrl = process.env.DATABASE_URL;
const inheritedLegacyDatabaseUrl = process.env.TURSO_DATABASE_URL;
for (const name of [
  'APP_MODE',
  'DATABASE_URL',
  'TURSO_DATABASE_URL',
  'LOCAL_DEMO_DATABASE_URL',
  'LOCAL_DEMO_CLIENT_DATABASE_URL',
  'ORIGINAL_DATABASE_URL',
  'ORIGINAL_TURSO_DATABASE_URL',
  'ORIGINAL_DEMO_DATABASE_URL',
])
  delete process.env[name];
process.env.LOCAL_AUTH_SIGNING_KEY = 'phase003-test-signing-key-must-be-at-least-32-chars';
const inheritedAuthToken = process.env.TURSO_AUTH_TOKEN;
// Eval projects must never inherit an opt-in paid retrieval route or provider
// credentials from a developer shell. Deterministic transports are the only
// allowed validation transport in this test process.
delete process.env.SUPPORT_KNOWLEDGE_RETRIEVAL;
delete process.env.OPENAI_API_KEY;
delete process.env.OPENAI_BASE_URL;
// Phase 006 external calls are opt-in and never belong in ordinary tests.
// Clear every inherited Stripe setting before application composition can
// register a remote adapter; focused tests pass only synthetic fake configs.
process.env.COMMERCE_SOURCE = 'mock';
for (const name of [
  'STRIPE_SANDBOX_ENABLED',
  'STRIPE_TENANT_ID',
  'STRIPE_ACCOUNT_ID',
  'STRIPE_RESTRICTED_API_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'STRIPE_API_BASE_URL',
])
  delete process.env[name];
// Support composition is evaluated at import time as well. Clear every
// Intercom selector/configuration value inherited from a developer shell so
// ordinary tests cannot register an external adapter before a focused test
// explicitly supplies its synthetic configuration.
process.env.SUPPORT_SOURCE = 'mock';
for (const name of [
  'INTERCOM_DEVELOPMENT_ENABLED',
  'INTERCOM_TENANT_ID',
  'INTERCOM_APP_ID',
  'INTERCOM_ACCESS_TOKEN',
  'INTERCOM_CLIENT_SECRET',
  'INTERCOM_ADMIN_ID',
  'INTERCOM_API_BASE_URL',
  'INTERCOM_KNOWLEDGE_ENABLED',
  'INTERCOM_TICKET_TYPE_ID',
  'INTERCOM_TICKET_STATE_ID',
])
  delete process.env[name];
const databaseDirectory = mkdtempSync(join(tmpdir(), 'phase001-vitest-'));
const databasePath = join(databaseDirectory, 'support.db');

process.env.PHASE001_TEST_DATABASE_DIRECTORY = databaseDirectory;
process.env.PHASE001_TEST_DATABASE_URL = `file:${databasePath}`;
process.env.LOCAL_DEMO_DATABASE_URL = process.env.PHASE001_TEST_DATABASE_URL;
process.env.LOCAL_DEMO_CLIENT_DATABASE_URL = `file:${join(databaseDirectory, 'client.db')}`;
process.env.PHASE001_TEST_INHERITED_DATABASE_SENTINEL =
  inheritedDatabaseUrl?.startsWith(`file:${join(tmpdir(), 'phase001-vitest-inherited-sentinel-')}`) &&
  inheritedAuthToken === 'phase001-vitest-sentinel-token'
    ? 'present'
    : 'missing';
process.env.PHASE001_TEST_INHERITED_DATABASE_SENTINEL_PATH =
  process.env.PHASE001_TEST_INHERITED_DATABASE_SENTINEL === 'present' ? inheritedDatabaseUrl!.replace('file:', '') : '';
process.env.PHASE001_TEST_INHERITED_LEGACY_DATABASE_SENTINEL_PATH =
  inheritedLegacyDatabaseUrl?.startsWith(`file:${join(tmpdir(), 'phase001-vitest-inherited-legacy-sentinel-')}`) &&
  inheritedAuthToken === 'phase001-vitest-sentinel-token'
    ? inheritedLegacyDatabaseUrl.replace('file:', '')
    : '';
process.env.DATABASE_URL = process.env.PHASE001_TEST_DATABASE_URL;
process.env.TURSO_DATABASE_URL = process.env.PHASE001_TEST_DATABASE_URL;
// The canonical and compatibility names are isolated from inherited files.
process.env.ORIGINAL_DATABASE_URL = `file:${join(databaseDirectory, 'external-profile.db')}`;
process.env.ORIGINAL_TURSO_DATABASE_URL = `file:${join(databaseDirectory, 'external-legacy-profile.db')}`;
delete process.env.TURSO_AUTH_TOKEN;

afterAll(() => {
  rmSync(databaseDirectory, { force: true, recursive: true });
});
