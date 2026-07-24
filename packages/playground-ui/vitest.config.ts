import { resolve } from 'node:path';
import { defineConfig } from '@internal/lint/vitest';
import react from '@vitejs/plugin-react';

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
    env: { TZ: 'UTC' },
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['**/node_modules/**'],
  },
});
