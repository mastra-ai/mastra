import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm'],
    dts: false, // Disable dts for now due to @opencode-ai/plugin type resolution issues
    sourcemap: true,
    clean: true,
    outDir: 'dist',
  },
  {
    entry: ['src/cli.ts'],
    format: ['esm'],
    outDir: 'dist',
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
]);
