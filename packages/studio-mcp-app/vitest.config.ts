import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      react: resolve(import.meta.dirname, 'node_modules/react'),
      'react-dom': resolve(import.meta.dirname, 'node_modules/react-dom'),
    },
  },
  test: {
    name: 'unit:packages/studio-mcp-app',
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.tsx'],
    testTimeout: 15000,
  },
});
