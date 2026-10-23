import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

describe('importing without native libsql bindings (#28201)', () => {
  it.each(['import', 'require'])('supports an injected client via %s', mode => {
    // Preload a real SQLite client, then simulate a platform whose native module
    // cannot load. The hook covers both ESM imports and CommonJS requires.
    const output = execFileSync(
      process.execPath,
      [
        '--import',
        'tsx',
        '--input-type=module',
        '-e',
        `
          import assert from 'node:assert/strict';
          import { createRequire, registerHooks } from 'node:module';
          import { createClient } from '@libsql/client/sqlite3';
          const client = createClient({ url: ':memory:' });
          const hook = registerHooks({
            resolve(specifier, context, nextResolve) {
              if (specifier === '@libsql/client' || specifier === 'libsql') {
                throw new Error('Native libsql binding unavailable (#28201)');
              }
              return nextResolve(specifier, context);
            }
          });
          try {
            const entry = process.env.LIBSQL_TEST_ENTRY || './src/index.ts';
            const api = ${mode === 'import' ? 'await import(entry)' : 'createRequire(import.meta.url)(entry)'};
            const store = new api.LibSQLStore({ id: 'injected', client });
            await store.init();
            const memory = await store.getStore('memory');
            const thread = {
              id: 'thread', resourceId: 'resource', title: 'Native-free import', metadata: { source: 'injected' },
              createdAt: new Date('2026-01-01'), updatedAt: new Date('2026-01-01')
            };
            await memory.saveThread({ thread });
            assert.deepEqual(await memory.getThreadById({ threadId: thread.id }), thread);
            const standalone = new api.MemoryLibSQL({ client });
            assert.deepEqual(await standalone.getThreadById({ threadId: thread.id }), thread);
            assert.throws(() => new api.LibSQLStore({ id: 'url', url: ':memory:' }), /Native libsql binding unavailable/);
            assert.throws(() => new api.MemoryLibSQL({ url: ':memory:' }), /Native libsql binding unavailable/);
            assert.throws(() => new api.LibSQLVector({ id: 'vector', url: ':memory:' }), /Native libsql binding unavailable/);
            assert.throws(() => new api.LibSQLFactoryStorage({ url: ':memory:' }), /Native libsql binding unavailable/);
            await store.close();
            console.log('Persisted and read a thread with native module loading blocked');
          } finally {
            hook.deregister();
            client.close();
          }
        `,
      ],
      { cwd: fileURLToPath(new URL('..', import.meta.url)), encoding: 'utf8', timeout: 30_000 },
    );
    expect(output).toContain('Persisted and read a thread with native module loading blocked');
  });
});
