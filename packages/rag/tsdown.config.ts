import { generateTypes } from '@internal/types-builder';
import { transform } from 'esbuild';
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  target: 'es2022',
  clean: true,
  dts: false,
  fixedExtension: false,
  treeshake: true,
  sourcemap: true,
  inputOptions: {
    plugins: [
      {
        name: 'esbuild-ts-decorators',
        async transform(code, id) {
          if (!/\.[cm]?tsx?$/.test(id)) {
            return null;
          }

          const result = await transform(code, {
            loader: id.endsWith('x') ? 'tsx' : 'ts',
            target: 'es2022',
            format: 'esm',
            sourcemap: true,
            sourcefile: id,
          });

          return {
            code: result.code,
            map: result.map,
          };
        },
      },
    ],
  },
  onSuccess: async () => {
    await generateTypes(process.cwd());
  },
});
