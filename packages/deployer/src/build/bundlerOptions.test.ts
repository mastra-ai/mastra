import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getBundlerOptionsBundler } from './bundlerOptions';

describe('getBundlerOptionsConfig', () => {
  const _dirname = dirname(fileURLToPath(import.meta.url));

  it.for([
    ['./plugins/__fixtures__/basic-with-bundler.js', true],
    ['./plugins/__fixtures__/basic.js', false],
    ['./plugins/__fixtures__/basic-with-const.js', false],
    ['./plugins/__fixtures__/basic-with-import.js', false],
    ['./plugins/__fixtures__/basic-with-function.js', false],
    ['./plugins/__fixtures__/mastra-with-extra-code.js', false],
    ['./plugins/__fixtures__/empty-mastra.js', false],
    ['./__fixtures__/no-bundler.js', false],
  ] as [string, boolean][])(
    'should be able to extract the bundler options config from %s',
    async ([fileName, hasCustomConfig]) => {
      const hasConfigResult = {
        hasCustomConfig: false,
      } as const;
      const bundle = await getBundlerOptionsBundler(join(_dirname, fileName), hasConfigResult);

      const result = await bundle.generate({
        format: 'esm',
      });

      expect(result?.output[0].code).toMatchSnapshot();
      expect(hasConfigResult.hasCustomConfig).toBe(hasCustomConfig);
    },
  );
});
