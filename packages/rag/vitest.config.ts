import { transform } from 'esbuild';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    {
      // Vite's Oxc transform does not lower standard decorators (used in src/document/schema/node.ts),
      // so lower them with esbuild, as tsdown.config.ts does for the published build.
      name: 'esbuild-ts-decorators',
      enforce: 'pre',
      async transform(code, id) {
        if (!/\.[cm]?tsx?$/.test(id) || id.includes('/node_modules/')) {
          return null;
        }

        const result = await transform(code, {
          loader: id.endsWith('x') ? 'tsx' : 'ts',
          target: 'es2022',
          format: 'esm',
          sourcemap: true,
          sourcefile: id,
        });

        return { code: result.code, map: result.map };
      },
    },
  ],
  test: {
    name: 'e2e:packages/rag',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
