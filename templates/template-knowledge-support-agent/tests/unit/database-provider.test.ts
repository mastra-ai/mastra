import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveDatabaseConnection } from '../../src/mastra/database/database-provider.ts';

const databaseUrl = 'postgresql://support:synthetic%40password@example.invalid/support?sslmode=require';
const turso = { TURSO_DATABASE_URL: 'libsql://support.example.invalid', TURSO_AUTH_TOKEN: 'example-token' };
const platform = { MASTRA_ENVIRONMENT_ID: 'example-environment' };

test('selects local storage for development and avoids filesystem fallback on Mastra Platform', () => {
  assert.deepEqual(resolveDatabaseConnection({}), { provider: 'local' });
  assert.deepEqual(resolveDatabaseConnection({ DATABASE_PROVIDER: 'local', DATABASE_URL: databaseUrl }), {
    provider: 'local',
  });
  assert.throws(() => resolveDatabaseConnection(platform), /Attach a managed database/u);
  assert.throws(
    () => resolveDatabaseConnection({ ...platform, DATABASE_PROVIDER: 'local', DATABASE_URL: databaseUrl }),
    /Attach a managed database/u,
  );
  assert.throws(
    () => resolveDatabaseConnection({ ...platform, DATABASE_PROVIDER: 'redis' }),
    /must be local, turso, neon, or postgres/u,
  );
});

test('infers one managed SQL backend and requires a choice when both variable sets are present', () => {
  const env = { ...platform, ...turso, DATABASE_URL: databaseUrl };
  assert.deepEqual(resolveDatabaseConnection(turso), {
    provider: 'turso',
    url: turso.TURSO_DATABASE_URL,
    authToken: turso.TURSO_AUTH_TOKEN,
  });
  assert.deepEqual(resolveDatabaseConnection({ ...platform, DATABASE_URL: databaseUrl }), {
    provider: 'postgres',
    connectionString: databaseUrl,
  });
  assert.throws(() => resolveDatabaseConnection(env), /Set DATABASE_PROVIDER/u);
  assert.equal(resolveDatabaseConnection({ ...env, DATABASE_PROVIDER: 'turso' }).provider, 'turso');
  for (const provider of ['neon', 'postgres'])
    assert.deepEqual(resolveDatabaseConnection({ ...env, DATABASE_PROVIDER: provider }), {
      provider,
      connectionString: databaseUrl,
    });
});

test('reports incomplete or malformed connections without exposing credentials or falling back', () => {
  assert.throws(
    () => resolveDatabaseConnection({ DATABASE_PROVIDER: 'turso', TURSO_DATABASE_URL: turso.TURSO_DATABASE_URL }),
    /Set TURSO_AUTH_TOKEN/u,
  );
  assert.throws(() => resolveDatabaseConnection({ DATABASE_PROVIDER: 'neon', ...turso }), /Set DATABASE_URL/u);
  assert.throws(() => resolveDatabaseConnection({ DATABASE_URL: 'postgresql://support:synthetic@invalid.example' }), {
    message: 'DATABASE_URL must include a PostgreSQL database name',
  });
  assert.throws(
    () => resolveDatabaseConnection({ DATABASE_PROVIDER: 'postgres', DATABASE_URL: 'malformed-synthetic-password' }),
    { message: 'Invalid connection URL in DATABASE_URL' },
  );
  assert.throws(
    () => resolveDatabaseConnection({ ...turso, TURSO_DATABASE_URL: 'http://support.example.invalid' }),
    /requires HTTPS or libsql outside loopback/u,
  );
  assert.throws(
    () => resolveDatabaseConnection({ ...turso, TURSO_DATABASE_URL: 'libsql://support.example.invalid:80?tls=0' }),
    /must not include query options/u,
  );
});
