import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rolldown } from 'rolldown';
import { describe, it, expect } from 'vitest';
import { mastraInstanceWrapper } from '../plugins/mastra-instance-wrapper';

describe('Wrap Mastra instance', () => {
  const _dirname = dirname(fileURLToPath(import.meta.url));

  it.for([['./__fixtures__/empty-mastra.js'], ['./__fixtures__/basic.js'], ['./__fixtures__/typed-mastra.ts']])(
    'should wrap Mastra instance in %s',
    async ([fileName]) => {
      const file = join(_dirname, fileName as string);

      const bundle = await rolldown({
        logLevel: 'silent',
        input: file,
        treeshake: true,
        external: id => id !== file,
        platform: 'browser',
        plugins: [mastraInstanceWrapper(file)],
        experimental: { attachDebugInfo: 'none' },
      });

      try {
        const result = await bundle.generate({ format: 'esm' });
        const code = result.output[0].code;

        expect(code).toMatch(/const mastra = \(\) => new Mastra\(/);
        expect(code).toMatchSnapshot();
      } finally {
        await bundle.close();
      }
    },
  );
});
