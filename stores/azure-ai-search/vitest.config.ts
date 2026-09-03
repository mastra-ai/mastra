import { config } from 'dotenv';
import { defineConfig } from 'vitest/config';

// Load environment variables
config();

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
});