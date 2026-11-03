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

  it('should not count instances from a previous build of the same plugin', async () => {
    const plugin = postgresStoreInstanceChecker();

    await bundle('./__fixtures__/typed-mastra.ts', plugin);
    await expect(bundle('./__fixtures__/typed-mastra.ts', plugin)).resolves.toContain('new PostgresStore(');
  });
});
