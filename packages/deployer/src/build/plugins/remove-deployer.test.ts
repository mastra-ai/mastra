import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rollup } from 'rollup';
import esbuild from 'rollup-plugin-esbuild';
import { describe, it, expect } from 'vitest';
import { removeDeployer } from './remove-deployer';

describe('Remove deployer', () => {
  const _dirname = dirname(fileURLToPath(import.meta.url));

  it.for([
    ['./__fixtures__/basic.js'],
    ['./__fixtures__/basic-with-const.js'],
    ['./__fixtures__/basic-with-import.js'],
    ['./__fixtures__/basic-with-spread.js'],
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

  // #29572: `#mastra` resolves to a slash-normalized id while the entry path is native on Windows
  it('should remove the deployer when the module id is slash-normalized', async () => {
    const plugin = removeDeployer('C:\\project\\src\\mastra\\index.ts');
    const code = `import { Mastra } from '@mastra/core';\nexport const mastra = new Mastra({ deployer: new Deployer() });`;

    const result = await (plugin.transform as Function)(code, 'C:/project/src/mastra/index.ts');

    expect(result?.code).toContain('export const mastra = new Mastra({});');
  });
});
