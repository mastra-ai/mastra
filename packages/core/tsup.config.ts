import { spawn } from 'child_process';
import { promisify } from 'util';
import babel from '@babel/core';
import { defineConfig } from 'tsup';
import type { Options } from 'tsup';
import treeshakeDecoratorsBabelPlugin from './tools/treeshake-decorators';

type Plugin = NonNullable<Options['plugins']>[number];

const exec = promisify(spawn);

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
    'src/network/index.ts',
    'src/network/vNext/index.ts',
    'src/vector/filter/index.ts',
    'src/telemetry/otel-vendor.ts',
    'src/test-utils/llm-mock.ts',
    'src/agent/input-processor/processors/index.ts',
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
    await exec('pnpm', ['tsc', '-p', 'tsconfig.build.json'], {
      stdio: 'inherit',
    });
  },
});
