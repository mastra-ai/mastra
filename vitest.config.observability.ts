import { resolve } from 'node:path';
import { defineConfig } from '@internal/lint/vitest';
import { config } from 'dotenv';

config({ path: resolve(__dirname, '.env') });

export default defineConfig({
  test: {
    projects: ['observability/*'],
    exclude: ['**/*.test.js', '**/*.spec.js', '**/node_modules/**', '**/dist/**', '**/build/**', '**/.mastra/**'],
  },
});
