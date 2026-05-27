import { generateTypes } from '@internal/types-builder';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/voice/index.ts', 'src/voice/aisdk/index.ts', 'src/routes/index.ts'],
  format: ['esm', 'cjs'],
  clean: true,
  dts: false,
  splitting: true,
  treeshake: {
    preset: 'smallest',
  },
  sourcemap: true,
  onSuccess: async () => {
    await generateTypes(process.cwd(), new Set(['@internal/core', '@internal/ai-sdk-v5', 'zod']));
  },
});
