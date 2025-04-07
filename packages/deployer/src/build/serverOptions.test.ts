import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getServerOptionsBundler } from './serverOptions';

describe('getServerOptionsConfig', () => {
  const _dirname = dirname(fileURLToPath(import.meta.url));

  it.for([
    ['./plugins/__fixtures__/basic.js', true],
    ['./plugins/__fixtures__/basic-with-const.js', true],
    ['./plugins/__fixtures__/basic-with-import.js', true],
    ['./plugins/__fixtures__/basic-with-function.js', true],
    ['./plugins/__fixtures__/mastra-with-extra-code.js', true],
    ['./plugins/__fixtures__/empty-mastra.js', false],
    ['./__fixtures__/no-server.js', false],
  ] as [string, boolean][])(
    'should be able to extract the server options config from %s',
    async ([fileName, hasCustomConfig]) => {
      const hasConfigResult = {
        hasCustomConfig: false,
      } as const;
      const bundle = await getServerOptionsBundler(join(_dirname, fileName), hasConfigResult);

      const result = await bundle.generate({
        format: 'esm',
      });

      expect(result?.output[0].code).toMatchSnapshot();
      expect(hasConfigResult.hasCustomConfig).toBe(hasCustomConfig);
    },
  );
});
