import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@libsql/client';
import { afterEach, describe, expect, it } from 'vitest';
import { ObservabilityLibSQL } from './domains/observability';
import { LibSQLStore } from './index';

describe('libSQL observability persistence location', () => {
  const stores: LibSQLStore[] = [];
  const directories: string[] = [];
  afterEach(async () => {
    await Promise.all(stores.splice(0).map(store => store.close()));
    for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
  });

  it.each([
    { url: ':memory:', expected: 'local' },
    { url: 'file::memory:', expected: 'local' },
    { url: 'https://example.invalid', expected: 'remote' },
    { url: 'libsql://example.invalid', expected: 'remote' },
  ])('reports $expected for $url before initialization', async ({ url, expected }) => {
    const store = new LibSQLStore({ id: 'location-test', url });
    stores.push(store);
    expect((await store.getStore('observability'))?.persistenceLocation).toBe(expected);
  });

  it('reports local storage for a file-backed database', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'libsql-location-'));
    directories.push(directory);
    const store = new LibSQLStore({ id: 'file-location', url: `file:${join(directory, 'data.db')}` });
    stores.push(store);
    expect((await store.getStore('observability'))?.persistenceLocation).toBe('local');
  });

  it.each([false, true])(
    'reports local storage for an injected file client (embedded replica: %s)',
    embeddedReplica => {
      const client = createClient({ url: ':memory:' });
      try {
        const store = new ObservabilityLibSQL({ client, embeddedReplica });
        expect(store.persistenceLocation).toBe('local');
      } finally {
        client.close();
      }
    },
  );
});
