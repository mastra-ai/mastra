import { config } from 'dotenv';
import { defineConfig } from 'vitest/config';

// Load .env file
config({ path: '.env' });

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
    pool: 'threads',
    maxWorkers: 1,
    isolate: false,
  },
});
