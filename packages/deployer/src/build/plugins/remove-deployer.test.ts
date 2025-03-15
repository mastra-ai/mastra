import { describe, it, expect } from 'vitest';
import { removeDeployer } from './remove-deployer';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { rollup } from 'rollup';
import esbuild from 'rollup-plugin-esbuild';

describe('Remove deployer', () => {
  const _dirname = dirname(fileURLToPath(import.meta.url));

  it.for([
    ['./__fixtures__/basic.js'],
    ['./__fixtures__/basic-with-const.js'],
    ['./__fixtures__/basic-with-import.js'],
    ['./__fixtures__/basic-with-function.js'],
  ])('should remove the deployer from %s', async ([fileName]) => {
    const file = join(_dirname, fileName);

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
        removeDeployer(file),
        esbuild({
          target: `esnext`,
          platform: 'node',
          minify: false,
        }),
      ],
    });

    const result = await bundle.generate({
      format: 'esm',
    });

    expect(result?.output[0].code).toMatchSnapshot();
  });
});
