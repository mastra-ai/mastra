import { defineConfig } from 'vitest/config';
import { config } from 'dotenv';

// Load environment variables
config();

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
});