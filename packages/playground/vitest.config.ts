import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      'react/jsx-runtime': path.resolve(__dirname, 'node_modules/react/jsx-runtime.js'),
      'react/jsx-dev-runtime': path.resolve(__dirname, 'node_modules/react/jsx-dev-runtime.js'),
    },
    dedupe: ['react', 'react-dom'],
  },
  test: {
    setupFiles: ['./vitest.setup.ts'],
    exclude: ['e2e/**', '**/node_modules/**'],
    server: {
      deps: {
        // Force playground-ui + radix through the bundler so the react alias
        // above applies to deeply imported radix providers (Tooltip, ...).
        // Tests that render heavier portal-based components (SideDialog) stub
        // the offending wrapper directly.
        inline: [/@radix-ui\//, /@mastra\/playground-ui/, /use-debounce/, /@base-ui\//],
      },
    },
  },
});
