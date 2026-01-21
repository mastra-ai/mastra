/**
 * Integration tests for Drizzle schema with real D1 operations via Miniflare.
 */

import { drizzle } from 'drizzle-orm/d1';
import { Miniflare } from 'miniflare';
import { beforeAll, afterAll } from 'vitest';
import { describeDrizzleIntegration } from '../../../../scripts/drizzle-schema-generator/integration-test-utils';
import { D1Store } from '../storage';
import { createMastraSchema } from './index';

// Default schema (no prefix)
const schema = createMastraSchema();

// Prefixed schema (tests D1's tablePrefix support)
const PREFIX = 'test_';
const prefixedSchema = createMastraSchema({ tablePrefix: PREFIX });

let mf: Miniflare;
let db: ReturnType<typeof drizzle>;
let prefixedDb: ReturnType<typeof drizzle>;

beforeAll(async () => {
  mf = new Miniflare({
    modules: true,
    script: 'export default {};',
    d1Databases: ['DB', 'PREFIXED_DB'],
  });

  // Default tables
  const binding = await mf.getD1Database('DB');
  await new D1Store({ id: 'test', binding }).init();
  db = drizzle(binding, { schema });

  // Prefixed tables
  const prefixedBinding = await mf.getD1Database('PREFIXED_DB');
  await new D1Store({ id: 'test-prefix', binding: prefixedBinding, tablePrefix: PREFIX }).init();
  prefixedDb = drizzle(prefixedBinding, { schema: prefixedSchema });
});

afterAll(async () => {
  await mf.dispose();
});

describeDrizzleIntegration(() => db, schema);
describeDrizzleIntegration(() => prefixedDb, prefixedSchema, 'with tablePrefix');
