import { generateTypes } from '@internal/types-builder';
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/voice/index.ts', 'src/voice/aisdk/index.ts', 'src/routes/index.ts'],
  format: ['esm', 'cjs'],
  fixedExtension: false,
  nodeProtocol: 'strip',
  clean: true,
  dts: false,
  treeshake: true,
  sourcemap: true,
  onSuccess: async () => {
    await generateTypes(process.cwd(), new Set(['@internal/core', '@internal/ai-sdk-v5', 'zod']));
  },
});
