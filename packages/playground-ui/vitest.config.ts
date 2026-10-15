import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const shared = {
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
};

const sharedTest = {
  // Polyfills first: react-dom reads window globals such as AnimationEvent once, when it loads.
  setupFiles: ['./src/test/jsdom-polyfills.ts', './src/test/vitest-setup.ts'],
  // Must stay above the 3s Testing Library async timeout set in vitest-setup.ts.
  testTimeout: 15000,
  env: { TZ: 'UTC' },
};

export default defineConfig({
  ...shared,
  test: {
    projects: [
      {
        ...shared,
        test: {
          ...sharedTest,
          name: 'unit:packages/playground-ui',
          environment: 'node',
          include: ['src/**/*.{test,spec}.{ts,tsx}'],
          exclude: ['**/node_modules/**', '**/*.dom.test.tsx'],
        },
      },
      {
        ...shared,
        test: {
          ...sharedTest,
          name: 'unit:packages/playground-ui:dom',
          environment: 'jsdom',
          include: ['src/**/*.dom.test.tsx'],
        },
      },
    ],
  },
});
