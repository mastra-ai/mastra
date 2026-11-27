import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll } from 'vitest';

// Settings, auth and the database resolve from MASTRA_APP_DATA_DIR. Point it at a
// fresh temp folder so a test whose mocks don't apply can never write the real
// Mastra Code app data.
const testAppDataDir = mkdtempSync(join(tmpdir(), 'mastracode-test-app-data-'));
process.env.MASTRA_APP_DATA_DIR = testAppDataDir;
afterAll(() => rmSync(testAppDataDir, { recursive: true, force: true }));

// A Mastra gateway key in the developer's shell adds the whole `mastra/` catalog to every
// model list and reroutes gateway aliases. Tests that need the gateway stub these themselves.
delete process.env.MASTRA_GATEWAY_API_KEY;
delete process.env.MASTRA_GATEWAY_VERSION;
delete process.env.MASTRA_GATEWAY_URL;
