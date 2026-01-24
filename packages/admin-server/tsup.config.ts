import { generateTypes } from '@internal/types-builder';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/routes/index.ts', 'src/middleware/index.ts', '!src/**/*.test.ts'],
  format: ['esm', 'cjs'],
  clean: true,
  dts: false,
  splitting: true,
  treeshake: {
    preset: 'smallest',
  },
  sourcemap: true,
  external: ['@mastra/admin', 'zod'],
  onSuccess: async () => {
    await generateTypes(process.cwd());
  },
});
