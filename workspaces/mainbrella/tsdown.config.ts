import { generateTypes } from '@internal/types-builder';
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  fixedExtension: false,
  nodeProtocol: 'strip',
  clean: true,
  dts: false,
  treeshake: true,
  sourcemap: true,
  // The SDK publishes an import-only export. Bundle it so the CommonJS entry
  // does not emit an unsupported require('@mainbrella/sdk').
  deps: { alwaysBundle: ['@mainbrella/sdk'], neverBundle: ['@mastra/core'] },
  onSuccess: async () => {
    await generateTypes(process.cwd());
  },
});
