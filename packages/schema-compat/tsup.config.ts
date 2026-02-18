import { generateTypes } from '@internal/types-builder';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/schema.ts',
    'src/zod-to-json.ts',
    'src/json-to-zod.ts',
    'src/standard-schema/adapters/ai-sdk.ts',
    'src/standard-schema/adapters/json-schema.ts',
    'src/standard-schema/adapters/zod-v3.ts',
  ],
  format: ['esm', 'cjs'],
  clean: true,
  dts: false,
  splitting: true,
  treeshake: {
    preset: 'smallest',
  },
  sourcemap: true,
  onSuccess: async () => {
    await generateTypes(process.cwd(), new Set(['@internal/ai-sdk-v4', '@internal/ai-v6', '@types/json-schema']));
  },
});
