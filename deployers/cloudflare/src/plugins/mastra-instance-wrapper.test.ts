import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rollup } from 'rollup';
import esbuild from 'rollup-plugin-esbuild';
import { describe, it, expect } from 'vitest';
import { mastraInstanceWrapper } from '../plugins/mastra-instance-wrapper';

describe('Wrap Mastra instance', () => {
  const _dirname = dirname(fileURLToPath(import.meta.url));

  it.for([['./__fixtures__/empty-mastra.js'], ['./__fixtures__/basic.js']])(
    'should wrap Mastra instance in %s',
    async ([fileName]) => {
      const file = join(_dirname, fileName as string);

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
          esbuild({
            target: `esnext`,
            platform: 'browser',
            minify: false,
          }),
          mastraInstanceWrapper(file),
        ],
      });

      const result = await bundle.generate({
        format: 'esm',
      });

      expect(result?.output[0].code).toMatchSnapshot();
    },
  );
});
