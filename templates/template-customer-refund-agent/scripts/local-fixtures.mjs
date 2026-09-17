import { createClient } from '@libsql/client';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { requireLocalDatabaseUrl } from '../src/mastra/lib/database-url.ts';
import { isLocalMode } from '../config/app-mode.mjs';
import {
  localFixtureBinding,
  resetLocalFixtures,
  seedInteractiveLocalDemoFixtures,
  seedLocalFixtures,
} from '../src/mastra/runtime/local-fixtures.ts';

const mode = process.argv[2];
if (mode !== 'seed' && mode !== 'reset') throw new Error('Usage: npm run local:seed | npm run local:reset');
const characterization = process.env.LOCAL_DEMO_FIXTURE_PROFILE === 'characterization';
if (mode === 'seed' && !characterization && !isLocalMode())
  throw new Error('Interactive local commerce seed requires APP_MODE=local.');

const url = requireLocalDatabaseUrl();
const binding = localFixtureBinding();
await mkdir(dirname(fileURLToPath(url)), { recursive: true });
const client = createClient({ url, timeout: 0 });
try {
  if (mode === 'seed') {
    if (characterization) await seedLocalFixtures(client, binding);
    else await seedInteractiveLocalDemoFixtures(client, binding);
    console.log(`Seeded local commerce fixtures for ${binding.tenantId}/${binding.providerAccountId}.`);
  } else {
    await resetLocalFixtures(client, binding);
    console.log(
      `Reset local fixtures for ${binding.tenantId}/${binding.providerAccountId}; durable case and Mastra tables were untouched.`,
    );
  }
} finally {
  client.close();
}
