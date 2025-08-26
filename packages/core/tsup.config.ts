import babel from '@babel/core';
import { generateTypes } from '@internal/types-builder';
import { defineConfig } from 'tsup';
import type { Options } from 'tsup';
import treeshakeDecoratorsBabelPlugin from './tools/treeshake-decorators';

type Plugin = NonNullable<Options['plugins']>[number];

let treeshakeDecorators = {
  name: 'treeshake-decorators',
  renderChunk(code: string, info: { path: string }) {
    if (!code.includes('__decoratorStart')) {
      return null;
    }

    return new Promise((resolve, reject) => {
      babel.transform(
        code,
        {
          babelrc: false,
          configFile: false,
          filename: info.path,
          plugins: [treeshakeDecoratorsBabelPlugin],
        },
        (err, result) => {
          if (err) {
            return reject(err);
          }

          resolve({
            code: result!.code!,
            map: result!.map!,
          });
        },
      );
    });
  },
} satisfies Plugin;

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/base.ts',
    'src/utils.ts',
    '!src/action/index.ts',
    'src/*/index.ts',
    'src/tools/is-vercel-tool.ts',
    'src/workflows/legacy/index.ts',
    'src/workflows/constants.ts',
    'src/workflows/evented/index.ts',
    'src/network/index.ts',
    'src/network/vNext/index.ts',
    'src/vector/filter/index.ts',
    'src/telemetry/otel-vendor.ts',
    'src/test-utils/llm-mock.ts',
    'src/agent/input-processor/index.ts',
    'src/processors/index.ts',
    'src/zod-to-json.ts',
  ],
  format: ['esm', 'cjs'],
  clean: true,
  dts: false,
  splitting: true,
  treeshake: {
    preset: 'smallest',
  },
  plugins: [treeshakeDecorators],
  sourcemap: true,
  onSuccess: async () => {
    await generateTypes(process.cwd());
  },
});
