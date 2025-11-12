import { resolve } from 'path';
import { config } from 'dotenv';
import { defineConfig } from 'vitest/config';

// Load environment variables from .env for tests
config({ path: resolve(__dirname, '.env') });

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
  },
});
