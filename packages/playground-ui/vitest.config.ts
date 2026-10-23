import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  test: {
    name: 'unit:packages/playground-ui',
    environment: 'node',
    // Polyfills first: react-dom reads window globals such as AnimationEvent once, when it loads.
    setupFiles: ['./src/test/jsdom-polyfills.ts', './src/test/vitest-setup.ts'],
    // Must stay above the 3s Testing Library async timeout set in vitest-setup.ts.
    testTimeout: 15000,
    env: { TZ: 'UTC' },
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/node_modules/**'],
  },
});
