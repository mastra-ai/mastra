import { generateTypes } from '@internal/types-builder';
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  fixedExtension: false,
  nodeProtocol: 'strip',
  clean: true,
  dts: false,
  treeshake: true,
  sourcemap: true,
  deps: {
    // Vitest must be external so the suites use the consumer's test runner instance.
    neverBundle: ['vitest'],
  },
  onSuccess: async () => {
    await generateTypes(process.cwd());
  },
});
