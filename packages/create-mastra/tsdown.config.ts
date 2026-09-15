import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  format: 'esm',
  platform: 'node',
  target: 'node22',
  sourcemap: false,
  treeshake: true,
  dts: false,
  clean: true,
  fixedExtension: false,
  deps: {
    onlyBundle: false,
    alwaysBundle: ['mastra', 'commander', 'posthog-node', 'tinyexec'],
  },
});
