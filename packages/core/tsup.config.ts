import babel from '@babel/core';
import { defineConfig } from 'tsup';
import type { Options } from 'tsup';

import treeshakeDecoratorsBabelPlugin from './tools/treeshake-decorators';

type Plugin = NonNullable<Options['plugins']>[number];

let treeshakeDecorators = {
  name: 'treeshake-decorators',
  renderChunk(code, info) {
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
    'src/storage/libsql/index.ts',
    'src/vector/libsql/index.ts',
    'src/vector/filter/index.ts',
    'src/telemetry/otel-vendor.ts',
  ],
  format: ['esm', 'cjs'],
  clean: true,
  dts: true,
  treeshake: {
    preset: 'smallest',
  },
  plugins: [treeshakeDecorators],
});
