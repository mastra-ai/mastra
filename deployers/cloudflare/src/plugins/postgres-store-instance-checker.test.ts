import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rollup } from 'rollup';
import esbuild from 'rollup-plugin-esbuild';
import { describe, it, expect } from 'vitest';
import { postgresStoreInstanceChecker } from '../plugins/postgres-store-instance-checker';

describe('Check PostgresStore instance', () => {
  const _dirname = dirname(fileURLToPath(import.meta.url));

  it('should bundle without error', async () => {
    const file = join(_dirname, './__fixtures__/basic.js');

    const bundle = await rollup({
      logLevel: 'silent',
      input: file,
      cache: false,
      treeshake: 'smallest',
      plugins: [
        {
          name: 'externalize-all',
          resolveId(id) {
            return {
              id,
              external: id !== file,
            };
          },
        },
        postgresStoreInstanceChecker(),
        esbuild({
          target: `esnext`,
          platform: 'browser',
          minify: false,
        }),
      ],
    });

    const result = await bundle.generate({
      format: 'esm',
    });

    expect(result?.output[0].code).toMatchSnapshot();
  });

  it('should not bundle and throw an error', async () => {
    const file = join(_dirname, './__fixtures__/multiple-postgres-stores.js');

    await expect(
      async () =>
        await rollup({
          logLevel: 'silent',
          input: file,
          cache: false,
          treeshake: 'smallest',
          plugins: [
            {
              name: 'externalize-all',
              resolveId(id) {
                return {
                  id,
                  external: id !== file,
                };
              },
            },
            postgresStoreInstanceChecker(),
            esbuild({
              target: `esnext`,
              platform: 'browser',
              minify: false,
            }),
          ],
        }),
    ).rejects.toThrow(/Only one PostgresStore instance should be created per Cloudflare Worker./);
  });
});
