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
    // `mastra` is a workspace devDependency imported by source; declare the
    // bundling explicitly so the package-output check can see it is intended.
    alwaysBundle: ['mastra'],
  },
});
