import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rolldown } from 'rolldown';
import type { Plugin } from 'rolldown';
import { describe, it, expect } from 'vitest';
import { postgresStoreInstanceChecker } from '../plugins/postgres-store-instance-checker';

describe('Check PostgresStore instance', () => {
  const _dirname = dirname(fileURLToPath(import.meta.url));

  async function bundle(fileName: string, plugin: Plugin = postgresStoreInstanceChecker()) {
    const build = await rolldown({
      logLevel: 'silent',
      input: join(_dirname, fileName),
      treeshake: true,
      // Bundle relative imports so instances in different files are counted together.
      external: id => !id.startsWith('.') && !id.startsWith(_dirname),
      platform: 'browser',
      plugins: [plugin],
      experimental: { attachDebugInfo: 'none' },
    });

    try {
      const result = await build.generate({ format: 'esm' });
      return result.output[0].code;
    } finally {
      await build.close();
    }
  }

  it('should bundle without error', async () => {
    expect(await bundle('./__fixtures__/basic.js')).toMatchSnapshot();
  });

  it.for([['./__fixtures__/multiple-postgres-stores.js'], ['./__fixtures__/postgres-stores-across-files.ts']])(
    'should not bundle %s and throw an error',
    async ([fileName]) => {
      await expect(bundle(fileName!)).rejects.toThrow(
        /Only one PostgresStore instance should be created per Cloudflare Worker./,
      );
    },
  );

  it('should not count PostgresStore instances inside dependencies', async () => {
    // `@mastra/pg` itself contains `new PostgresStore(`, which must not count against the app's single instance.
    const root = await mkdtemp(join(tmpdir(), 'cf-pg-checker-'));
    try {
      await mkdir(join(root, 'node_modules', 'fake-pg'), { recursive: true });
      await writeFile(
        join(root, 'node_modules', 'fake-pg', 'package.json'),
        JSON.stringify({ name: 'fake-pg', main: 'index.js' }),
      );
      await writeFile(
        join(root, 'node_modules', 'fake-pg', 'index.js'),
        `export class PostgresStore {}\nexport const defaultStore = () => new PostgresStore();\n`,
      );
      await writeFile(
        join(root, 'entry.js'),
        `import { PostgresStore, defaultStore } from 'fake-pg';\nexport const store = new PostgresStore();\nexport { defaultStore };\n`,
      );

      const build = await rolldown({
        logLevel: 'silent',
        input: join(root, 'entry.js'),
        platform: 'browser',
        plugins: [postgresStoreInstanceChecker()],
      });
      try {
        await expect(build.generate({ format: 'esm' })).resolves.toBeDefined();
      } finally {
        await build.close();
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('should not count instances from a previous build of the same plugin', async () => {
    const plugin = postgresStoreInstanceChecker();

    await bundle('./__fixtures__/typed-mastra.ts', plugin);
    await expect(bundle('./__fixtures__/typed-mastra.ts', plugin)).resolves.toContain('new PostgresStore(');
  });
});
