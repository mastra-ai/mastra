import path from 'node:path';
import { defineConfig } from '@internal/lint/vitest';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Force a single React instance across all workspace packages (e.g.
      // @mastra/react, @mastra/playground-ui) so hooks share the same
      // internals.  Without this, pnpm may resolve different patch versions
      // for devDependencies vs catalog entries, causing "Invalid hook call"
      // errors in jsdom tests.
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
    },
  },
  test: {
    name: 'unit:packages/playground',
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['e2e/**', '**/node_modules/**'],
  },
});
