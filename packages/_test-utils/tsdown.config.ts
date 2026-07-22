import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts', 'src/setup.ts'],
  format: ['esm', 'cjs'],
  fixedExtension: false,
  nodeProtocol: 'strip',
  clean: true,
  dts: true,
  treeshake: true,
  sourcemap: true,
  // vitest must be external so hooks use the consumer's test runner instance
  deps: {
    neverBundle: ['lightningcss', 'postcss', 'vite', 'vitest'],
    alwaysBundle: ['@internal/llm-recorder'],
  },
});
