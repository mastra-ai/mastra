import { defineConfig } from 'vitest/config';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(__dirname, '.env') });

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 30000,
    exclude: ['**/*.test.js', '**/*.spec.js', '**/node_modules/**', '**/dist/**', '**/build/**', '**/.mastra/**'],
  },
});
