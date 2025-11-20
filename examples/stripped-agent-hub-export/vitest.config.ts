import {defineConfig} from 'vitest/config';
import {config} from 'dotenv';

// Load .env file for test environment
config();

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 30000,
    hookTimeout: 30000,
    teardownTimeout: 10000,
    env: {
      NODE_ENV: 'test',
    },
  },
});
