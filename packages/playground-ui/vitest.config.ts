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
    setupFiles: ['./src/test/vitest-setup.ts'],
    env: { TZ: 'UTC' },
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/node_modules/**'],
  },
});
