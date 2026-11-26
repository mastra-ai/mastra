import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { pathToFileURL } from 'node:url';
import { localDatabasePath } from '../../src/mastra/database/database-file.ts';
import { resolveStoreConfiguration } from '../../src/mastra/database/store.ts';

const databaseUrl = 'postgresql://support:synthetic%40password@example.invalid/support?sslmode=verify-full';
const turso = { TURSO_DATABASE_URL: 'libsql://support.example.invalid', TURSO_AUTH_TOKEN: 'example-token' };
const platform = { MASTRA_ENVIRONMENT_ID: 'example-environment' };
const local = { backend: 'libsql', url: pathToFileURL(resolve('.local/support.db')).href };

test('selects the persistent local store for development and requires a managed store on Mastra Platform', () => {
  assert.deepEqual(resolveStoreConfiguration({}), local);
  assert.equal(localDatabasePath(local.url), resolve('.local/support.db'));
  for (const invalid of ['file:', 'file::memory:', 'file:bad%00path']) {
    assert.throws(() => localDatabasePath(invalid), /Expected a persistent local file database/u);
  }
  assert.deepEqual(resolveStoreConfiguration({ DATABASE_PROVIDER: '  ' }), local);
  assert.deepEqual(resolveStoreConfiguration({ DATABASE_PROVIDER: 'local', DATABASE_URL: databaseUrl }), local);
  assert.deepEqual(resolveStoreConfiguration({ SUPPORT_MODE: 'local', ...turso, DATABASE_URL: databaseUrl }), local);
  assert.deepEqual(resolveStoreConfiguration({ SUPPORT_DATABASE_URL: 'file:./custom.db' }), {
    backend: 'libsql',
    url: pathToFileURL(resolve('custom.db')).href,
  });
  assert.throws(() => resolveStoreConfiguration(platform), /Attach a managed database/u);
  assert.throws(
    () => resolveStoreConfiguration({ ...platform, DATABASE_PROVIDER: 'local', DATABASE_URL: databaseUrl }),
    /Attach a managed database/u,
  );
  assert.throws(
    () => resolveStoreConfiguration({ ...platform, DATABASE_PROVIDER: 'redis' }),
    /must be local, turso, neon, or postgres/u,
  );
});

test('infers one managed SQL backend and requires a choice when both variable sets are present', () => {
  const env = { ...platform, ...turso, DATABASE_URL: databaseUrl };
  const tursoStore = {
    backend: 'libsql',
    url: turso.TURSO_DATABASE_URL,
    authToken: turso.TURSO_AUTH_TOKEN,
    lockFile: resolve('.local/support.writer.sqlite'),
  };
  const postgresStore = { backend: 'postgres', connectionString: databaseUrl };
  assert.deepEqual(resolveStoreConfiguration(turso), tursoStore);
  assert.deepEqual(resolveStoreConfiguration({ ...platform, DATABASE_URL: databaseUrl }), postgresStore);
  assert.throws(() => resolveStoreConfiguration(env), /Set DATABASE_PROVIDER/u);
  assert.throws(() => resolveStoreConfiguration({ ...env, TURSO_AUTH_TOKEN: '' }), /Set DATABASE_PROVIDER/u);
  assert.deepEqual(resolveStoreConfiguration({ ...env, DATABASE_PROVIDER: ' turso ' }), tursoStore);
  for (const provider of ['neon', 'postgres']) {
    assert.deepEqual(resolveStoreConfiguration({ ...env, DATABASE_PROVIDER: provider }), postgresStore);
  }
});

test('reports missing and invalid settings together without exposing credentials or falling back', () => {
  assert.throws(
    () =>
      resolveStoreConfiguration({
        DATABASE_PROVIDER: 'turso',
        TURSO_DATABASE_URL: 'malformed-synthetic-password',
      }),
    {
      message:
        'Missing database variables (TURSO_AUTH_TOKEN). Invalid database variables (TURSO_DATABASE_URL requires a valid HTTP, HTTPS or libSQL URL)',
    },
  );
  assert.throws(
    () => resolveStoreConfiguration({ DATABASE_PROVIDER: 'turso', TURSO_DATABASE_URL: turso.TURSO_DATABASE_URL }),
    /Missing database variables \(TURSO_AUTH_TOKEN\)/u,
  );
  assert.throws(
    () => resolveStoreConfiguration({ DATABASE_PROVIDER: 'neon', ...turso }),
    /Missing database variables \(DATABASE_URL\)/u,
  );
  assert.throws(() => resolveStoreConfiguration({ DATABASE_URL: 'postgresql://support:synthetic@invalid.example' }), {
    message: 'DATABASE_URL must include a PostgreSQL database name',
  });
  assert.throws(
    () => resolveStoreConfiguration({ DATABASE_PROVIDER: 'postgres', DATABASE_URL: 'malformed-synthetic-password' }),
    { message: 'Invalid database variables (DATABASE_URL)' },
  );
  assert.throws(
    () => resolveStoreConfiguration({ ...turso, TURSO_DATABASE_URL: 'http://support.example.invalid' }),
    /requires HTTPS or libSQL outside loopback/u,
  );
  assert.throws(
    () => resolveStoreConfiguration({ ...turso, TURSO_DATABASE_URL: 'libsql://support.example.invalid:80?tls=0' }),
    /must not include query options/u,
  );
});

test('requires verified TLS for remote PostgreSQL with either database configuration', () => {
  for (const envFor of [
    (url: string) => ({ DATABASE_URL: url }),
    (url: string) => ({ DATABASE_PROVIDER: 'postgres', DATABASE_URL: url }),
    (url: string) => ({ DATABASE_PROVIDER: 'neon', DATABASE_URL: url }),
    (url: string) => ({ SUPPORT_MODE: 'hosted', SUPPORT_DATABASE_URL: url }),
  ]) {
    for (const query of [
      '',
      '?sslmode=disable',
      '?sslmode=require',
      '?sslmode=verify-full&sslmode=disable',
      '?sslmode=verify-full&ssl=0',
    ]) {
      assert.throws(
        () => resolveStoreConfiguration(envFor(`postgres://example.invalid/support${query}`)),
        /requires sslmode=verify-full/u,
      );
    }
    for (const url of [databaseUrl, 'postgres://localhost/support', 'postgres://[::1]/support?sslmode=disable']) {
      assert.deepEqual(resolveStoreConfiguration(envFor(url)), { backend: 'postgres', connectionString: url });
    }
  }
});
