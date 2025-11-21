import { defineConfig } from 'vitest/config';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env file from service-mastra directory
config({ path: resolve(__dirname, '.env') });

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
