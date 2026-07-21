import { generateTypes } from '@internal/types-builder';
import { defineConfig } from 'tsdown';

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
  fixedExtension: false,
  nodeProtocol: 'strip',
  clean: true,
  dts: false,
  treeshake: true,
  sourcemap: true,
  deps: {
    alwaysBundle: ['@internal/ai-sdk-v4', 'ajv'],
  },
  onSuccess: async () => {
    await generateTypes(
      process.cwd(),
      new Set([
        '@internal/ai-sdk-v4',
        '@internal/ai-sdk-v5',
        '@internal/ai-v6',
        '@standard-schema/spec',
        '@types/json-schema',
        'ajv',
      ]),
    );
  },
});
