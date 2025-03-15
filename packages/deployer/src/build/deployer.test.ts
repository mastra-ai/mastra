import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getDeployerBundler } from './deployer';

describe('getDeployer', () => {
  const _dirname = dirname(fileURLToPath(import.meta.url));

  it.for([
    ['./plugins/__fixtures__/basic.js'],
    ['./plugins/__fixtures__/basic-with-const.js'],
    ['./plugins/__fixtures__/basic-with-import.js'],
    ['./plugins/__fixtures__/basic-with-function.js'],
  ])('should be able to extract the deployer from %s', async ([fileName]) => {
    const bundle = await getDeployerBundler(join(_dirname, fileName));

    const result = await bundle.generate({
      format: 'esm',
    });

    expect(result?.output[0].code).toMatchSnapshot();
  });
});
