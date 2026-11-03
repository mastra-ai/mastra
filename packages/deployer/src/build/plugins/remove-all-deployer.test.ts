import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rolldown } from 'rolldown';
import { describe, it, expect } from 'vitest';
import { TREESHAKE_SMALLEST } from '../rolldown';
import { removeAllOptionsFromMastraExceptPlugin } from './remove-all-except';

describe('Remove deployer', () => {
  const _dirname = dirname(fileURLToPath(import.meta.url));

  it.for([
    ['./__fixtures__/basic.js'],
    ['./__fixtures__/basic-with-const.js'],
    ['./__fixtures__/basic-with-exported-const.js'],
    ['./__fixtures__/basic-with-import.js'],
    ['./__fixtures__/basic-with-spread.js'],
    ['./__fixtures__/basic-with-function.js'],
    ['./__fixtures__/basic-with-types.ts'],
  ])('should remove the deployer from %s', async ([fileName]) => {
    const file = join(_dirname, fileName);

    const bundle = await rolldown({
      logLevel: 'silent',
      input: file,
      platform: 'node',
      treeshake: TREESHAKE_SMALLEST,
      experimental: { attachDebugInfo: 'none' },
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
        removeAllOptionsFromMastraExceptPlugin(file, 'deployer', { hasCustomConfig: false }),
      ],
    });

    const result = await bundle.generate({
      format: 'esm',
    });
    await bundle.close();

    expect(result?.output[0].code).toMatchSnapshot();
  });
});
